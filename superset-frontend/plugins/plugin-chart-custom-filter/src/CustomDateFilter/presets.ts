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
import dayjs, { Dayjs } from 'dayjs';
import { DynamicPreset } from './types';

export interface DynamicRange {
  start: Dayjs;
  end: Dayjs;
}

/**
 * Resolve a named dynamic preset into an absolute [start, end] range,
 * evaluated relative to `now`.
 */
export function resolveDynamicPreset(
  preset: DynamicPreset,
  now: Dayjs = dayjs(),
): DynamicRange {
  switch (preset) {
    case 'Today':
      return { start: now.startOf('day'), end: now.endOf('day') };
    case 'Yesterday': {
      const yesterday = now.subtract(1, 'day');
      return { start: yesterday.startOf('day'), end: yesterday.endOf('day') };
    }
    case 'Last 7 Days':
      return {
        start: now.subtract(7, 'day').startOf('day'),
        end: now.endOf('day'),
      };
    case 'Last 30 Days':
      return {
        start: now.subtract(30, 'day').startOf('day'),
        end: now.endOf('day'),
      };
    case 'This Month':
      return { start: now.startOf('month'), end: now };
    case 'This Month (Full)':
      return { start: now.startOf('month'), end: now.endOf('month') };
    case 'Last Month': {
      const lastMonth = now.subtract(1, 'month');
      return {
        start: lastMonth.startOf('month'),
        end: lastMonth.endOf('month'),
      };
    }
    case 'This Year':
      return { start: now.startOf('year'), end: now };
    default:
      return { start: now.startOf('day'), end: now.endOf('day') };
  }
}
