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
# pylint: disable=unused-argument, import-outside-toplevel

from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationship import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)


def _relationship(session: Session) -> DatasetRelationship:
    orders = session.query(SqlaTable).filter_by(table_name="orders").one()
    customers = session.query(SqlaTable).filter_by(table_name="customers").one()
    relationship = DatasetRelationship(
        source_dataset_id=orders.id,
        target_dataset_id=customers.id,
        cardinality="many_to_one",
        join_type="inner",
        is_cross_database=False,
        is_active=True,
        columns=[
            DatasetRelationshipColumn(
                source_column_id=next(
                    column.id
                    for column in orders.columns
                    if column.column_name == "customer_id"
                ),
                target_column_id=customers.columns[0].id,
                ordinal=0,
            )
        ],
    )
    session.add(relationship)
    session.flush()
    return relationship


def test_is_valid(datasets: Session) -> None:
    assert _relationship(datasets).is_valid is True


def test_is_valid_without_columns(datasets: Session) -> None:
    relationship = _relationship(datasets)
    relationship.columns = []
    datasets.flush()

    assert relationship.is_valid is False


def test_dropping_a_column_flags_the_relationship(datasets: Session) -> None:
    """
    Column pairs cascade away with the column, leaving the relationship
    dangling rather than silently pointing at a column that no longer exists.
    """
    from superset.connectors.sqla.models import TableColumn

    relationship = _relationship(datasets)
    column = datasets.query(TableColumn).get(relationship.columns[0].source_column_id)
    datasets.delete(column)
    datasets.flush()
    datasets.expire(relationship)

    assert relationship.is_valid is False


def test_find_by_dataset_matches_either_end(datasets: Session) -> None:
    relationship = _relationship(datasets)

    assert DatasetRelationshipDAO.find_by_dataset(relationship.source_dataset_id) == [
        relationship
    ]
    assert DatasetRelationshipDAO.find_by_dataset(relationship.target_dataset_id) == [
        relationship
    ]


def test_column_mapping_uniqueness(datasets: Session) -> None:
    relationship = _relationship(datasets)
    pairs = relationship.column_pairs

    assert not DatasetRelationshipDAO.validate_column_mapping_uniqueness(
        relationship.source_dataset_id, relationship.target_dataset_id, pairs
    )
    # the relationship being updated doesn't collide with itself
    assert DatasetRelationshipDAO.validate_column_mapping_uniqueness(
        relationship.source_dataset_id,
        relationship.target_dataset_id,
        pairs,
        relationship_id=relationship.id,
    )
