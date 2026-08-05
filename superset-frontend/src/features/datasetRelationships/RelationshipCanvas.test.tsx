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

import { render, screen } from 'spec/helpers/testing-library';
import RelationshipCanvas from './RelationshipCanvas';
import { buildGraph, edgeLabel, edgeWarnings } from './utils';
import type { DatasetRelationship } from './types';

const relationship = (
  overrides: Partial<DatasetRelationship> = {},
): DatasetRelationship => ({
  id: 1,
  name: null,
  description: null,
  source_dataset_id: 1,
  target_dataset_id: 2,
  source_dataset_name: 'orders',
  target_dataset_name: 'customers',
  cardinality: 'many_to_one',
  join_type: 'inner',
  is_cross_database: false,
  is_active: true,
  is_valid: true,
  columns: [
    {
      source_column_id: 10,
      target_column_id: 20,
      source_column_name: 'customer_id',
      target_column_name: 'id',
      ordinal: 0,
    },
  ],
  ...overrides,
});

test('builds a node per dataset and an edge per relationship', () => {
  const { nodes, edges } = buildGraph([
    relationship(),
    relationship({
      id: 2,
      target_dataset_id: 3,
      target_dataset_name: 'refunds',
    }),
  ]);

  expect(nodes.map(node => node.id)).toEqual(['1', '2', '3']);
  expect(edges.map(edge => edge.id)).toEqual(['1', '2']);
  expect(edges[0].source).toBe('1');
  expect(edges[0].target).toBe('2');
});

test('labels edges with the cardinality and join type', () => {
  expect(edgeLabel(relationship())).toBe('N:1 · Inner join');
  expect(edgeLabel(relationship({ name: 'billing' }))).toBe(
    'billing · N:1 · Inner join',
  );
});

test('warns about many-to-many fan-out', () => {
  expect(edgeWarnings(relationship({ cardinality: 'many_to_many' }))).toEqual([
    'Many-to-many: joining on this relationship fans out rows',
  ]);
  expect(edgeWarnings(relationship())).toEqual([]);
});

test('warns about missing columns and cross-database relationships', () => {
  expect(
    edgeWarnings(relationship({ is_valid: false, is_cross_database: true })),
  ).toEqual([
    'Points at columns that no longer exist',
    'Cross-database: no query support',
  ]);
});

test('renders an empty state when there are no relationships', () => {
  render(<RelationshipCanvas relationships={[]} />);

  expect(screen.getByText('No relationships yet')).toBeInTheDocument();
  expect(
    screen.queryByTestId('dataset-relationship-canvas'),
  ).not.toBeInTheDocument();
});

test('renders the canvas and surfaces warnings', () => {
  render(
    <RelationshipCanvas
      relationships={[relationship({ cardinality: 'many_to_many' })]}
    />,
  );

  expect(screen.getByTestId('dataset-relationship-canvas')).toBeInTheDocument();
  expect(
    screen.getByText(
      'orders → customers: Many-to-many: joining on this relationship fans out rows',
    ),
  ).toBeInTheDocument();
});
