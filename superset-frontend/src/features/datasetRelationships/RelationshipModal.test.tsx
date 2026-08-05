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

import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import {
  render,
  screen,
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import RelationshipModal from './RelationshipModal';
import type { DatasetRelationship } from './types';

const relationship: DatasetRelationship = {
  id: 1,
  name: 'orders to customers',
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
};

fetchMock.get('glob:*/api/v1/dataset/?q=*', {
  count: 1,
  result: [{ id: 1, table_name: 'orders' }],
});
fetchMock.get('glob:*/api/v1/dataset/1', {
  result: { columns: [{ id: 10, column_name: 'customer_id' }] },
});
fetchMock.get('glob:*/api/v1/dataset/2', {
  result: { columns: [{ id: 20, column_name: 'id' }] },
});

test('saves the relationship being edited', async () => {
  const onSave = jest.fn();
  render(
    <RelationshipModal
      show
      relationship={relationship}
      onHide={jest.fn()}
      onSave={onSave}
    />,
  );

  expect(
    await screen.findByDisplayValue('orders to customers'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('dataset-relationship-column-pair'),
  ).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        source_dataset_id: 1,
        target_dataset_id: 2,
        cardinality: 'many_to_one',
        join_type: 'inner',
        columns: [{ source_column_id: 10, target_column_id: 20, ordinal: 0 }],
      }),
      1,
    ),
  );
});

test('requires a column pair before saving a new relationship', async () => {
  render(
    <RelationshipModal
      show
      relationship={null}
      onHide={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  expect(await screen.findByRole('button', { name: 'Add' })).toBeDisabled();
});

test('adds and removes column pairs', async () => {
  render(
    <RelationshipModal
      show
      relationship={relationship}
      onHide={jest.fn()}
      onSave={jest.fn()}
    />,
  );

  userEvent.click(
    await screen.findByRole('button', { name: 'Add column pair' }),
  );
  await waitFor(() =>
    expect(
      screen.getAllByTestId('dataset-relationship-column-pair'),
    ).toHaveLength(2),
  );

  userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
  await waitFor(() =>
    expect(
      screen.getAllByTestId('dataset-relationship-column-pair'),
    ).toHaveLength(1),
  );
});

test('changing a dataset clears its columns and keeps the id numeric', async () => {
  const onSave = jest.fn();
  render(
    <RelationshipModal
      show
      relationship={relationship}
      onHide={jest.fn()}
      onSave={onSave}
    />,
  );

  expect(await screen.findByText('customers')).toBeInTheDocument();

  await selectOption('orders', 'Target dataset: customers');

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
  );
  expect(
    screen.getByRole('combobox', { name: 'Target dataset: orders' }),
  ).toBeInTheDocument();
});
