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
  FilterState,
  QueryFormColumn,
  QueryFormData,
  SetDataMaskHook,
} from '@superset-ui/core';

export type PickerType = 'DatePicker' | 'RangePicker';

export type DefaultType = 'None' | 'Static' | 'Dynamic';

export type DynamicPreset =
  | 'Today'
  | 'Yesterday'
  | 'Last 7 Days'
  | 'Last 30 Days'
  | 'This Month'
  | 'This Month (Full)'
  | 'Last Month'
  | 'This Year';

export interface CustomDateFilterFormData extends QueryFormData {
  filterColumn?: QueryFormColumn;
  pickerType?: PickerType;
  showTime?: boolean;
  presetRanges?: boolean;
  defaultType?: DefaultType;
  defaultStaticValue?: string;
  defaultDynamicValue?: DynamicPreset;
}

export interface CustomDateFilterTransformedProps {
  width: number;
  height: number;
  filterColumn?: QueryFormColumn;
  pickerType: PickerType;
  showTime: boolean;
  presetRanges: boolean;
  defaultType: DefaultType;
  defaultStaticValue?: string;
  defaultDynamicValue?: DynamicPreset;
  setDataMask: SetDataMaskHook;
  filterState?: FilterState;
}
