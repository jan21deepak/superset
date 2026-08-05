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
# pylint: disable=redefined-outer-name, import-outside-toplevel

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


@pytest.fixture
def datasets(session: Session) -> Iterator[Session]:
    """
    Two datasets in the same database, and one in another database.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    other_database = Database(
        database_name="other_database", sqlalchemy_uri="sqlite://"
    )
    orders = SqlaTable(
        table_name="orders",
        columns=[
            TableColumn(column_name="id"),
            TableColumn(column_name="customer_id"),
            TableColumn(column_name="shipping_customer_id"),
        ],
        metrics=[],
        database=database,
    )
    customers = SqlaTable(
        table_name="customers",
        columns=[TableColumn(column_name="id")],
        metrics=[],
        database=database,
    )
    remote_customers = SqlaTable(
        table_name="remote_customers",
        columns=[TableColumn(column_name="id")],
        metrics=[],
        database=other_database,
    )

    session.add_all([database, other_database, orders, customers, remote_customers])
    session.flush()
    yield session
    session.rollback()


@pytest.fixture
def security_manager(mocker: MockerFixture) -> MagicMock:
    """
    A permissive security manager for the write commands.
    """
    return mocker.patch(
        "superset.commands.dataset_relationship.base.security_manager",
        new=MagicMock(),
    )
