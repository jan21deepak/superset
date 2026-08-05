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

import { useCallback, useEffect, useState } from 'react';
import rison from 'rison';
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Loading } from '@superset-ui/core/components';
import SubMenu from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import RelationshipCanvas from 'src/features/datasetRelationships/RelationshipCanvas';
import RelationshipModal from 'src/features/datasetRelationships/RelationshipModal';
import type {
  DatasetRelationship,
  RelationshipPayload,
} from 'src/features/datasetRelationships/types';

interface DatasetRelationshipsProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const StyledContainer = styled.div(
  ({ theme }) => css`
    padding: ${theme.sizeUnit * 4}px;
  `,
);

function DatasetRelationships({
  addDangerToast,
  addSuccessToast,
}: DatasetRelationshipsProps) {
  const [relationships, setRelationships] = useState<DatasetRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DatasetRelationship | null>(null);

  const fetchRelationships = useCallback(() => {
    setLoading(true);
    const query = rison.encode({ page: 0, page_size: 100 });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset_relationship/?q=${query}`,
    })
      .then(response => setRelationships(response.json.result))
      .catch(response =>
        getClientErrorObject(response).then(({ message, error }) =>
          addDangerToast(
            message || error || t('There was an error fetching relationships'),
          ),
        ),
      )
      .finally(() => setLoading(false));
  }, [addDangerToast]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  const handleSave = (payload: RelationshipPayload, id?: number) => {
    const request = id
      ? SupersetClient.put({
          endpoint: `/api/v1/dataset_relationship/${id}`,
          jsonPayload: payload,
        })
      : SupersetClient.post({
          endpoint: '/api/v1/dataset_relationship/',
          jsonPayload: payload,
        });
    request
      .then(() => {
        setShowModal(false);
        setEditing(null);
        addSuccessToast(
          id ? t('Relationship updated') : t('Relationship created'),
        );
        return fetchRelationships();
      })
      .catch(response =>
        getClientErrorObject(response).then(({ message, error }) =>
          addDangerToast(
            message || error || t('There was an error saving the relationship'),
          ),
        ),
      );
  };

  return (
    <>
      <SubMenu
        name={t('Dataset relationships')}
        buttons={[
          {
            name: t('Relationship'),
            buttonStyle: 'primary',
            onClick: () => {
              setEditing(null);
              setShowModal(true);
            },
          },
        ]}
      />
      <StyledContainer>
        {loading ? (
          <Loading />
        ) : (
          <RelationshipCanvas
            relationships={relationships}
            onSelect={relationship => {
              setEditing(relationship);
              setShowModal(true);
            }}
          />
        )}
      </StyledContainer>
      <RelationshipModal
        show={showModal}
        relationship={editing}
        onHide={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </>
  );
}

export default withToasts(DatasetRelationships);
