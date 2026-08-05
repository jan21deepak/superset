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
  DataMask,
  FeatureFlag,
  Filters,
  isFeatureEnabled,
  isNativeFilter,
} from '@superset-ui/core';

export interface AppliedFilterLogEntry {
  id: string;
  name?: string;
  is_set: boolean;
  value?: unknown;
}

const isValueSet = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(item => item != null);
  return true;
};

/**
 * Builds a compact projection of the native filter state suitable for logging.
 * Filter values are user data and can be sensitive, so they are only included
 * when the LOG_FILTER_VALUES feature flag is enabled; otherwise each entry
 * carries the filter name and whether a value is set.
 */
export const getAppliedFilterLogEntries = (
  filters: Filters | undefined,
  dataMask: Record<string, DataMask> | undefined,
): AppliedFilterLogEntry[] => {
  if (!filters || !dataMask) return [];
  const includeValues = isFeatureEnabled(FeatureFlag.LogFilterValues);

  return Object.values(filters)
    .filter(isNativeFilter)
    .map(filter => {
      const value = dataMask[filter.id]?.filterState?.value;
      const entry: AppliedFilterLogEntry = {
        id: filter.id,
        name: filter.name,
        is_set: isValueSet(value),
      };
      if (includeValues && entry.is_set) {
        entry.value = value;
      }
      return entry;
    });
};
