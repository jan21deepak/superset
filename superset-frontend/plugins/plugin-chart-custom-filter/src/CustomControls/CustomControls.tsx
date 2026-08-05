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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from 'lodash';
import {
  DataMask,
  getColumnLabel,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  Checkbox,
  Constants,
  Input,
  Radio,
  Select,
} from '@superset-ui/core/components';
import { CustomControlsTransformedProps, CustomControlsValue } from './types';

const ALL_VALUE = 'ALL_SELECTED';

const Styles = styled.div<{ height: number; width: number }>`
  ${({ theme }) => `padding: ${theme.sizeUnit * 2}px;`}
  width: ${({ width }) => width}px;
  height: ${({ height }) => height}px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const Title = styled.div<{ bold: boolean }>`
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px;`}
  font-weight: ${({ bold }) => (bold ? 'bold' : 'normal')};
`;

type Option = { label: string; value: string | number };

const isNumericColumn = (
  data: CustomControlsTransformedProps['data'],
  columnLabel: string,
): boolean => data.length > 0 && typeof data[0][columnLabel] === 'number';

const coerceNumeric = (value: string): string | number => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

export default function CustomControls(props: CustomControlsTransformedProps) {
  const {
    data,
    height,
    width,
    controlType,
    filterColumn,
    orientation,
    includeAllOption,
    multiSelect,
    defaultValue,
    hideTitle,
    boldTitle,
    setDataMask,
    filterState,
  } = props;

  const hasUserInteracted = useRef(false);

  const columnLabel = useMemo(
    () => (filterColumn ? getColumnLabel(filterColumn) : ''),
    [filterColumn],
  );

  const parsedDefault: CustomControlsValue = useMemo(() => {
    if (!defaultValue) {
      return undefined;
    }
    const numeric = columnLabel ? isNumericColumn(data, columnLabel) : false;
    const isMulti =
      (controlType === 'Dropdown' && multiSelect) || controlType === 'Checkbox';

    if (isMulti) {
      const values = defaultValue.includes(',')
        ? defaultValue.split(',').map(part => part.trim())
        : [defaultValue];
      return numeric ? values.map(coerceNumeric) : values;
    }
    if (controlType === 'Radio') {
      return [numeric ? coerceNumeric(defaultValue) : defaultValue];
    }
    return numeric ? coerceNumeric(defaultValue) : defaultValue;
  }, [defaultValue, columnLabel, data, controlType, multiSelect]);

  const [localValue, setLocalValue] = useState<CustomControlsValue>(() =>
    filterState?.value !== undefined ? filterState.value : parsedDefault,
  );

  const options: Option[] = useMemo(() => {
    if (!columnLabel || data.length === 0) {
      return [];
    }
    const unique = new Set<string | number>();
    data.forEach(row => {
      const value = row[columnLabel];
      if (value !== undefined && value !== null) {
        unique.add(value as string | number);
      }
    });
    const opts: Option[] = Array.from(unique).map(value => ({
      label: String(value),
      value,
    }));
    return includeAllOption
      ? [{ label: t('All'), value: ALL_VALUE }, ...opts]
      : opts;
  }, [data, columnLabel, includeAllOption]);

  const emitFilter = useCallback(
    (value: CustomControlsValue) => {
      if (!columnLabel) {
        return;
      }
      const isAllSelected =
        value === ALL_VALUE ||
        (Array.isArray(value) && value.includes(ALL_VALUE));
      const isEmpty =
        isAllSelected ||
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      let filters: QueryObjectFilterClause[] = [];
      if (!isEmpty) {
        if (controlType === 'TextBox') {
          filters = [{ col: columnLabel, op: 'ILIKE', val: `%${value}%` }];
        } else if (Array.isArray(value)) {
          filters = [{ col: columnLabel, op: 'IN', val: value }];
        } else {
          filters = [{ col: columnLabel, op: '==', val: value }];
        }
      }

      // Keep the "All" sentinel in filterState so the control still shows the
      // user's selection; only a genuinely empty selection clears it.
      const dataMask: DataMask = {
        extraFormData: { filters },
        filterState: { value: isEmpty && !isAllSelected ? null : value },
      };
      setDataMask(dataMask);
    },
    [columnLabel, controlType, setDataMask],
  );

  const handleChange = useCallback(
    (value: CustomControlsValue) => {
      hasUserInteracted.current = true;
      setLocalValue(value);
      emitFilter(value);
    },
    [emitFilter],
  );

  // The text box emits an ILIKE cross filter on every keystroke, so debounce
  // the emission (the input itself stays controlled) to avoid refetching every
  // dashboard chart per character, mirroring the native Select filter.
  const debouncedEmit = useMemo(
    () => debounce(emitFilter, Constants.FAST_DEBOUNCE),
    [emitFilter],
  );

  useEffect(() => () => debouncedEmit.cancel(), [debouncedEmit]);

  const handleTextChange = useCallback(
    (value: string) => {
      hasUserInteracted.current = true;
      setLocalValue(value);
      debouncedEmit(value);
    },
    [debouncedEmit],
  );

  useEffect(() => {
    if (filterState?.value !== undefined) {
      setLocalValue(filterState.value);
      hasUserInteracted.current = true;
    }
  }, [filterState?.value]);

  useEffect(() => {
    if (
      !hasUserInteracted.current &&
      parsedDefault !== undefined &&
      filterState?.value === undefined
    ) {
      setLocalValue(parsedDefault);
      emitFilter(parsedDefault);
    }
  }, [parsedDefault, filterState?.value, emitFilter]);

  const renderControl = () => {
    if (controlType === 'TextBox') {
      return (
        <Input
          placeholder={t('Filter by %s', columnLabel || t('value'))}
          value={typeof localValue === 'string' ? localValue : undefined}
          onChange={event => handleTextChange(event.target.value)}
          allowClear
        />
      );
    }

    if (controlType === 'Dropdown') {
      return (
        <Select
          header={null}
          ariaLabel={columnLabel || t('Filter')}
          placeholder={t('Select %s', columnLabel || t('value'))}
          options={options}
          value={localValue}
          onChange={value => handleChange(value as CustomControlsValue)}
          allowClear
          mode={multiSelect ? 'multiple' : 'single'}
        />
      );
    }

    if (controlType === 'Radio') {
      const current = Array.isArray(localValue) ? localValue[0] : localValue;
      return (
        <Radio.GroupWrapper
          spaceConfig={{
            direction: orientation === 'horizontal' ? 'horizontal' : 'vertical',
            wrap: true,
          }}
          options={options}
          value={current}
          onChange={event => handleChange([event.target.value])}
        />
      );
    }

    if (controlType === 'Checkbox') {
      return (
        <Checkbox.Group
          options={options}
          value={Array.isArray(localValue) ? localValue : undefined}
          onChange={value => handleChange(value as CustomControlsValue)}
          style={{
            display: 'flex',
            flexDirection: orientation === 'horizontal' ? 'row' : 'column',
            flexWrap: 'wrap',
          }}
        />
      );
    }

    return <div>{t('Unsupported control type')}</div>;
  };

  const showTitle = !hideTitle && columnLabel;

  return (
    <Styles width={width} height={height}>
      {showTitle && <Title bold={boldTitle}>{columnLabel}</Title>}
      {renderControl()}
    </Styles>
  );
}
