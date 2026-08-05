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
import { buildQueryContext } from '@superset-ui/core';
import { CustomDateFilterFormData } from './types';

// The date picker is purely client-side, so the query results are never read.
// The backend rejects a query with no metrics/columns/groupby ("Empty query?"),
// so group by the configured column but cap the row limit to avoid scanning the
// underlying table.
export default function buildQuery(formData: CustomDateFilterFormData) {
  const { filterColumn } = formData;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      groupby: filterColumn ? [filterColumn] : [],
      metrics: [],
      row_limit: 1,
    },
  ]);
}
