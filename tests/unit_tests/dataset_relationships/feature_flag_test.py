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
    [{"FEATURE_FLAGS": {"DATASET_RELATIONSHIPS": False}}],
    indirect=True,
)


def test_api_is_not_registered(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    """
    ``DATASET_RELATIONSHIPS`` defaults to off, so the API doesn't exist.
    """
    response = client.get("/api/v1/dataset_relationship/")
    assert response.status_code == 404


def test_dataset_detail_has_no_relationships(
    datasets: Session, client: Any, full_api_access: None
) -> None:
    orders = datasets.query(SqlaTable).filter_by(table_name="orders").one()

    response = client.get(f"/api/v1/dataset/{orders.id}")
    assert response.status_code == 200
    assert "relationships" not in response.json["result"]
