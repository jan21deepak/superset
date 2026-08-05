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
from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset.commands.dataset_relationship.base import BaseDatasetRelationshipCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipInvalidError,
    DatasetRelationshipNotFoundError,
    DatasetRelationshipUpdateFailedError,
)
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationship import DatasetRelationship
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDatasetRelationshipCommand(BaseDatasetRelationshipCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._column_pairs: list[dict[str, Any]] | None = self._properties.pop(
            "columns", None
        )
        self._model: DatasetRelationship | None = None

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipUpdateFailedError)
    )
    def run(self) -> DatasetRelationship:
        self.validate()
        assert self._model
        relationship = DatasetRelationshipDAO.update(self._model, self._properties)
        if self._column_pairs is not None:
            DatasetRelationshipDAO.replace_columns(relationship, self._column_pairs)
        return relationship

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        self._model = DatasetRelationshipDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetRelationshipNotFoundError()

        source_dataset_id = self._properties.get(
            "source_dataset_id", self._model.source_dataset_id
        )
        target_dataset_id = self._properties.get(
            "target_dataset_id", self._model.target_dataset_id
        )
        source_dataset, target_dataset = self.validate_datasets(
            source_dataset_id, target_dataset_id, exceptions
        )
        # a dataset that doesn't exist is a validation error, not a denial
        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)

        # both the current and the requested ends must be accessible
        self.raise_for_dataset_access(
            self._model.source_dataset,
            self._model.target_dataset,
            source_dataset,
            target_dataset,
        )

        column_pairs = self._column_pairs
        datasets_changed = (
            source_dataset_id != self._model.source_dataset_id
            or target_dataset_id != self._model.target_dataset_id
        )
        if column_pairs is None and datasets_changed:
            # the mapping is untouched but has to fit the new datasets
            column_pairs = [
                {
                    "source_column_id": pair.source_column_id,
                    "target_column_id": pair.target_column_id,
                    "ordinal": pair.ordinal,
                }
                for pair in self._model.columns
            ]
        if column_pairs is not None:
            self.validate_columns(
                source_dataset,
                target_dataset,
                column_pairs,
                exceptions,
                relationship_id=self._model_id,
            )

        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)

        if "source_dataset_id" in self._properties or (
            "target_dataset_id" in self._properties
        ):
            self._properties["is_cross_database"] = self.is_cross_database(
                source_dataset, target_dataset
            )
