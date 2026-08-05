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

from superset.commands.dataset_relationship.base import BaseDatasetRelationshipCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipDeleteFailedError,
    DatasetRelationshipNotFoundError,
)
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationship import DatasetRelationship
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteDatasetRelationshipCommand(BaseDatasetRelationshipCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: list[DatasetRelationship] | None = None

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipDeleteFailedError)
    )
    def run(self) -> None:
        self.validate()
        assert self._models
        DatasetRelationshipDAO.delete(self._models)

    def validate(self) -> None:
        self._models = DatasetRelationshipDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise DatasetRelationshipNotFoundError()
        for model in self._models:
            self.raise_for_dataset_access(model.source_dataset, model.target_dataset)
