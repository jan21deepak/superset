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
import { DataMask, QueryObjectFilterClause } from '@superset-ui/core';

/**
 * Build a cross-filter data mask for a single date selection.
 */
export function buildSingleDateMask(
  column: string,
  dateStr: string | null,
): DataMask {
  const isEmpty = !dateStr || dateStr.trim() === '';
  const filters: QueryObjectFilterClause[] = isEmpty
    ? []
    : [{ col: column, op: '==', val: dateStr as string }];
  return {
    extraFormData: { filters },
    filterState: { value: isEmpty ? null : dateStr },
  };
}

/**
 * Build a cross-filter data mask for a date range selection.
 *
 * The range is expressed as two clauses (>= start, <= end) rather than a
 * single BETWEEN so that `filter_values('col')` returns [start, end] for
 * Jinja templating, and so it stays within the allowed operator set.
 */
export function buildRangeDateMask(
  column: string,
  startStr: string | null,
  endStr: string | null,
): DataMask {
  const isEmpty = !startStr || !endStr;
  const filters: QueryObjectFilterClause[] = isEmpty
    ? []
    : [
        { col: column, op: '>=', val: startStr as string },
        { col: column, op: '<=', val: endStr as string },
      ];
  return {
    extraFormData: { filters },
    filterState: {
      value: isEmpty ? null : [startStr as string, endStr as string],
    },
  };
}
