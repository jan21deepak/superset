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
import dayjs from 'dayjs';
import { resolveDynamicPreset } from '../../src/CustomDateFilter/presets';

const now = dayjs('2021-06-15T12:00:00');

test('Last 7 Days spans the previous week up to end of today', () => {
  const { start, end } = resolveDynamicPreset('Last 7 Days', now);
  expect(start.format('YYYY-MM-DD')).toBe('2021-06-08');
  expect(end.format('YYYY-MM-DD')).toBe('2021-06-15');
});

test('Last Month covers the full previous calendar month', () => {
  const { start, end } = resolveDynamicPreset('Last Month', now);
  expect(start.format('YYYY-MM-DD')).toBe('2021-05-01');
  expect(end.format('YYYY-MM-DD')).toBe('2021-05-31');
});

test('This Month (Full) covers the whole current month', () => {
  const { start, end } = resolveDynamicPreset('This Month (Full)', now);
  expect(start.format('YYYY-MM-DD')).toBe('2021-06-01');
  expect(end.format('YYYY-MM-DD')).toBe('2021-06-30');
});

test('This Year starts on Jan 1 of the current year', () => {
  const { start } = resolveDynamicPreset('This Year', now);
  expect(start.format('YYYY-MM-DD')).toBe('2021-01-01');
});
