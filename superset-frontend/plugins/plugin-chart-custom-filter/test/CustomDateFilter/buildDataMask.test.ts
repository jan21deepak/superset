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
import {
  buildRangeDateMask,
  buildSingleDateMask,
} from '../../src/CustomDateFilter/buildDataMask';

test('single date mask emits an equality clause', () => {
  const mask = buildSingleDateMask('order_date', '2021-01-01');
  expect(mask.extraFormData?.filters).toEqual([
    { col: 'order_date', op: '==', val: '2021-01-01' },
  ]);
  expect(mask.filterState?.value).toBe('2021-01-01');
});

test('empty single date clears the cross filter', () => {
  const mask = buildSingleDateMask('order_date', null);
  expect(mask.extraFormData?.filters).toEqual([]);
  expect(mask.filterState?.value).toBeNull();
});

test('range mask emits two bound clauses with an inclusive end of day', () => {
  const mask = buildRangeDateMask('order_date', '2021-01-01', '2021-01-31');
  expect(mask.extraFormData?.filters).toEqual([
    { col: 'order_date', op: '>=', val: '2021-01-01' },
    { col: 'order_date', op: '<=', val: '2021-01-31 23:59:59' },
  ]);
  expect(mask.filterState?.value).toEqual(['2021-01-01', '2021-01-31']);
});

test('range mask keeps an explicit end timestamp untouched', () => {
  const mask = buildRangeDateMask(
    'order_date',
    '2021-01-01 08:00:00',
    '2021-01-31 17:30:00',
  );
  expect(mask.extraFormData?.filters).toEqual([
    { col: 'order_date', op: '>=', val: '2021-01-01 08:00:00' },
    { col: 'order_date', op: '<=', val: '2021-01-31 17:30:00' },
  ]);
});

test('incomplete range clears the cross filter', () => {
  const mask = buildRangeDateMask('order_date', '2021-01-01', null);
  expect(mask.extraFormData?.filters).toEqual([]);
  expect(mask.filterState?.value).toBeNull();
});
