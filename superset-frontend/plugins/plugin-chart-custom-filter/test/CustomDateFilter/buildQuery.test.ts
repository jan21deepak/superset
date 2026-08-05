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
import { VizType } from '@superset-ui/core';
import buildQuery from '../../src/CustomDateFilter/buildQuery';
import { CustomDateFilterFormData } from '../../src/CustomDateFilter/types';

const formData: CustomDateFilterFormData = {
  datasource: '1__table',
  viz_type: VizType.CustomDateFilter,
  filterColumn: 'order_date',
};

test('builds a minimal query since the picker is client-side only', () => {
  const { queries } = buildQuery(formData);
  expect(queries[0].groupby).toEqual([]);
  expect(queries[0].metrics).toEqual([]);
  expect(queries[0].row_limit).toBe(1);
});
