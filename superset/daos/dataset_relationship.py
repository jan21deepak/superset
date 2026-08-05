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
from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import joinedload, selectinload

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.core import Database
from superset.models.dataset_relationship import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)
from superset.utils.filters import get_dataset_access_filters

logger = logging.getLogger(__name__)


def _complete_mapping(
    pairs: Sequence[tuple[int | None, int | None]],
) -> tuple[tuple[int, int], ...] | None:
    """
    The mapping as a comparable key, or None when a column has been dropped.
    """
    complete = [
        (source, target)
        for source, target in pairs
        if source is not None and target is not None
    ]
    if len(complete) != len(pairs):
        return None
    return tuple(sorted(complete))


class DatasetRelationshipDAO(BaseDAO[DatasetRelationship]):
    @staticmethod
    def find_by_dataset(dataset_id: int) -> list[DatasetRelationship]:
        """
        Return every relationship where the dataset is either end.
        """
        return (
            db.session.query(DatasetRelationship)
            .filter(
                or_(
                    DatasetRelationship.source_dataset_id == dataset_id,
                    DatasetRelationship.target_dataset_id == dataset_id,
                )
            )
            .all()
        )

    @staticmethod
    def find_accessible(limit: int) -> list[DatasetRelationship]:
        """
        Relationships both of whose datasets the user can read, with the
        datasets and columns the canvas renders eagerly loaded.
        """
        query = db.session.query(DatasetRelationship).options(
            joinedload(DatasetRelationship.source_dataset),
            joinedload(DatasetRelationship.target_dataset),
            selectinload(DatasetRelationship.columns).joinedload(
                DatasetRelationshipColumn.source_column
            ),
            selectinload(DatasetRelationship.columns).joinedload(
                DatasetRelationshipColumn.target_column
            ),
        )
        if not security_manager.can_access_all_datasources():
            dataset_ids = (
                db.session.query(SqlaTable.id)
                .join(Database, Database.id == SqlaTable.database_id)
                .filter(get_dataset_access_filters(SqlaTable))
            )
            query = query.filter(
                DatasetRelationship.source_dataset_id.in_(dataset_ids),
                DatasetRelationship.target_dataset_id.in_(dataset_ids),
            )
        # ordered so that the cap truncates the same way on every call
        return query.order_by(DatasetRelationship.id).limit(limit).all()

    @staticmethod
    def find_datasets(dataset_ids: list[int]) -> dict[int, SqlaTable]:
        datasets = (
            db.session.query(SqlaTable).filter(SqlaTable.id.in_(dataset_ids)).all()
        )
        return {dataset.id: dataset for dataset in datasets}

    @staticmethod
    def find_columns(column_ids: list[int]) -> dict[int, TableColumn]:
        columns = (
            db.session.query(TableColumn).filter(TableColumn.id.in_(column_ids)).all()
        )
        return {column.id: column for column in columns}

    @staticmethod
    def validate_column_mapping_uniqueness(
        source_dataset_id: int,
        target_dataset_id: int,
        column_pairs: Sequence[tuple[int | None, int | None]],
        relationship_id: int | None = None,
    ) -> bool:
        """
        Multiple relationships between the same pair of datasets are allowed;
        uniqueness is enforced on the column mapping instead.

        :param relationship_id: excluded from the check, for updates
        """
        query = db.session.query(DatasetRelationship).filter(
            DatasetRelationship.source_dataset_id == source_dataset_id,
            DatasetRelationship.target_dataset_id == target_dataset_id,
        )
        if relationship_id:
            query = query.filter(DatasetRelationship.id != relationship_id)
        # a mapping with a dropped column can't clash with anything
        mapping = _complete_mapping(column_pairs)
        if mapping is None:
            return True
        existing = {
            existing_mapping
            for rel in query.all()
            if (existing_mapping := _complete_mapping(rel.column_pairs)) is not None
        }
        return mapping not in existing

    @classmethod
    def create_relationship(
        cls,
        properties: dict[str, Any],
        column_pairs: list[dict[str, Any]],
    ) -> DatasetRelationship:
        relationship = cls.create(attributes=properties)
        cls.replace_columns(relationship, column_pairs)
        return relationship

    @staticmethod
    def replace_columns(
        relationship: DatasetRelationship,
        column_pairs: list[dict[str, Any]],
    ) -> None:
        # flush the removals before the inserts, so that reusing an ordinal
        # doesn't trip the (relationship, ordinal) uniqueness constraint
        relationship.columns = []
        db.session.flush()
        # the ordinal is the position in the list: deriving it keeps it unique
        relationship.columns = [
            DatasetRelationshipColumn(
                source_column_id=pair["source_column_id"],
                target_column_id=pair["target_column_id"],
                ordinal=ordinal,
            )
            for ordinal, pair in enumerate(column_pairs)
        ]
        db.session.flush()
