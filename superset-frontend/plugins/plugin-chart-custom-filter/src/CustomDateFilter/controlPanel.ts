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
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      // Section labels are typed as ReactNode (no lazy form); keep eager t().
      // eslint-disable-next-line i18n-strings/no-eager-t-in-config
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'filterColumn',
            config: {
              ...sharedControls.groupby,
              label: () => t('Filter Column (Temporal)'),
              description: () => t('Temporal column to apply date filters to.'),
              multi: false,
            },
          },
        ],
      ],
    },
    {
      // eslint-disable-next-line i18n-strings/no-eager-t-in-config
      label: t('Custom Date Picker Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'pickerType',
            config: {
              type: 'SelectControl',
              label: () => t('Picker Type'),
              default: 'DatePicker',
              choices: [
                ['DatePicker', t('Single Date Picker')],
                ['RangePicker', t('Date Range Picker')],
              ],
              renderTrigger: true,
              description: () =>
                t('Select the type of date UI control to display'),
            },
          },
        ],
        [
          {
            name: 'showTime',
            config: {
              type: 'CheckboxControl',
              label: () => t('Enable Time Selection'),
              default: false,
              renderTrigger: true,
              description: () =>
                t('Allow users to select specific times (hours, minutes)'),
            },
          },
        ],
        [
          {
            name: 'presetRanges',
            config: {
              type: 'CheckboxControl',
              label: () => t('Enable Quick Preset Ranges'),
              default: false,
              renderTrigger: true,
              description: () =>
                t(
                  'Show handy presets like "Today" and "Last 7 Days" on range pickers',
                ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                controls?.pickerType?.value === 'RangePicker',
            },
          },
        ],
      ],
    },
    {
      // eslint-disable-next-line i18n-strings/no-eager-t-in-config
      label: t('Default Filters'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'defaultType',
            config: {
              type: 'SelectControl',
              label: () => t('Default Value Type'),
              default: 'None',
              choices: [
                ['None', t('No Default Filter')],
                ['Static', t('Static Date / Range')],
                ['Dynamic', t('Dynamic Preset (e.g. Last Month)')],
              ],
              renderTrigger: true,
              description: () =>
                t(
                  'Configure whether the chart loads with a pre-selected date.',
                ),
            },
          },
        ],
        [
          {
            name: 'defaultStaticValue',
            config: {
              type: 'TextControl',
              label: () => t('Static Default Value'),
              default: '',
              renderTrigger: true,
              description: () =>
                t(
                  'For single dates: YYYY-MM-DD. For ranges: YYYY-MM-DD and YYYY-MM-DD',
                ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                controls?.defaultType?.value === 'Static',
            },
          },
        ],
        [
          {
            name: 'defaultDynamicValue',
            config: {
              type: 'SelectControl',
              label: () => t('Dynamic Preset Default'),
              default: 'Last 30 Days',
              choices: [
                ['Today', t('Today')],
                ['Yesterday', t('Yesterday')],
                ['Last 7 Days', t('Last 7 Days')],
                ['Last 30 Days', t('Last 30 Days')],
                ['This Month', t('This Month (From 1st to Now)')],
                ['This Month (Full)', t('This Month (Full Calendar Month)')],
                ['Last Month', t('Last Month (Previous Calendar Month)')],
                ['This Year', t('This Year')],
              ],
              renderTrigger: true,
              description: () =>
                t('Select a dynamic time range preset that computes on load.'),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                controls?.defaultType?.value === 'Dynamic',
            },
          },
        ],
      ],
    },
  ],
};

export default config;
