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

import { useEffect, useMemo, useState } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  AsyncSelect,
  Button,
  Input,
  Modal,
  Select,
} from '@superset-ui/core/components';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import {
  CARDINALITIES,
  JOIN_TYPES,
  cardinalityLabel,
  joinTypeLabel,
} from './utils';
import type {
  Cardinality,
  DatasetColumn,
  DatasetRelationship,
  JoinType,
  RelationshipPayload,
} from './types';

export interface RelationshipModalProps {
  show: boolean;
  relationship?: DatasetRelationship | null;
  onHide: () => void;
  onSave: (payload: RelationshipPayload, id?: number) => void;
}

interface ColumnPair {
  source_column_id?: number;
  target_column_id?: number;
}

const StyledField = styled.div(
  ({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 4}px;

    .control-label {
      margin-bottom: ${theme.sizeUnit}px;
    }
  `,
);

const StyledPair = styled.div(
  ({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    align-items: center;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `,
);

const loadDatasetOptions = (input = '', page: number, pageSize: number) => {
  const query = rison.encode({
    filters: [{ col: 'table_name', opr: 'ct', value: input }],
    page,
    page_size: pageSize,
  });
  return SupersetClient.get({
    endpoint: `/api/v1/dataset/?q=${query}`,
  }).then(response => ({
    data: response.json.result.map(
      (item: { id: number; table_name: string }) => ({
        label: item.table_name,
        value: item.id,
      }),
    ),
    totalCount: response.json.count,
  }));
};

const fetchColumns = (datasetId: number): Promise<DatasetColumn[]> =>
  SupersetClient.get({ endpoint: `/api/v1/dataset/${datasetId}` }).then(
    response =>
      response.json.result.columns.map(
        (column: { id: number; column_name: string }) => ({
          id: column.id,
          column_name: column.column_name,
        }),
      ),
  );

export default function RelationshipModal({
  show,
  relationship,
  onHide,
  onSave,
}: RelationshipModalProps) {
  const isEditMode = Boolean(relationship);
  const [name, setName] = useState('');
  const [sourceDatasetId, setSourceDatasetId] = useState<number | undefined>();
  const [targetDatasetId, setTargetDatasetId] = useState<number | undefined>();
  const [cardinality, setCardinality] = useState<Cardinality>('many_to_one');
  const [joinType, setJoinType] = useState<JoinType>('inner');
  const [pairs, setPairs] = useState<ColumnPair[]>([{}]);
  const [sourceColumns, setSourceColumns] = useState<DatasetColumn[]>([]);
  const [targetColumns, setTargetColumns] = useState<DatasetColumn[]>([]);

  useEffect(() => {
    setName(relationship?.name ?? '');
    setSourceDatasetId(relationship?.source_dataset_id);
    setTargetDatasetId(relationship?.target_dataset_id);
    setCardinality(relationship?.cardinality ?? 'many_to_one');
    setJoinType(relationship?.join_type ?? 'inner');
    setPairs(
      relationship?.columns.map(column => ({
        source_column_id: column.source_column_id,
        target_column_id: column.target_column_id,
      })) ?? [{}],
    );
  }, [relationship, show]);

  useEffect(() => {
    if (sourceDatasetId) {
      fetchColumns(sourceDatasetId).then(setSourceColumns);
    } else {
      setSourceColumns([]);
    }
  }, [sourceDatasetId]);

  useEffect(() => {
    if (targetDatasetId) {
      fetchColumns(targetDatasetId).then(setTargetColumns);
    } else {
      setTargetColumns([]);
    }
  }, [targetDatasetId]);

  const completePairs = useMemo(
    () =>
      pairs.filter(
        pair =>
          pair.source_column_id !== undefined &&
          pair.target_column_id !== undefined,
      ),
    [pairs],
  );

  const disableSave =
    !sourceDatasetId || !targetDatasetId || completePairs.length === 0;

  const handleSave = () => {
    if (disableSave) {
      return;
    }
    onSave(
      {
        name: name || null,
        source_dataset_id: sourceDatasetId as number,
        target_dataset_id: targetDatasetId as number,
        cardinality,
        join_type: joinType,
        is_active: relationship?.is_active ?? true,
        columns: completePairs.map((pair, ordinal) => ({
          source_column_id: pair.source_column_id as number,
          target_column_id: pair.target_column_id as number,
          ordinal,
        })),
      },
      relationship?.id,
    );
  };

  const updatePair = (index: number, pair: ColumnPair) =>
    setPairs(current =>
      current.map((item, position) =>
        position === index ? { ...item, ...pair } : item,
      ),
    );

  return (
    <Modal
      show={show}
      onHide={onHide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={handleSave}
      title={
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={isEditMode ? t('Edit relationship') : t('Add relationship')}
        />
      }
    >
      <StyledField>
        <div className="control-label">{t('Name')}</div>
        <Input
          name="name"
          aria-label={t('Name')}
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </StyledField>
      <StyledField>
        <div className="control-label">{t('Source dataset')}</div>
        <AsyncSelect
          ariaLabel={t('Source dataset')}
          value={sourceDatasetId}
          options={loadDatasetOptions}
          onChange={value => setSourceDatasetId(value as number)}
        />
      </StyledField>
      <StyledField>
        <div className="control-label">{t('Target dataset')}</div>
        <AsyncSelect
          ariaLabel={t('Target dataset')}
          value={targetDatasetId}
          options={loadDatasetOptions}
          onChange={value => setTargetDatasetId(value as number)}
        />
      </StyledField>
      <StyledField>
        <div className="control-label">{t('Cardinality')}</div>
        <Select
          ariaLabel={t('Cardinality')}
          value={cardinality}
          options={CARDINALITIES.map(value => ({
            value,
            label: cardinalityLabel(value),
          }))}
          onChange={value => setCardinality(value as Cardinality)}
        />
      </StyledField>
      <StyledField>
        <div className="control-label">{t('Join type')}</div>
        <Select
          ariaLabel={t('Join type')}
          value={joinType}
          options={JOIN_TYPES.map(value => ({
            value,
            label: joinTypeLabel(value),
          }))}
          onChange={value => setJoinType(value as JoinType)}
        />
      </StyledField>
      <StyledField>
        <div className="control-label">{t('Join columns')}</div>
        {pairs.map((pair, index) => (
          <StyledPair
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            data-test="dataset-relationship-column-pair"
          >
            <Select
              ariaLabel={t('Source column')}
              value={pair.source_column_id}
              options={sourceColumns.map(column => ({
                value: column.id,
                label: column.column_name,
              }))}
              onChange={value =>
                updatePair(index, { source_column_id: value as number })
              }
            />
            <Select
              ariaLabel={t('Target column')}
              value={pair.target_column_id}
              options={targetColumns.map(column => ({
                value: column.id,
                label: column.column_name,
              }))}
              onChange={value =>
                updatePair(index, { target_column_id: value as number })
              }
            />
            {pairs.length > 1 && (
              <Button
                buttonStyle="link"
                onClick={() =>
                  setPairs(current =>
                    current.filter((_, position) => position !== index),
                  )
                }
              >
                {t('Remove')}
              </Button>
            )}
          </StyledPair>
        ))}
        <Button
          buttonStyle="link"
          onClick={() => setPairs(current => [...current, {}])}
        >
          {t('Add column pair')}
        </Button>
      </StyledField>
    </Modal>
  );
}
