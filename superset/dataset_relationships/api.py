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
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.dataset_relationship.create import (
    CreateDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.delete import (
    DeleteDatasetRelationshipCommand,
)
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipCreateFailedError,
    DatasetRelationshipDeleteFailedError,
    DatasetRelationshipInvalidError,
    DatasetRelationshipNotFoundError,
    DatasetRelationshipUpdateFailedError,
)
from superset.commands.dataset_relationship.update import (
    UpdateDatasetRelationshipCommand,
)
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.dataset_relationships.filters import (
    DatasetRelationshipAccessFilter,
    DatasetRelationshipAllTextFilter,
)
from superset.dataset_relationships.schemas import (
    DatasetRelationshipPostSchema,
    DatasetRelationshipPutSchema,
    DatasetRelationshipResponseSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.dataset_relationships.utils import (
    dataset_relationship_to_dict,
    get_visible_dataset_relationships,
    get_visible_relationships,
)
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.models.dataset_relationship import DatasetRelationship
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class DatasetRelationshipRestApi(BaseSupersetModelRestApi):
    """
    CRUD for relationships between datasets.

    Relationships are inert metadata: they are never used to generate or
    rewrite queries, and declaring one grants access to nothing.
    """

    datamodel = SQLAInterface(DatasetRelationship)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",
        "get_by_dataset",
        "get_graph",
    }
    class_permission_name = "Dataset"
    method_permission_name = {
        **MODEL_API_RW_METHOD_PERMISSION_MAP,
        "get_by_dataset": "read",
        "get_graph": "read",
    }

    resource_name = "dataset_relationship"
    allow_browser_login = True

    base_filters = [["id", DatasetRelationshipAccessFilter, lambda: []]]

    show_columns = [
        "id",
        "uuid",
        "name",
        "description",
        "source_dataset_id",
        "source_dataset.table_name",
        "target_dataset_id",
        "target_dataset.table_name",
        "cardinality",
        "join_type",
        "is_cross_database",
        "is_active",
        "columns.id",
        "columns.source_column_id",
        "columns.target_column_id",
        "columns.ordinal",
    ]
    list_columns = show_columns + [
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.last_name",
    ]
    add_columns = [
        "name",
        "description",
        "source_dataset_id",
        "target_dataset_id",
        "cardinality",
        "join_type",
        "is_active",
    ]
    edit_columns = add_columns
    add_model_schema = DatasetRelationshipPostSchema()
    edit_model_schema = DatasetRelationshipPutSchema()

    order_columns = [
        "name",
        "cardinality",
        "join_type",
        "changed_on_delta_humanized",
    ]
    search_columns = [
        "name",
        "source_dataset_id",
        "target_dataset_id",
        "cardinality",
        "join_type",
        "is_active",
        "is_cross_database",
    ]
    search_filters = {"name": [DatasetRelationshipAllTextFilter]}
    allowed_rel_fields = {"created_by", "changed_by"}

    openapi_spec_component_schemas = (DatasetRelationshipResponseSchema,)
    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "Dataset Relationships"
    openapi_spec_methods = openapi_spec_methods_override

    @expose("/graph/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("get")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_graph",
        log_to_statsd=False,
    )
    def get_graph(self) -> Response:
        """Get every visible relationship, in the shape the canvas renders.
        ---
        get:
          summary: Get every relationship the user can see
          description: >-
            Unlike the list endpoint, relationships are serialized with resolved
            dataset and column names and a validity flag, which is what the
            relationship canvas draws.
          responses:
            200:
              description: A list of dataset relationships
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: number
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/DatasetRelationshipResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        result = get_visible_relationships(DatasetRelationshipDAO.find_all())
        return self.response(200, count=len(result), result=result)

    @expose("/dataset/<int:pk>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("get")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".get_by_dataset",
        log_to_statsd=False,
    )
    def get_by_dataset(self, pk: int) -> Response:
        """Get the relationships of a dataset.
        ---
        get:
          summary: Get the relationships where the dataset is either end
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset id
          responses:
            200:
              description: A list of dataset relationships
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: number
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/DatasetRelationshipResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        datasets = DatasetRelationshipDAO.find_datasets([pk])
        if pk not in datasets:
            return self.response_404()
        try:
            security_manager.raise_for_access(datasource=datasets[pk])
        except SupersetSecurityException as ex:
            return self.response_403(message=str(ex))
        result = get_visible_dataset_relationships(pk)
        return self.response(200, count=len(result), result=result)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("post")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a new dataset relationship.
        ---
        post:
          summary: Create a new dataset relationship
          requestBody:
            description: Dataset relationship schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dataset relationship added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/DatasetRelationshipResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreateDatasetRelationshipCommand(item).run()
            return self.response(
                201, id=new_model.id, result=dataset_relationship_to_dict(new_model)
            )
        except SupersetSecurityException as ex:
            return self.response_403(message=str(ex))
        except DatasetRelationshipInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetRelationshipCreateFailedError as ex:
            logger.error(
                "Error creating dataset relationship %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("put")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a dataset relationship.
        ---
        put:
          summary: Update a dataset relationship
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset relationship id
          requestBody:
            description: Dataset relationship schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Dataset relationship changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/DatasetRelationshipResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            model = UpdateDatasetRelationshipCommand(pk, item).run()
            return self.response(
                200, id=model.id, result=dataset_relationship_to_dict(model)
            )
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except SupersetSecurityException as ex:
            return self.response_403(message=str(ex))
        except DatasetRelationshipInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except DatasetRelationshipUpdateFailedError as ex:
            logger.error(
                "Error updating dataset relationship %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("delete")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a dataset relationship.
        ---
        delete:
          summary: Delete a dataset relationship
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The dataset relationship id
          responses:
            200:
              description: Item deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeleteDatasetRelationshipCommand([pk]).run()
            return self.response(200, message="OK")
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except SupersetSecurityException as ex:
            return self.response_403(message=str(ex))
        except DatasetRelationshipDeleteFailedError as ex:
            logger.error(
                "Error deleting dataset relationship %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete dataset relationships.
        ---
        delete:
          summary: Delete multiple dataset relationships in a bulk operation
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: Dataset relationships bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            DeleteDatasetRelationshipCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d dataset relationship",
                    "Deleted %(num)d dataset relationships",
                    num=len(item_ids),
                ),
            )
        except DatasetRelationshipNotFoundError:
            return self.response_404()
        except SupersetSecurityException as ex:
            return self.response_403(message=str(ex))
        except DatasetRelationshipDeleteFailedError as ex:
            return self.response_422(message=str(ex))
