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

from typing import Any

from superset import security_manager
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dataset_relationship import DatasetRelationship


def is_relationship_visible(relationship: DatasetRelationship) -> bool:
    """
    Relationships are visible only to users who can read *both* datasets.

    An endpoint the user cannot read hides the relationship entirely rather than
    partially exposing it. An end that can't be resolved at all (a soft-deleted
    dataset, say) is hidden too: there is nothing to check access against.
    """
    if relationship.source_dataset is None or relationship.target_dataset is None:
        return False
    try:
        security_manager.raise_for_access(datasource=relationship.source_dataset)
        security_manager.raise_for_access(datasource=relationship.target_dataset)
    except SupersetSecurityException:
        return False
    return True


def get_visible_relationships(
    relationships: list[DatasetRelationship],
) -> list[dict[str, Any]]:
    """
    Serialize the relationships the current user is allowed to see.
    """
    return [
        dataset_relationship_to_dict(relationship)
        for relationship in relationships
        if is_relationship_visible(relationship)
    ]


def get_visible_dataset_relationships(dataset_id: int) -> list[dict[str, Any]]:
    """
    The relationships of a dataset the current user is allowed to see.
    """
    return get_visible_relationships(DatasetRelationshipDAO.find_by_dataset(dataset_id))


def dataset_relationship_to_dict(relationship: DatasetRelationship) -> dict[str, Any]:
    """
    Serialize a relationship, resolving dataset and column names for display.
    """
    return {
        "id": relationship.id,
        "uuid": str(relationship.uuid) if relationship.uuid else None,
        "name": relationship.name,
        "description": relationship.description,
        "source_dataset_id": relationship.source_dataset_id,
        "target_dataset_id": relationship.target_dataset_id,
        "source_dataset_name": (
            relationship.source_dataset.table_name
            if relationship.source_dataset
            else None
        ),
        "target_dataset_name": (
            relationship.target_dataset.table_name
            if relationship.target_dataset
            else None
        ),
        "cardinality": relationship.cardinality,
        "join_type": relationship.join_type,
        "is_cross_database": relationship.is_cross_database,
        "is_active": relationship.is_active,
        "is_valid": relationship.is_valid,
        "columns": [
            {
                "id": pair.id,
                "source_column_id": pair.source_column_id,
                "target_column_id": pair.target_column_id,
                "source_column_name": (
                    pair.source_column.column_name if pair.source_column else None
                ),
                "target_column_name": (
                    pair.target_column.column_name if pair.target_column else None
                ),
                "ordinal": pair.ordinal,
            }
            for pair in relationship.columns
        ],
    }
