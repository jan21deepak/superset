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
    DatasetRelationshipCreateFailedError,
    DatasetRelationshipInvalidError,
)
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationship import DatasetRelationship
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDatasetRelationshipCommand(BaseDatasetRelationshipCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._column_pairs: list[dict[str, Any]] = self._properties.pop("columns", [])

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipCreateFailedError)
    )
    def run(self) -> DatasetRelationship:
        self.validate()
        return DatasetRelationshipDAO.create_relationship(
            self._properties, self._column_pairs
        )

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        source_dataset, target_dataset = self.validate_datasets(
            self._properties["source_dataset_id"],
            self._properties["target_dataset_id"],
            exceptions,
        )
        # a dataset that doesn't exist is a validation error, not a denial
        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)

        self.raise_for_dataset_access(source_dataset, target_dataset)
        self.validate_columns(
            source_dataset, target_dataset, self._column_pairs, exceptions
        )

        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)

        self._properties["is_cross_database"] = self.is_cross_database(
            source_dataset, target_dataset
        )
