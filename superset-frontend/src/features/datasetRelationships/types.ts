/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

export type Cardinality =
  'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';

export type JoinType = 'inner' | 'left' | 'right' | 'full';

export interface RelationshipColumn {
  id?: number;
  // null once the column has been dropped
  source_column_id: number | null;
  target_column_id: number | null;
  source_column_name?: string | null;
  target_column_name?: string | null;
  ordinal: number;
}

export interface DatasetRelationship {
  id: number;
  uuid?: string | null;
  name: string | null;
  description: string | null;
  source_dataset_id: number;
  target_dataset_id: number;
  source_dataset_name: string | null;
  target_dataset_name: string | null;
  cardinality: Cardinality;
  join_type: JoinType;
  is_cross_database: boolean;
  is_active: boolean;
  is_valid: boolean;
  columns: RelationshipColumn[];
}

export interface RelationshipPayload {
  name?: string | null;
  description?: string | null;
  source_dataset_id: number;
  target_dataset_id: number;
  cardinality: Cardinality;
  join_type: JoinType;
  is_active: boolean;
  columns: {
    source_column_id: number;
    target_column_id: number;
    ordinal: number;
  }[];
}

export interface DatasetOption {
  value: number;
  label: string;
}

export interface DatasetColumn {
  id: number;
  column_name: string;
}

export interface DatasetNodeData extends Record<string, unknown> {
  label: string;
  relationshipCount: number;
  hasInvalidColumns: boolean;
}
