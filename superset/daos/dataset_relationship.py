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
from typing import Any

from sqlalchemy import or_

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.dataset_relationship import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)

logger = logging.getLogger(__name__)


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
        column_pairs: list[tuple[int, int]],
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
        existing = {tuple(sorted(rel.column_pairs)) for rel in query.all()}
        return tuple(sorted(column_pairs)) not in existing

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
