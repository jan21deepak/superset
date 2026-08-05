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

from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.orm.query import Query

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dataset_relationship import DatasetRelationship
from superset.utils.filters import get_dataset_access_filters
from superset.views.base import BaseFilter


def accessible_dataset_ids_query() -> Query:
    from superset.extensions import db  # noqa: PLC0415

    return (
        db.session.query(SqlaTable.id)
        .join(Database, Database.id == SqlaTable.database_id)
        .filter(get_dataset_access_filters(SqlaTable))
    )


class DatasetRelationshipAccessFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Relationships are visible only to users who can read *both* datasets.

    A relationship never grants access to anything, so an endpoint the user cannot
    read hides the relationship entirely rather than partially exposing it.
    """

    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query
        dataset_ids = accessible_dataset_ids_query()
        return query.filter(
            DatasetRelationship.source_dataset_id.in_(dataset_ids),
            DatasetRelationship.target_dataset_id.in_(dataset_ids),
        )


class DatasetRelationshipAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "relationship_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                DatasetRelationship.name.ilike(ilike_value),
                DatasetRelationship.description.ilike(ilike_value),
            )
        )
