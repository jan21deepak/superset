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

// A date-only bound (no time component) is compared as midnight of that day.
// Extend the end of a day-only range to the last second so `<=`/`==` stays
// inclusive of the whole day for timestamp columns.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const isDateOnly = (value: string): boolean => DATE_ONLY.test(value);
const toInclusiveEnd = (value: string): string =>
  isDateOnly(value) ? `${value} 23:59:59` : value;

/**
 * Build a cross-filter data mask for a single date selection.
 *
 * A bare date on a timestamp column would only match midnight with `==`, so a
 * day-only selection is expanded to a `>= day start`, `<= day end` pair while
 * an explicit timestamp keeps strict equality.
 */
export function buildSingleDateMask(
  column: string,
  dateStr: string | null,
): DataMask {
  const isEmpty = !dateStr || dateStr.trim() === '';
  let filters: QueryObjectFilterClause[] = [];
  if (!isEmpty) {
    const value = dateStr as string;
    filters = isDateOnly(value)
      ? [
          { col: column, op: '>=', val: value },
          { col: column, op: '<=', val: toInclusiveEnd(value) },
        ]
      : [{ col: column, op: '==', val: value }];
  }
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
        { col: column, op: '<=', val: toInclusiveEnd(endStr as string) },
      ];
  return {
    extraFormData: { filters },
    filterState: {
      value: isEmpty ? null : [startStr as string, endStr as string],
    },
  };
}
