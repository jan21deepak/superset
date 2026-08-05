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

import logging
from functools import partial
from typing import Any, Optional
from uuid import uuid4

import yaml

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import (
    DashboardCloneError,
    DashboardForbiddenError,
    DashboardInvalidError,
)
from superset.commands.dashboard.export import ExportDashboardsCommand
from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
from superset.commands.export.models import METADATA_FILE_NAME
from superset.models.dashboard import Dashboard
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)

# Object families whose UUIDs are freshened when cloning a graph. Databases
# (and themes) are intentionally excluded: a connection is neither version- nor
# tenant-specific, so every version shares one database connection.
_REMAPPED_PREFIXES = ("dashboards/", "charts/", "datasets/")


class CloneDashboardGraphCommand(BaseCommand):
    """Atomically clone a dashboard's full object graph as a new version.

    This is the minimum viable primitive behind per-audience dashboard
    versions (issue #56 / SIP-221): it exports the dashboard together with the
    charts and datasets it depends on, rewrites the UUIDs of the
    dashboard/charts/datasets to fresh values, and re-imports the remapped
    bundle. Because Superset's import keeps object graphs with distinct UUIDs
    fully isolated, the result is a self-contained parallel variant — editing a
    cloned chart or dataset never mutates the source version, so different
    audiences (tenants / guest tokens / embeds) can be pinned to different live
    versions simultaneously and indefinitely.

    Only the database connection is shared across versions: database (and
    theme) UUIDs are preserved so the clone reuses the existing connection
    rather than duplicating it.
    """

    def __init__(self, dashboard: Dashboard, version_label: str) -> None:
        self._dashboard = dashboard
        self._version_label = version_label.strip() if version_label else ""
        self._new_dashboard_uuid: Optional[str] = None

    @transaction(on_error=partial(on_error, reraise=DashboardCloneError))
    def run(self) -> Dashboard:
        self.validate()
        bundle = self._export_bundle()
        contents = self._remap_bundle(bundle)
        ImportDashboardsCommand(contents, overwrite=False).run()

        new_dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.uuid == self._new_dashboard_uuid)
            .one_or_none()
        )
        if new_dashboard is None:
            raise DashboardCloneError()
        return new_dashboard

    def validate(self) -> None:
        if not self._version_label:
            raise DashboardInvalidError()
        if not security_manager.is_editor(self._dashboard):
            raise DashboardForbiddenError()

    def _export_bundle(self) -> dict[str, str]:
        return {
            file_name: file_content()
            for file_name, file_content in ExportDashboardsCommand(
                [self._dashboard.id]
            ).run()
        }

    def _remap_bundle(self, bundle: dict[str, str]) -> dict[str, str]:
        # Collect the UUIDs to freshen (dashboard, charts, datasets) and load
        # each config once.
        uuid_map: dict[str, str] = {}
        configs: dict[str, dict[str, Any]] = {}
        for file_name, raw in bundle.items():
            if file_name == METADATA_FILE_NAME:
                continue
            config = yaml.safe_load(raw)
            configs[file_name] = config
            if file_name.startswith(_REMAPPED_PREFIXES):
                uuid_map[str(config["uuid"])] = str(uuid4())

        # Apply human-facing labels at the config level so the cloned graph is
        # distinguishable and never trips the
        # (database, catalog, schema, table_name) uniqueness constraint.
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                self._new_dashboard_uuid = uuid_map[str(config["uuid"])]
                title = config.get("dashboard_title") or "Dashboard"
                config["dashboard_title"] = f"{title} ({self._version_label})"
                # A slug is globally unique among active dashboards, so a clone
                # must not reuse it.
                config["slug"] = None
            elif file_name.startswith("datasets/"):
                config["table_name"] = f"{config['table_name']} ({self._version_label})"

        # Serialize, then rewrite every UUID token across all files. UUIDs are
        # opaque, globally unique tokens, so a textual replacement safely
        # rewires all cross-references (position chart uuids, chart ->
        # dataset_uuid, native-filter datasetUuid, ...) without needing to
        # enumerate each reference site.
        contents: dict[str, str] = {}
        for file_name, config in configs.items():
            raw = yaml.safe_dump(config, sort_keys=False, allow_unicode=True)
            for old_uuid, new_uuid in uuid_map.items():
                raw = raw.replace(old_uuid, new_uuid)
            contents[file_name] = raw
        contents[METADATA_FILE_NAME] = bundle[METADATA_FILE_NAME]
        return contents
