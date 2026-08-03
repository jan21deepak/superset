# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Tests for SQLAlchemy session isolation across concurrent MCP tool calls.

Async MCP tool calls are asyncio tasks that all execute in the same greenlet on
the event-loop thread. flask-sqlalchemy 2.5.1 scopes ``db.session`` with
``greenlet.getcurrent`` by default, so every concurrent call resolves to one
shared ``Session``. Each call runs inside its own Flask app context and the
per-call teardown calls ``session.remove()`` unconditionally, so the first call
to finish removes the ``Session`` still in use by the others, detaching their
ORM instances (``DetachedInstanceError``).

``superset.extensions._session_scopefunc`` keys the scope on the current
asyncio task when inside a running event loop, giving each concurrent call its
own ``Session`` while falling back to the default identity elsewhere.

These tests verify that:
- ``_session_scopefunc`` returns a distinct value per asyncio task and falls
  back to the greenlet/thread identity outside a running loop.
- With the default greenlet identity, one task's teardown detaches another
  task's instance (the bug).
- With ``_session_scopefunc``, each task keeps its own session and teardown is
  confined to the finishing task (the fix).
"""

import asyncio

import pytest
from flask_sqlalchemy import _ident_func
from sqlalchemy import Column, create_engine, Integer, String
from sqlalchemy.orm import declarative_base, scoped_session, sessionmaker
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.extensions import _session_scopefunc

Base = declarative_base()


class Widget(Base):  # type: ignore[misc, valid-type]
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True)
    name = Column(String(64))


@pytest.mark.asyncio
async def test_scopefunc_distinct_per_task():
    """Concurrent tasks resolve to distinct scope keys."""
    keys: list[object] = []
    barrier = asyncio.Event()

    async def worker() -> None:
        keys.append(_session_scopefunc())
        if len(keys) == 3:
            barrier.set()
        await barrier.wait()

    await asyncio.gather(worker(), worker(), worker())

    assert len(keys) == 3
    assert len({id(k) for k in keys}) == 3, "each task must get its own scope key"


def test_scopefunc_falls_back_outside_event_loop():
    """Outside a running loop the identity matches flask-sqlalchemy's default."""
    assert _session_scopefunc() == _ident_func()


def _make_registry(scopefunc, db_path: str) -> scoped_session:
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    registry = scoped_session(sessionmaker(bind=engine), scopefunc=scopefunc)
    session = registry()
    session.add_all([Widget(id=1, name="a"), Widget(id=2, name="b")])
    session.commit()
    registry.remove()
    return registry


async def _run_teardown_race(registry: scoped_session):
    """One task commits + tears down while another still holds an instance.

    Returns the reader task's view of its own instance's ``name``.
    Both tasks load their instance before either commits, mirroring
    concurrent tool calls that have each fetched ORM objects.
    """
    both_loaded = asyncio.Event()
    writer_done = asyncio.Event()
    loaded = 0

    async def writer() -> None:
        nonlocal loaded
        obj = registry.query(Widget).get(1)
        _ = obj.name  # force load
        loaded += 1
        if loaded == 2:
            both_loaded.set()
        await both_loaded.wait()
        obj.name = "changed"
        registry.commit()  # expires instances bound to this scope's session
        registry.remove()  # the per-call app-context teardown
        writer_done.set()

    async def reader() -> str:
        nonlocal loaded
        obj = registry.query(Widget).get(2)
        _ = obj.name  # force load
        loaded += 1
        if loaded == 2:
            both_loaded.set()
        await both_loaded.wait()
        await writer_done.wait()
        return obj.name  # re-read after the other task's teardown

    _, reader_view = await asyncio.gather(writer(), reader())
    return reader_view


@pytest.mark.asyncio
async def test_shared_greenlet_scope_detaches_other_task(tmp_path):
    """Default greenlet identity: teardown detaches the other task's instance."""
    registry = _make_registry(_ident_func, str(tmp_path / "shared.db"))
    try:
        with pytest.raises(DetachedInstanceError):
            await _run_teardown_race(registry)
    finally:
        registry.remove()


@pytest.mark.asyncio
async def test_task_scope_isolates_sessions(tmp_path):
    """Task-scoped identity: each task keeps its own session across teardown."""
    registry = _make_registry(_session_scopefunc, str(tmp_path / "isolated.db"))
    try:
        reader_view = await _run_teardown_race(registry)
        assert reader_view == "b"
    finally:
        registry.remove()
