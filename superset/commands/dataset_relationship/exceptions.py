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
from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    UpdateFailedError,
    ValidationError,
)


class DatasetRelationshipInvalidError(CommandInvalidError):
    message = _("Dataset relationship parameters are invalid.")


class DatasetRelationshipCreateFailedError(CreateFailedError):
    message = _("Dataset relationship could not be created.")


class DatasetRelationshipUpdateFailedError(UpdateFailedError):
    message = _("Dataset relationship could not be updated.")


class DatasetRelationshipDeleteFailedError(DeleteFailedError):
    message = _("Dataset relationships could not be deleted.")


class DatasetRelationshipNotFoundError(CommandException):
    message = _("Dataset relationship not found.")


class DatasetRelationshipDatasetNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for a relationship end pointing at a
    dataset that doesn't exist
    """

    def __init__(self, field_name: str) -> None:
        super().__init__([_("Dataset does not exist")], field_name=field_name)


class DatasetRelationshipColumnNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for a column pair pointing at a column that
    doesn't exist, or that doesn't belong to the dataset on its end
    """

    def __init__(self, message: str) -> None:
        super().__init__([message], field_name="columns")


class DatasetRelationshipColumnsUniquenessValidationError(ValidationError):
    """
    Marshmallow validation error for a duplicated column mapping between the
    same pair of datasets
    """

    def __init__(self) -> None:
        super().__init__(
            [
                _(
                    "A relationship between these datasets with the same column "
                    "mapping already exists"
                )
            ],
            field_name="columns",
        )
