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

import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import type { DatasetNodeData } from './types';

const StyledNode = styled.div(
  ({ theme }) => css`
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    min-width: ${theme.sizeUnit * 40}px;
    text-align: center;
  `,
);

const StyledWarning = styled.div(
  ({ theme }) => css`
    color: ${theme.colorWarningText};
    font-size: ${theme.fontSizeSM}px;
  `,
);

export default function DatasetNode({ data }: NodeProps) {
  const { label, relationshipCount, hasInvalidColumns } =
    data as DatasetNodeData;
  return (
    <StyledNode data-test="dataset-relationship-node">
      <Handle type="target" position={Position.Left} />
      <Typography.Text strong>{label}</Typography.Text>
      <div>
        <Typography.Text type="secondary">
          {t('%s relationship(s)', relationshipCount)}
        </Typography.Text>
      </div>
      {hasInvalidColumns && (
        <StyledWarning>
          <Icons.WarningOutlined iconSize="s" /> {t('Missing columns')}
        </StyledWarning>
      )}
      <Handle type="source" position={Position.Right} />
    </StyledNode>
  );
}
