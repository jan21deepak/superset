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
"""Models describing relationships between datasets.

Relationships are inert, descriptive metadata: declaring one changes nothing
about how queries are generated or executed.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import backref, Mapped, relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.utils.backports import StrEnum

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, TableColumn


class DatasetRelationshipCardinality(StrEnum):
    """
    Cardinality of a relationship, from source to target.

    Purely descriptive; it carries no execution semantics.
    """

    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_ONE = "many_to_one"
    MANY_TO_MANY = "many_to_many"


class DatasetRelationshipJoinType(StrEnum):
    """
    The join type a future query generator would use for this relationship.
    """

    INNER = "inner"
    LEFT = "left"
    RIGHT = "right"
    FULL = "full"


class DatasetRelationship(Model, AuditMixinNullable, UUIDMixin):
    """A declared relationship between two datasets"""

    __tablename__ = "dataset_relationships"

    id = Column(Integer, primary_key=True)
    name = Column(String(250), nullable=True)
    description = Column(Text, nullable=True)
    source_dataset_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False
    )
    target_dataset_id = Column(
        Integer, ForeignKey("tables.id", ondelete="CASCADE"), nullable=False
    )
    cardinality = Column(
        String(50),
        nullable=False,
        default=DatasetRelationshipCardinality.MANY_TO_ONE.value,
    )
    join_type = Column(
        String(50), nullable=False, default=DatasetRelationshipJoinType.INNER.value
    )
    # auto-detected on save; cross-database relationships can be declared and
    # visualized, but carry no execution semantics
    is_cross_database = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # the backrefs defer to the database cascade: without passive_deletes the ORM
    # would try to null out the non-nullable FKs when a dataset is deleted
    source_dataset: Mapped[SqlaTable] = relationship(
        "SqlaTable",
        foreign_keys=[source_dataset_id],
        backref=backref(
            "outgoing_relationships",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
    )
    target_dataset: Mapped[SqlaTable] = relationship(
        "SqlaTable",
        foreign_keys=[target_dataset_id],
        backref=backref(
            "incoming_relationships",
            cascade="all, delete-orphan",
            passive_deletes=True,
        ),
    )
    columns: Mapped[list[DatasetRelationshipColumn]] = relationship(
        "DatasetRelationshipColumn",
        back_populates="dataset_relationship",
        cascade="all, delete-orphan",
        order_by="DatasetRelationshipColumn.ordinal",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return str(self.name or f"{self.source_dataset_id}->{self.target_dataset_id}")

    @property
    def is_valid(self) -> bool:
        """
        Whether every declared column pair still points at existing columns
        belonging to the datasets of the relationship.

        Column pairs are removed when a column is dropped, so a relationship
        without pairs is dangling and is flagged rather than silently ignored.
        """
        if not self.columns:
            return False
        return all(
            pair.source_column is not None
            and pair.target_column is not None
            and pair.source_column.table_id == self.source_dataset_id
            and pair.target_column.table_id == self.target_dataset_id
            for pair in self.columns
        )

    @property
    def column_pairs(self) -> list[tuple[int, int]]:
        """The (source, target) column pairs, ordered by ordinal"""
        return [
            (column.source_column_id, column.target_column_id)
            for column in self.columns
        ]


class DatasetRelationshipColumn(Model):
    """A column pair participating in a dataset relationship"""

    __tablename__ = "dataset_relationship_columns"
    __table_args__ = (
        UniqueConstraint(
            "relationship_id",
            "ordinal",
            name="uq_dataset_relationship_columns_ordinal",
        ),
    )

    id = Column(Integer, primary_key=True)
    relationship_id = Column(
        Integer,
        ForeignKey("dataset_relationships.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_column_id = Column(
        Integer, ForeignKey("table_columns.id", ondelete="CASCADE"), nullable=False
    )
    target_column_id = Column(
        Integer, ForeignKey("table_columns.id", ondelete="CASCADE"), nullable=False
    )
    ordinal = Column(Integer, nullable=False, default=0)

    source_column: Mapped[TableColumn] = relationship(
        "TableColumn", foreign_keys=[source_column_id]
    )
    target_column: Mapped[TableColumn] = relationship(
        "TableColumn", foreign_keys=[target_column_id]
    )
    dataset_relationship: Mapped[DatasetRelationship] = relationship(
        "DatasetRelationship",
        back_populates="columns",
    )

    def __repr__(self) -> str:
        return f"{self.source_column_id}={self.target_column_id}"
