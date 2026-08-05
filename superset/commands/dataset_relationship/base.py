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

from flask_babel import lazy_gettext as _
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipColumnNotFoundValidationError,
    DatasetRelationshipColumnsUniquenessValidationError,
    DatasetRelationshipDatasetNotFoundValidationError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

logger = logging.getLogger(__name__)


class BaseDatasetRelationshipCommand(BaseCommand):
    """
    Shared validation for the relationship write commands.

    Declaring a relationship never grants access to anything: writing one
    requires access to *both* datasets involved.
    """

    def run(self) -> Any:
        raise NotImplementedError()

    def validate(self) -> None:
        raise NotImplementedError()

    def validate_datasets(
        self,
        source_dataset_id: int,
        target_dataset_id: int,
        exceptions: list[ValidationError],
    ) -> tuple[SqlaTable | None, SqlaTable | None]:
        datasets = DatasetRelationshipDAO.find_datasets(
            [source_dataset_id, target_dataset_id]
        )
        source_dataset = datasets.get(source_dataset_id)
        target_dataset = datasets.get(target_dataset_id)
        if not source_dataset:
            exceptions.append(
                DatasetRelationshipDatasetNotFoundValidationError("source_dataset_id")
            )
        if not target_dataset:
            exceptions.append(
                DatasetRelationshipDatasetNotFoundValidationError("target_dataset_id")
            )
        return source_dataset, target_dataset

    @staticmethod
    def raise_for_dataset_access(*datasets: SqlaTable | None) -> None:
        """
        An end that can't be resolved (a soft-deleted dataset, say) is denied
        rather than skipped: there is nothing left to check access against.
        """
        for dataset in datasets:
            if dataset is None:
                raise SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                        message=_(
                            "One of the datasets of this relationship is not accessible"
                        ),
                        level=ErrorLevel.ERROR,
                    )
                )
            security_manager.raise_for_access(datasource=dataset)

    def validate_columns(  # pylint: disable=too-many-arguments
        self,
        source_dataset: SqlaTable | None,
        target_dataset: SqlaTable | None,
        column_pairs: list[dict[str, Any]],
        exceptions: list[ValidationError],
        relationship_id: int | None = None,
    ) -> None:
        if not column_pairs:
            exceptions.append(
                DatasetRelationshipColumnNotFoundValidationError(
                    _("At least one column pair is required")
                )
            )
            return
        if not source_dataset or not target_dataset:
            return

        column_ids = [
            column_id
            for pair in column_pairs
            for column_id in (pair["source_column_id"], pair["target_column_id"])
        ]
        columns = DatasetRelationshipDAO.find_columns(column_ids)
        for pair in column_pairs:
            for key, dataset in (
                ("source_column_id", source_dataset),
                ("target_column_id", target_dataset),
            ):
                column = columns.get(pair[key])
                if column is None:
                    exceptions.append(
                        DatasetRelationshipColumnNotFoundValidationError(
                            _("Column %(id)s does not exist", id=pair[key])
                        )
                    )
                elif column.table_id != dataset.id:
                    exceptions.append(
                        DatasetRelationshipColumnNotFoundValidationError(
                            _(
                                "Column %(name)s does not belong to dataset "
                                "%(dataset)s",
                                name=column.column_name,
                                dataset=dataset.table_name,
                            )
                        )
                    )

        if not DatasetRelationshipDAO.validate_column_mapping_uniqueness(
            source_dataset.id,
            target_dataset.id,
            [
                (pair["source_column_id"], pair["target_column_id"])
                for pair in column_pairs
            ],
            relationship_id=relationship_id,
        ):
            exceptions.append(DatasetRelationshipColumnsUniquenessValidationError())

    @staticmethod
    def is_cross_database(
        source_dataset: SqlaTable | None, target_dataset: SqlaTable | None
    ) -> bool:
        if not source_dataset or not target_dataset:
            return False
        return source_dataset.database_id != target_dataset.database_id
