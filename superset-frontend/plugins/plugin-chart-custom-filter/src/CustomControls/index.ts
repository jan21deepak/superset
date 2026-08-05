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
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import { CustomControlsFormData } from './types';

const metadata = new ChartMetadata({
  category: t('Filters'),
  description: t(
    'A canvas-placed filter control (dropdown, radio, checkbox or text box) that emits cross filters to the rest of the dashboard.',
  ),
  name: t('Custom Filter'),
  thumbnail,
  behaviors: [Behavior.InteractiveChart],
  tags: [t('Filter'), t('Interactive')],
});

export default class CustomControlsChartPlugin extends ChartPlugin<CustomControlsFormData> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./CustomControls'),
      metadata,
      transformProps,
    });
  }
}
