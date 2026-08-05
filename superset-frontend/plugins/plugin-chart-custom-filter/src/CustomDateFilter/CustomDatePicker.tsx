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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getColumnLabel } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { DatePicker, RangePicker } from '@superset-ui/core/components';
import dayjs, { Dayjs } from 'dayjs';
import { CustomDateFilterTransformedProps } from './types';
import { buildRangeDateMask, buildSingleDateMask } from './buildDataMask';
import { resolveDynamicPreset } from './presets';

type DateValue = string | [string, string] | null;

const Styles = styled.div<{ height: number; width: number }>`
  ${({ theme }) => `padding: ${theme.sizeUnit * 2}px;`}
  width: ${({ width }) => width}px;
  height: ${({ height }) => height}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const Title = styled.div`
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px;`}
  font-weight: bold;
`;

function resolveRange(
  preset: Parameters<typeof resolveDynamicPreset>[0],
): [Dayjs, Dayjs] {
  const { start, end } = resolveDynamicPreset(preset);
  return [start, end];
}

export default function CustomDatePicker(
  props: CustomDateFilterTransformedProps,
) {
  const {
    height,
    width,
    filterColumn,
    pickerType,
    showTime,
    presetRanges,
    setDataMask,
    filterState,
    defaultType,
    defaultStaticValue,
    defaultDynamicValue,
  } = props;

  const columnLabel = useMemo(
    () => (filterColumn ? getColumnLabel(filterColumn) : ''),
    [filterColumn],
  );

  const formatString = showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD';

  const emitSingle = useCallback(
    (dateStr: string | null) => {
      if (!columnLabel) {
        return;
      }
      setDataMask(buildSingleDateMask(columnLabel, dateStr));
    },
    [columnLabel, setDataMask],
  );

  const emitRange = useCallback(
    (startStr: string | null, endStr: string | null) => {
      if (!columnLabel) {
        return;
      }
      setDataMask(buildRangeDateMask(columnLabel, startStr, endStr));
    },
    [columnLabel, setDataMask],
  );

  const [localValue, setLocalValue] = useState<DateValue>(
    (filterState?.value as DateValue) ?? null,
  );

  // Evaluate the configured default exactly once on mount.
  useEffect(() => {
    if (filterState?.value !== undefined) {
      return;
    }
    if (defaultType === 'Static' && defaultStaticValue) {
      if (pickerType === 'RangePicker') {
        const parts = defaultStaticValue.includes(' and ')
          ? defaultStaticValue.split(' and ').map(part => part.trim())
          : defaultStaticValue.split(',').map(part => part.trim());
        if (parts.length === 2) {
          setLocalValue([parts[0], parts[1]]);
          emitRange(parts[0], parts[1]);
        }
      } else {
        setLocalValue(defaultStaticValue);
        emitSingle(defaultStaticValue);
      }
    } else if (defaultType === 'Dynamic' && defaultDynamicValue) {
      const { start, end } = resolveDynamicPreset(defaultDynamicValue);
      if (pickerType === 'RangePicker') {
        const startStr = start.format(formatString);
        const endStr = end.format(formatString);
        setLocalValue([startStr, endStr]);
        emitRange(startStr, endStr);
      } else {
        const dateStr = start.format(formatString);
        setLocalValue(dateStr);
        emitSingle(dateStr);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (filterState?.value !== undefined) {
      setLocalValue(filterState.value as DateValue);
    }
  }, [filterState?.value]);

  const handleSingleChange = (
    _date: Dayjs | null,
    dateString: string | string[],
  ) => {
    const value = Array.isArray(dateString) ? dateString[0] : dateString;
    setLocalValue(value || null);
    emitSingle(value || null);
  };

  const handleRangeChange = (
    _dates: [Dayjs | null, Dayjs | null] | null,
    dateStrings: [string, string],
  ) => {
    if (!dateStrings || !dateStrings[0] || !dateStrings[1]) {
      setLocalValue(null);
      emitRange(null, null);
      return;
    }
    setLocalValue([dateStrings[0], dateStrings[1]]);
    emitRange(dateStrings[0], dateStrings[1]);
  };

  const presets = useMemo(() => {
    if (!presetRanges) {
      return undefined;
    }
    return [
      { label: t('Today'), value: resolveRange('Today') },
      { label: t('Last 7 Days'), value: resolveRange('Last 7 Days') },
      { label: t('Last 30 Days'), value: resolveRange('Last 30 Days') },
      { label: t('This Month'), value: resolveRange('This Month (Full)') },
    ];
  }, [presetRanges]);

  const singleValue =
    pickerType === 'DatePicker' && typeof localValue === 'string'
      ? dayjs(localValue, formatString)
      : null;

  const rangeValue: [Dayjs | null, Dayjs | null] | null =
    pickerType === 'RangePicker' && Array.isArray(localValue)
      ? [
          localValue[0] ? dayjs(localValue[0], formatString) : null,
          localValue[1] ? dayjs(localValue[1], formatString) : null,
        ]
      : null;

  return (
    <Styles width={width} height={height}>
      {columnLabel && <Title>{t('%s Filter', columnLabel)}</Title>}
      {pickerType === 'DatePicker' ? (
        <DatePicker
          showTime={showTime}
          format={formatString}
          onChange={handleSingleChange}
          value={singleValue}
        />
      ) : (
        <RangePicker
          showTime={showTime}
          format={formatString}
          onChange={handleRangeChange}
          presets={presets}
          value={rangeValue}
        />
      )}
    </Styles>
  );
}
