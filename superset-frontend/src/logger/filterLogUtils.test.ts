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
import { DataMask, Filters, isFeatureEnabled } from '@superset-ui/core';
import { getAppliedFilterLogEntries } from './filterLogUtils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const filters = {
  'NATIVE_FILTER-1': {
    id: 'NATIVE_FILTER-1',
    name: 'Status',
    filterType: 'filter_select',
    targets: [{}],
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    scope: { rootPath: [], excluded: [] },
    type: 'NATIVE_FILTER',
  },
  'NATIVE_FILTER-2': {
    id: 'NATIVE_FILTER-2',
    name: 'Region',
    filterType: 'filter_select',
    targets: [{}],
    controlValues: {},
    defaultDataMask: {},
    cascadeParentIds: [],
    scope: { rootPath: [], excluded: [] },
    type: 'NATIVE_FILTER',
  },
  'DIVIDER-1': {
    id: 'DIVIDER-1',
    type: 'DIVIDER',
    title: 'divider',
    description: '',
  },
} as unknown as Filters;

const dataMask: Record<string, DataMask> = {
  'NATIVE_FILTER-1': { filterState: { value: ['done'] } },
  'NATIVE_FILTER-2': { filterState: { value: null } },
};

beforeEach(() => {
  mockedIsFeatureEnabled.mockReturnValue(false);
});

test('projects native filters with names and set flags, skipping dividers', () => {
  expect(getAppliedFilterLogEntries(filters, dataMask)).toEqual([
    { id: 'NATIVE_FILTER-1', name: 'Status', is_set: true },
    { id: 'NATIVE_FILTER-2', name: 'Region', is_set: false },
  ]);
});

test('includes values when the LOG_FILTER_VALUES feature flag is enabled', () => {
  mockedIsFeatureEnabled.mockReturnValue(true);
  expect(getAppliedFilterLogEntries(filters, dataMask)).toEqual([
    { id: 'NATIVE_FILTER-1', name: 'Status', is_set: true, value: ['done'] },
    { id: 'NATIVE_FILTER-2', name: 'Region', is_set: false },
  ]);
});

test('returns an empty array without filters or data mask', () => {
  expect(getAppliedFilterLogEntries(undefined, dataMask)).toEqual([]);
  expect(getAppliedFilterLogEntries(filters, undefined)).toEqual([]);
});
