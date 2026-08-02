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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/Histogram/transformProps';
import {
  HistogramChartProps,
  HistogramFormData,
} from '../../src/Histogram/types';
import { LegendType } from '../../src/types';

const CHART_HEIGHT = 200;

const formData = {
  bins: 2,
  column: 'quantity',
  colorScheme: 'supersetColors',
  cumulative: false,
  datasource: '1__table',
  groupby: ['category'],
  normalize: false,
  showLegend: true,
  showValue: false,
  sliceId: 1,
  viz_type: 'histogram_v2',
  xAxisFormat: 'SMART_NUMBER',
  xAxisTitle: '',
  yAxisFormat: 'SMART_NUMBER',
  yAxisTitle: '',
} as unknown as HistogramFormData;

const buildChartProps = ({
  seriesCount,
  showLegend = true,
  width,
}: {
  seriesCount: number;
  showLegend?: boolean;
  width: number;
}) =>
  new ChartProps({
    formData: { ...formData, showLegend },
    height: CHART_HEIGHT,
    queriesData: [
      {
        data: Array.from({ length: seriesCount }, (_, index) => ({
          category: `category ${index}`,
          '0 - 5': index,
          '5 - 10': index + 1,
        })),
      },
    ],
    theme: supersetTheme,
    width,
  }) as HistogramChartProps;

const getEchartOptions = (chartProps: HistogramChartProps) =>
  transformProps(chartProps).echartOptions as {
    grid: { top: number };
    legend: { type: LegendType };
  };

test('reserves extra space above the plot when the legend wraps onto several rows', () => {
  const singleSeries = getEchartOptions(
    buildChartProps({ seriesCount: 1, width: 800 }),
  );
  const manySeries = getEchartOptions(
    buildChartProps({ seriesCount: 8, width: 800 }),
  );

  expect(manySeries.legend.type).toEqual(LegendType.Plain);
  expect(manySeries.grid.top).toBeGreaterThan(singleSeries.grid.top);
  expect(manySeries.grid.top).toBeGreaterThan(CHART_HEIGHT * 0.1);
});

test('falls back to a scrollable legend when it cannot fit at narrow widths', () => {
  const { grid, legend } = getEchartOptions(
    buildChartProps({ seriesCount: 8, width: 320 }),
  );

  expect(legend.type).toEqual(LegendType.Scroll);
  expect(grid.top).toBeGreaterThanOrEqual(CHART_HEIGHT * 0.1);
});

test('keeps the default plot padding when the legend is hidden', () => {
  const { grid } = getEchartOptions(
    buildChartProps({ seriesCount: 8, showLegend: false, width: 800 }),
  );

  expect(grid.top).toEqual(CHART_HEIGHT * 0.1);
});
