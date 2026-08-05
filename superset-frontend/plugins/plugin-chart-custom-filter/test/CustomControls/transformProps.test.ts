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
import { ChartProps, QueryFormData, VizType } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/CustomControls/transformProps';
import { CustomControlsFormData } from '../../src/CustomControls/types';

const formData: CustomControlsFormData = {
  datasource: '1__table',
  viz_type: VizType.CustomControls,
  filterColumn: 'country',
  controlType: 'Radio',
};

const data = [{ country: 'US' }, { country: 'CA' }];

test('applies defaults and passes through configured values', () => {
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 400,
    height: 300,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

  const result = transformProps(chartProps);

  expect(result).toEqual(
    expect.objectContaining({
      width: 400,
      height: 300,
      data,
      controlType: 'Radio',
      filterColumn: 'country',
      orientation: 'vertical',
      includeAllOption: false,
      multiSelect: true,
      boldTitle: true,
    }),
  );
  expect(typeof result.setDataMask).toBe('function');
});

test('falls back to an empty dataset when no query data is present', () => {
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 100,
    height: 100,
    queriesData: [],
    theme: supersetTheme,
  });

  expect(transformProps(chartProps).data).toEqual([]);
});
