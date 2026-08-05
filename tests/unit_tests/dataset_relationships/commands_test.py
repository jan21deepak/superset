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
# pylint: disable=unused-argument, import-outside-toplevel

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.commands.dataset_relationship.create import (
    CreateDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.delete import (
    DeleteDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipInvalidError,
    DatasetRelationshipNotFoundError,
)
from superset.commands.dataset_relationship.update import (
    UpdateDatasetRelationshipCommand,
)
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.models.dataset_relationship import DatasetRelationshipCardinality


def _dataset(session: Session, table_name: str) -> SqlaTable:
    return session.query(SqlaTable).filter_by(table_name=table_name).one()


def _column_id(dataset: SqlaTable, column_name: str) -> int:
    return next(
        column.id for column in dataset.columns if column.column_name == column_name
    )


def _payload(session: Session, **overrides: Any) -> dict[str, Any]:
    orders = _dataset(session, "orders")
    customers = _dataset(session, "customers")
    payload: dict[str, Any] = {
        "name": "orders → customers",
        "source_dataset_id": orders.id,
        "target_dataset_id": customers.id,
        "cardinality": DatasetRelationshipCardinality.MANY_TO_ONE.value,
        "join_type": "inner",
        "is_active": True,
        "columns": [
            {
                "source_column_id": _column_id(orders, "customer_id"),
                "target_column_id": _column_id(customers, "id"),
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_create(datasets: Session, security_manager: MagicMock) -> None:
    relationship = CreateDatasetRelationshipCommand(_payload(datasets)).run()

    assert relationship.id is not None
    assert relationship.is_cross_database is False
    assert relationship.is_valid is True
    assert [pair.ordinal for pair in relationship.columns] == [0]


def test_create_detects_cross_database(
    datasets: Session, security_manager: MagicMock
) -> None:
    orders = _dataset(datasets, "orders")
    remote = _dataset(datasets, "remote_customers")
    relationship = CreateDatasetRelationshipCommand(
        _payload(
            datasets,
            target_dataset_id=remote.id,
            columns=[
                {
                    "source_column_id": _column_id(orders, "customer_id"),
                    "target_column_id": _column_id(remote, "id"),
                }
            ],
        )
    ).run()

    assert relationship.is_cross_database is True


def test_create_rejects_column_from_another_dataset(
    datasets: Session, security_manager: MagicMock
) -> None:
    orders = _dataset(datasets, "orders")
    with pytest.raises(DatasetRelationshipInvalidError) as excinfo:
        CreateDatasetRelationshipCommand(
            _payload(
                datasets,
                columns=[
                    {
                        "source_column_id": _column_id(orders, "customer_id"),
                        "target_column_id": _column_id(orders, "id"),
                    }
                ],
            )
        ).run()

    assert "does not belong to dataset" in str(excinfo.value.normalized_messages())


def test_create_rejects_unknown_dataset(
    datasets: Session, security_manager: MagicMock
) -> None:
    with pytest.raises(DatasetRelationshipInvalidError) as excinfo:
        CreateDatasetRelationshipCommand(
            _payload(datasets, target_dataset_id=123456)
        ).run()

    assert "target_dataset_id" in excinfo.value.normalized_messages()


def test_multiple_relationships_between_the_same_datasets(
    datasets: Session, security_manager: MagicMock
) -> None:
    orders = _dataset(datasets, "orders")
    customers = _dataset(datasets, "customers")
    CreateDatasetRelationshipCommand(_payload(datasets)).run()
    second = CreateDatasetRelationshipCommand(
        _payload(
            datasets,
            name="shipping",
            columns=[
                {
                    "source_column_id": _column_id(orders, "shipping_customer_id"),
                    "target_column_id": _column_id(customers, "id"),
                }
            ],
        )
    ).run()

    assert second.id is not None


def test_duplicated_column_mapping_is_rejected(
    datasets: Session, security_manager: MagicMock
) -> None:
    CreateDatasetRelationshipCommand(_payload(datasets)).run()
    with pytest.raises(DatasetRelationshipInvalidError) as excinfo:
        CreateDatasetRelationshipCommand(_payload(datasets, name="duplicate")).run()

    assert "already exists" in str(excinfo.value.normalized_messages())


def test_create_requires_access_to_both_datasets(
    datasets: Session, security_manager: MagicMock, mocker: MockerFixture
) -> None:
    security_manager.raise_for_access.side_effect = SupersetSecurityException(
        mocker.MagicMock()
    )

    with pytest.raises(SupersetSecurityException):
        CreateDatasetRelationshipCommand(_payload(datasets)).run()


def test_update_replaces_columns(
    datasets: Session, security_manager: MagicMock
) -> None:
    orders = _dataset(datasets, "orders")
    customers = _dataset(datasets, "customers")
    relationship = CreateDatasetRelationshipCommand(_payload(datasets)).run()

    updated = UpdateDatasetRelationshipCommand(
        relationship.id,
        {
            "name": "renamed",
            "columns": [
                {
                    "source_column_id": _column_id(orders, "shipping_customer_id"),
                    "target_column_id": _column_id(customers, "id"),
                }
            ],
        },
    ).run()

    assert updated.name == "renamed"
    assert updated.column_pairs == [
        (
            _column_id(orders, "shipping_customer_id"),
            _column_id(customers, "id"),
        )
    ]


def test_update_keeps_columns_when_omitted(
    datasets: Session, security_manager: MagicMock
) -> None:
    relationship = CreateDatasetRelationshipCommand(_payload(datasets)).run()
    pairs = relationship.column_pairs

    updated = UpdateDatasetRelationshipCommand(
        relationship.id, {"is_active": False}
    ).run()

    assert updated.is_active is False
    assert updated.column_pairs == pairs


def test_update_missing_relationship(
    datasets: Session, security_manager: MagicMock
) -> None:
    with pytest.raises(DatasetRelationshipNotFoundError):
        UpdateDatasetRelationshipCommand(123456, {"name": "nope"}).run()


def test_delete(datasets: Session, security_manager: MagicMock) -> None:
    from superset.daos.dataset_relationship import DatasetRelationshipDAO

    relationship = CreateDatasetRelationshipCommand(_payload(datasets)).run()
    DeleteDatasetRelationshipCommand([relationship.id]).run()

    assert DatasetRelationshipDAO.find_by_id(relationship.id) is None


def test_delete_missing_relationship(
    datasets: Session, security_manager: MagicMock
) -> None:
    with pytest.raises(DatasetRelationshipNotFoundError):
        DeleteDatasetRelationshipCommand([123456]).run()
