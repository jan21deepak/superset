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

import { t } from '@apache-superset/core/translation';
import type { Edge, Node } from '@xyflow/react';
import type {
  Cardinality,
  DatasetNodeData,
  DatasetRelationship,
  JoinType,
} from './types';

export const CARDINALITIES: Cardinality[] = [
  'one_to_one',
  'one_to_many',
  'many_to_one',
  'many_to_many',
];

export const JOIN_TYPES: JoinType[] = ['inner', 'left', 'right', 'full'];

export const cardinalityLabel = (cardinality: Cardinality): string =>
  ({
    one_to_one: t('1:1'),
    one_to_many: t('1:N'),
    many_to_one: t('N:1'),
    many_to_many: t('M:N'),
  })[cardinality];

export const joinTypeLabel = (joinType: JoinType): string =>
  ({
    inner: t('Inner join'),
    left: t('Left join'),
    right: t('Right join'),
    full: t('Full join'),
  })[joinType];

const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;

/**
 * Lay the datasets out on a grid, which keeps the canvas readable without
 * requiring a layout engine dependency.
 */
export const layout = (
  index: number,
  total: number,
): { x: number; y: number } => {
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  return {
    x: (index % columns) * NODE_WIDTH,
    y: Math.floor(index / columns) * NODE_HEIGHT,
  };
};

export const edgeLabel = (relationship: DatasetRelationship): string => {
  const parts = [
    cardinalityLabel(relationship.cardinality),
    joinTypeLabel(relationship.join_type),
  ];
  if (relationship.name) {
    parts.unshift(relationship.name);
  }
  return parts.join(' · ');
};

/**
 * The warnings shown on an edge. Relationships are inert metadata, so these
 * are advisory: they never prevent a relationship from being declared.
 */
export const edgeWarnings = (relationship: DatasetRelationship): string[] => {
  const warnings: string[] = [];
  if (relationship.cardinality === 'many_to_many') {
    warnings.push(
      t('Many-to-many: joining on this relationship fans out rows'),
    );
  }
  if (!relationship.is_valid) {
    warnings.push(t('Points at columns that no longer exist'));
  }
  if (relationship.is_cross_database) {
    warnings.push(t('Cross-database: no query support'));
  }
  return warnings;
};

export const buildGraph = (
  relationships: DatasetRelationship[],
): { nodes: Node<DatasetNodeData>[]; edges: Edge[] } => {
  const datasets = new Map<number, DatasetNodeData>();

  const touch = (id: number, label: string | null, invalid: boolean) => {
    const existing = datasets.get(id);
    datasets.set(id, {
      label: label ?? t('Dataset %s', id),
      relationshipCount: (existing?.relationshipCount ?? 0) + 1,
      hasInvalidColumns: (existing?.hasInvalidColumns ?? false) || invalid,
    });
  };

  relationships.forEach(relationship => {
    touch(
      relationship.source_dataset_id,
      relationship.source_dataset_name,
      !relationship.is_valid,
    );
    touch(
      relationship.target_dataset_id,
      relationship.target_dataset_name,
      !relationship.is_valid,
    );
  });

  const ids = [...datasets.keys()];
  const nodes: Node<DatasetNodeData>[] = ids.map((id, index) => ({
    id: String(id),
    type: 'dataset',
    position: layout(index, ids.length),
    data: datasets.get(id) as DatasetNodeData,
  }));

  const edges: Edge[] = relationships.map(relationship => ({
    id: String(relationship.id),
    source: String(relationship.source_dataset_id),
    target: String(relationship.target_dataset_id),
    label: edgeLabel(relationship),
    animated: false,
    markerEnd: { type: 'arrowclosed' as const },
    data: { warnings: edgeWarnings(relationship) },
    style: relationship.is_active ? undefined : { strokeDasharray: '4 4' },
  }));

  return { nodes, edges };
};
