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
from marshmallow import fields, Schema
from marshmallow.validate import Length, OneOf

from superset.models.dataset_relationship import (
    DatasetRelationshipCardinality,
    DatasetRelationshipJoinType,
)

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a dataset relationship"}},
    "get_list": {
        "get": {
            "summary": "Get a list of dataset relationships",
            "description": "Gets a list of dataset relationships, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"summary": "Create a dataset relationship"}},
    "put": {"put": {"summary": "Update a dataset relationship"}},
    "delete": {"delete": {"summary": "Delete a dataset relationship"}},
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}

get_delete_ids_schema = {
    "type": "array",
    "items": {"type": "integer"},
    "example": [1, 2, 3],
}

CARDINALITIES = [cardinality.value for cardinality in DatasetRelationshipCardinality]
JOIN_TYPES = [join_type.value for join_type in DatasetRelationshipJoinType]

relationship_name_description = "The name of the relationship"
relationship_description_description = "Give a description for this relationship"
cardinality_description = (
    "The cardinality from source to target. Descriptive only: it carries no "
    "execution semantics."
)
join_type_description = (
    "The join type a future query generator would use for this relationship"
)
is_active_description = "Whether the relationship is active"


class DatasetRelationshipColumnSchema(Schema):
    source_column_id = fields.Integer(required=True)
    target_column_id = fields.Integer(required=True)
    ordinal = fields.Integer(required=False, load_default=None)


class DatasetRelationshipPostSchema(Schema):
    name = fields.String(
        metadata={"description": relationship_name_description},
        required=False,
        allow_none=True,
        validate=[Length(1, 250)],
    )
    description = fields.String(
        metadata={"description": relationship_description_description},
        required=False,
        allow_none=True,
    )
    source_dataset_id = fields.Integer(required=True)
    target_dataset_id = fields.Integer(required=True)
    cardinality = fields.String(
        metadata={"description": cardinality_description},
        required=False,
        load_default=DatasetRelationshipCardinality.MANY_TO_ONE.value,
        validate=[OneOf(choices=CARDINALITIES)],
    )
    join_type = fields.String(
        metadata={"description": join_type_description},
        required=False,
        load_default=DatasetRelationshipJoinType.INNER.value,
        validate=[OneOf(choices=JOIN_TYPES)],
    )
    is_active = fields.Boolean(
        metadata={"description": is_active_description},
        required=False,
        load_default=True,
    )
    columns = fields.List(
        fields.Nested(DatasetRelationshipColumnSchema),
        required=True,
        validate=[Length(min=1)],
    )


class DatasetRelationshipPutSchema(Schema):
    name = fields.String(
        metadata={"description": relationship_name_description},
        required=False,
        allow_none=True,
        validate=[Length(1, 250)],
    )
    description = fields.String(
        metadata={"description": relationship_description_description},
        required=False,
        allow_none=True,
    )
    source_dataset_id = fields.Integer(required=False)
    target_dataset_id = fields.Integer(required=False)
    cardinality = fields.String(
        metadata={"description": cardinality_description},
        required=False,
        validate=[OneOf(choices=CARDINALITIES)],
    )
    join_type = fields.String(
        metadata={"description": join_type_description},
        required=False,
        validate=[OneOf(choices=JOIN_TYPES)],
    )
    is_active = fields.Boolean(
        metadata={"description": is_active_description}, required=False
    )
    columns = fields.List(
        fields.Nested(DatasetRelationshipColumnSchema),
        required=False,
        validate=[Length(min=1)],
    )


class DatasetRelationshipColumnResponseSchema(Schema):
    id = fields.Integer()
    source_column_id = fields.Integer()
    target_column_id = fields.Integer()
    source_column_name = fields.String()
    target_column_name = fields.String()
    ordinal = fields.Integer()


class DatasetRelationshipResponseSchema(Schema):
    id = fields.Integer()
    uuid = fields.String()
    name = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    source_dataset_id = fields.Integer()
    target_dataset_id = fields.Integer()
    source_dataset_name = fields.String()
    target_dataset_name = fields.String()
    cardinality = fields.String()
    join_type = fields.String()
    is_cross_database = fields.Boolean()
    is_active = fields.Boolean()
    is_valid = fields.Boolean()
    columns = fields.List(fields.Nested(DatasetRelationshipColumnResponseSchema))
