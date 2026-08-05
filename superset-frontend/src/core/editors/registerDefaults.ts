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

/**
 * @fileoverview Registers the built-in Ace editor as the default provider of
 * the `editors` contribution point.
 *
 * The registration is a side effect of importing this module wherever editors
 * render, so it happens independently of the extensions feature flag, the
 * extensions startup, and the extensions loader: a disabled or broken
 * extension system can never take an editor off screen. As a critical-path
 * built-in, the component is statically bundled rather than fetched through
 * the module federation runtime.
 */

import type { editors } from '@apache-superset/core';
import EditorProviders from './EditorProviders';
import AceEditorProvider from './AceEditorProvider';

/** Reserved id of the built-in editor. */
export const ACE_EDITOR_ID = 'superset.ace-editor';

const ACE_EDITOR_LANGUAGES: editors.EditorLanguage[] = [
  'sql',
  'json',
  'yaml',
  'markdown',
  'css',
  'python',
  'text',
  'javascript',
];

EditorProviders.getInstance().setDefaultProvider(
  {
    id: ACE_EDITOR_ID,
    name: 'Ace Editor',
    languages: ACE_EDITOR_LANGUAGES,
    description: 'The editor Superset ships with.',
  },
  AceEditorProvider,
);
