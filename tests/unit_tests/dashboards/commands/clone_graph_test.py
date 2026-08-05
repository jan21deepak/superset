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

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import yaml

from superset.commands.dashboard.clone_graph import CloneDashboardGraphCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardInvalidError,
)
from superset.commands.export.models import METADATA_FILE_NAME

DASHBOARD_UUID = "11111111-1111-1111-1111-111111111111"
CHART_UUID = "22222222-2222-2222-2222-222222222222"
DATASET_UUID = "33333333-3333-3333-3333-333333333333"
DATABASE_UUID = "44444444-4444-4444-4444-444444444444"


def _make_bundle() -> dict[str, str]:
    dashboard = {
        "uuid": DASHBOARD_UUID,
        "dashboard_title": "Sales",
        "slug": "sales",
        "position": {
            "CHART-abc": {
                "type": "CHART",
                "meta": {"uuid": CHART_UUID, "chartId": 7},
            }
        },
        "metadata": {
            "native_filter_configuration": [
                {"targets": [{"datasetUuid": DATASET_UUID}]}
            ]
        },
        "version": "1.0.0",
    }
    chart = {
        "uuid": CHART_UUID,
        "slice_name": "Revenue",
        "dataset_uuid": DATASET_UUID,
        "version": "1.0.0",
    }
    dataset = {
        "uuid": DATASET_UUID,
        "table_name": "sales_fact",
        "database_uuid": DATABASE_UUID,
        "version": "1.0.0",
    }
    database = {
        "uuid": DATABASE_UUID,
        "database_name": "warehouse",
        "version": "1.0.0",
    }
    return {
        METADATA_FILE_NAME: yaml.safe_dump({"type": "Dashboard"}),
        "dashboards/Sales.yaml": yaml.safe_dump(dashboard),
        "charts/Revenue.yaml": yaml.safe_dump(chart),
        "datasets/sales_fact.yaml": yaml.safe_dump(dataset),
        "databases/warehouse.yaml": yaml.safe_dump(database),
    }


def _remap() -> tuple[CloneDashboardGraphCommand, dict[str, dict[str, Any]]]:
    command = CloneDashboardGraphCommand(MagicMock(), "v2")
    contents = command._remap_bundle(_make_bundle())
    configs = {
        name: yaml.safe_load(raw)
        for name, raw in contents.items()
        if name != METADATA_FILE_NAME
    }
    return command, configs


def test_clone_graph_assigns_fresh_uuids_to_graph_objects() -> None:
    command, configs = _remap()

    dashboard = configs["dashboards/Sales.yaml"]
    chart = configs["charts/Revenue.yaml"]
    dataset = configs["datasets/sales_fact.yaml"]
    database = configs["databases/warehouse.yaml"]

    # dashboard, chart and dataset get fresh, distinct UUIDs
    assert dashboard["uuid"] != DASHBOARD_UUID
    assert chart["uuid"] != CHART_UUID
    assert dataset["uuid"] != DATASET_UUID
    assert len({dashboard["uuid"], chart["uuid"], dataset["uuid"]}) == 3

    # the database connection UUID is preserved (shared across versions)
    assert database["uuid"] == DATABASE_UUID

    # the command records the new dashboard UUID so it can be looked up
    assert command._new_dashboard_uuid == dashboard["uuid"]


def test_clone_graph_rewires_cross_references() -> None:
    _, configs = _remap()

    dashboard = configs["dashboards/Sales.yaml"]
    chart = configs["charts/Revenue.yaml"]
    dataset = configs["datasets/sales_fact.yaml"]

    # position chart reference points at the cloned chart
    assert dashboard["position"]["CHART-abc"]["meta"]["uuid"] == chart["uuid"]
    # chart -> dataset reference points at the cloned dataset
    assert chart["dataset_uuid"] == dataset["uuid"]
    # native filter dataset reference points at the cloned dataset
    native_target = dashboard["metadata"]["native_filter_configuration"][0]["targets"][
        0
    ]
    assert native_target["datasetUuid"] == dataset["uuid"]
    # cloned dataset still points at the shared database
    assert dataset["database_uuid"] == DATABASE_UUID


def test_clone_graph_relabels_dashboard_and_datasets() -> None:
    _, configs = _remap()

    dashboard = configs["dashboards/Sales.yaml"]
    dataset = configs["datasets/sales_fact.yaml"]

    assert dashboard["dashboard_title"] == "Sales (v2)"
    # slug is dropped to avoid the global active-slug uniqueness constraint
    assert dashboard["slug"] is None
    # dataset name is suffixed to avoid the
    # (database, catalog, schema, table_name) uniqueness constraint
    assert dataset["table_name"] == "sales_fact (v2)"


@patch("superset.commands.dashboard.clone_graph.security_manager")
def test_validate_rejects_blank_version_label(security_manager: MagicMock) -> None:
    security_manager.is_editor = MagicMock(return_value=True)
    with pytest.raises(DashboardInvalidError):
        CloneDashboardGraphCommand(MagicMock(), "   ").validate()


@patch("superset.commands.dashboard.clone_graph.security_manager")
def test_validate_rejects_non_editor(security_manager: MagicMock) -> None:
    security_manager.is_editor = MagicMock(return_value=False)
    with pytest.raises(DashboardForbiddenError):
        CloneDashboardGraphCommand(MagicMock(), "v2").validate()
