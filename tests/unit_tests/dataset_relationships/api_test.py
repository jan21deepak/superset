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

import pytest
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable

pytestmark = pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"DATASET_RELATIONSHIPS": True}}],
    indirect=True,
)


def _ids(session: Session) -> dict[str, int]:
    orders = session.query(SqlaTable).filter_by(table_name="orders").one()
    customers = session.query(SqlaTable).filter_by(table_name="customers").one()
    return {
        "orders": orders.id,
        "customers": customers.id,
        "orders.customer_id": next(
            column.id
            for column in orders.columns
            if column.column_name == "customer_id"
        ),
        "customers.id": next(
            column.id for column in customers.columns if column.column_name == "id"
        ),
    }


def _post(client: Any, ids: dict[str, int]) -> Any:
    return client.post(
        "/api/v1/dataset_relationship/",
        json={
            "name": "orders to customers",
            "source_dataset_id": ids["orders"],
            "target_dataset_id": ids["customers"],
            "cardinality": "many_to_one",
            "join_type": "inner",
            "columns": [
                {
                    "source_column_id": ids["orders.customer_id"],
                    "target_column_id": ids["customers.id"],
                }
            ],
        },
    )


def test_crud(datasets: Session, client: Any, full_api_access: None) -> None:
    ids = _ids(datasets)

    response = _post(client, ids)
    assert response.status_code == 201
    relationship = response.json["result"]
    assert relationship["source_dataset_name"] == "orders"
    assert relationship["target_dataset_name"] == "customers"
    assert relationship["is_cross_database"] is False
    assert relationship["is_valid"] is True
    assert relationship["columns"][0]["source_column_name"] == "customer_id"

    pk = response.json["id"]
    response = client.put(
        f"/api/v1/dataset_relationship/{pk}",
        json={"name": "renamed", "cardinality": "one_to_many"},
    )
    assert response.status_code == 200
    assert response.json["result"]["name"] == "renamed"
    assert response.json["result"]["cardinality"] == "one_to_many"

    response = client.get(f"/api/v1/dataset_relationship/dataset/{ids['customers']}/")
    assert response.status_code == 200
    assert response.json["count"] == 1
    assert response.json["result"][0]["id"] == pk

    response = client.delete(f"/api/v1/dataset_relationship/{pk}")
    assert response.status_code == 200

    response = client.get(f"/api/v1/dataset_relationship/dataset/{ids['orders']}/")
    assert response.json["count"] == 0


def test_post_invalid_cardinality(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    ids = _ids(datasets)
    response = client.post(
        "/api/v1/dataset_relationship/",
        json={
            "source_dataset_id": ids["orders"],
            "target_dataset_id": ids["customers"],
            "cardinality": "sometimes",
            "columns": [
                {
                    "source_column_id": ids["orders.customer_id"],
                    "target_column_id": ids["customers.id"],
                }
            ],
        },
    )
    assert response.status_code == 400
    assert "cardinality" in response.json["message"]


def test_post_requires_columns(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    ids = _ids(datasets)
    response = client.post(
        "/api/v1/dataset_relationship/",
        json={
            "source_dataset_id": ids["orders"],
            "target_dataset_id": ids["customers"],
            "columns": [],
        },
    )
    assert response.status_code == 400
    assert "columns" in response.json["message"]


def test_get_by_dataset_not_found(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    response = client.get("/api/v1/dataset_relationship/dataset/123456/")
    assert response.status_code == 404


def test_dataset_detail_includes_relationships(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    ids = _ids(datasets)
    _post(client, ids)

    response = client.get(f"/api/v1/dataset/{ids['orders']}")
    assert response.status_code == 200
    relationships = response.json["result"]["relationships"]
    assert len(relationships) == 1
    assert relationships[0]["target_dataset_name"] == "customers"
