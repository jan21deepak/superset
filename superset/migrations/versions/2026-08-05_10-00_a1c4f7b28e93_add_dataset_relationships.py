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
"""add dataset relationships

Relationship metadata between datasets (SIP-217), used behind the
DATASET_RELATIONSHIPS feature flag.

Revision ID: a1c4f7b28e93
Revises: e7d93a524ff6
Create Date: 2026-08-05 10:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_index,
    create_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "a1c4f7b28e93"
down_revision = "e7d93a524ff6"


def upgrade() -> None:
    create_table(
        "dataset_relationships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_dataset_id", sa.Integer(), nullable=False),
        sa.Column("target_dataset_id", sa.Integer(), nullable=False),
        sa.Column("cardinality", sa.String(length=50), nullable=False),
        sa.Column("join_type", sa.String(length=50), nullable=False),
        sa.Column(
            "is_cross_database", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
        sa.ForeignKeyConstraint(
            ["source_dataset_id"], ["tables.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_dataset_id"], ["tables.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
    )
    create_index(
        "dataset_relationships",
        "ix_dataset_relationships_source_dataset_id",
        ["source_dataset_id"],
    )
    create_index(
        "dataset_relationships",
        "ix_dataset_relationships_target_dataset_id",
        ["target_dataset_id"],
    )

    create_table(
        "dataset_relationship_columns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("relationship_id", sa.Integer(), nullable=False),
        sa.Column("source_column_id", sa.Integer(), nullable=True),
        sa.Column("target_column_id", sa.Integer(), nullable=True),
        sa.Column("ordinal", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["relationship_id"], ["dataset_relationships.id"], ondelete="CASCADE"
        ),
        # dropping a column nulls its side of the pair, leaving the mapping
        # behind to be flagged as broken
        sa.ForeignKeyConstraint(
            ["source_column_id"], ["table_columns.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["target_column_id"], ["table_columns.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint(
            "relationship_id",
            "ordinal",
            name="uq_dataset_relationship_columns_ordinal",
        ),
    )
    create_index(
        "dataset_relationship_columns",
        "ix_dataset_relationship_columns_relationship_id",
        ["relationship_id"],
    )


def downgrade() -> None:
    drop_index(
        "dataset_relationship_columns",
        "ix_dataset_relationship_columns_relationship_id",
    )
    drop_table("dataset_relationship_columns")
    drop_index("dataset_relationships", "ix_dataset_relationships_target_dataset_id")
    drop_index("dataset_relationships", "ix_dataset_relationships_source_dataset_id")
    drop_table("dataset_relationships")
