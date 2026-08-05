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

import { useEffect, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import { EmptyState } from '@superset-ui/core/components/EmptyState';
import DatasetNode from './DatasetNode';
import { buildGraph, edgeWarnings } from './utils';
import type { DatasetRelationship } from './types';

import '@xyflow/react/dist/style.css';

export interface RelationshipCanvasProps {
  relationships: DatasetRelationship[];
  onSelect?: (relationship: DatasetRelationship) => void;
}

const StyledCanvas = styled.div(
  ({ theme }) => css`
    height: 70vh;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `,
);

const StyledWarnings = styled.ul(
  ({ theme }) => css`
    color: ${theme.colorWarningText};
    margin: ${theme.sizeUnit * 2}px 0 0 0;
    padding-left: ${theme.sizeUnit * 4}px;
  `,
);

const nodeTypes: NodeTypes = { dataset: DatasetNode };

export default function RelationshipCanvas({
  relationships,
  onSelect,
}: RelationshipCanvasProps) {
  const graph = useMemo(() => buildGraph(relationships), [relationships]);
  // node state is local so that dragging a dataset around sticks
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const { edges } = graph;

  // a reload keeps wherever the user dragged a dataset to; only datasets that
  // weren't on the canvas yet get a laid out position
  useEffect(() => {
    setNodes(current => {
      const positions = new Map(current.map(node => [node.id, node.position]));
      return graph.nodes.map(node => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      }));
    });
  }, [graph, setNodes]);

  // several relationships can connect the same two datasets, so the text of a
  // warning isn't unique: it is keyed by the relationship it belongs to
  const warnings = useMemo(
    () =>
      relationships.flatMap(relationship =>
        edgeWarnings(relationship).map((warning, index) => ({
          key: `${relationship.id}-${index}`,
          text: `${relationship.source_dataset_name} → ${relationship.target_dataset_name}: ${warning}`,
        })),
      ),
    [relationships],
  );

  if (!relationships.length) {
    return (
      <EmptyState
        size="large"
        title={t('No relationships yet')}
        description={t(
          'Declare a relationship to visualize how your datasets connect. Relationships are metadata: they do not change how queries run.',
        )}
      />
    );
  }

  const handleEdgeClick = (_: unknown, edge: Edge) => {
    const relationship = relationships.find(({ id }) => String(id) === edge.id);
    if (relationship && onSelect) {
      onSelect(relationship);
    }
  };

  return (
    <>
      <StyledCanvas data-test="dataset-relationship-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgeClick={handleEdgeClick}
          fitView
          nodesDraggable
          zoomOnScroll
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </StyledCanvas>
      {warnings.length > 0 && (
        <StyledWarnings data-test="dataset-relationship-warnings">
          {warnings.map(warning => (
            <li key={warning.key}>{warning.text}</li>
          ))}
        </StyledWarnings>
      )}
    </>
  );
}
