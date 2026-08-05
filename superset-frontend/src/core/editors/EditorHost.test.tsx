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
import { render, screen, cleanup, act } from 'spec/helpers/testing-library';
import type { editors } from '@apache-superset/core';
import { forwardRef } from 'react';
import EditorHost from './EditorHost';
import EditorProviders from './EditorProviders';

// Mock the AceEditorProvider to avoid loading the full Ace editor in tests
jest.mock('./AceEditorProvider', () => ({
  __esModule: true,
  default: ({ id, value, language }: EditorProps) => (
    <div data-test="ace-editor-provider">
      <span data-test="ace-editor-id">{id}</span>
      <span data-test="ace-editor-value">{value}</span>
      <span data-test="ace-editor-language">{language}</span>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

type EditorProps = editors.EditorProps;

const defaultProps: EditorProps = {
  id: 'test-editor',
  value: 'SELECT * FROM table',
  onChange: jest.fn(),
  language: 'sql',
};

test('renders default Ace editor when no extension provider is registered', () => {
  render(<EditorHost {...defaultProps} />);

  expect(screen.getByTestId('ace-editor-provider')).toBeInTheDocument();
  expect(screen.getByTestId('ace-editor-id')).toHaveTextContent('test-editor');
  expect(screen.getByTestId('ace-editor-value')).toHaveTextContent(
    'SELECT * FROM table',
  );
  expect(screen.getByTestId('ace-editor-language')).toHaveTextContent('sql');
});

test('passes id prop to the editor', () => {
  render(<EditorHost {...defaultProps} id="custom-id" />);

  expect(screen.getByTestId('ace-editor-id')).toHaveTextContent('custom-id');
});

test('passes value prop to the editor', () => {
  render(<EditorHost {...defaultProps} value="SELECT 1" />);

  expect(screen.getByTestId('ace-editor-value')).toHaveTextContent('SELECT 1');
});

test('passes language option to the editor', () => {
  render(<EditorHost {...defaultProps} language="json" />);

  expect(screen.getByTestId('ace-editor-language')).toHaveTextContent('json');
});

test('renders the extension editor and falls back to the built-in on disposal', () => {
  const ExtensionEditor = forwardRef(() => (
    <div data-test="extension-editor" />
  )) as editors.EditorComponent;

  const disposable = EditorProviders.getInstance().registerProvider(
    { id: 'acme.monaco', name: 'Monaco', languages: ['sql'] },
    ExtensionEditor,
  );

  const { rerender } = render(<EditorHost {...defaultProps} />);
  expect(screen.getByTestId('extension-editor')).toBeInTheDocument();

  act(() => disposable.dispose());
  rerender(<EditorHost {...defaultProps} />);

  expect(screen.getByTestId('ace-editor-provider')).toBeInTheDocument();
});
