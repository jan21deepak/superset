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
 * @fileoverview Host implementation of the `editors` contribution type.
 *
 * Extensions register via the public `editors.registerEditor()` and the
 * registry resolves the active provider per language, falling back to the
 * built-in editor which registers itself through the same contribution point.
 *
 * The public namespace (`editors`) is exposed to extensions on `window.superset`.
 * `EditorHost` is the host-internal component for rendering editors and is NOT
 * part of the public `@apache-superset/core` API.
 */

import { useSyncExternalStore } from 'react';
import { editors as editorsApi } from '@apache-superset/core';
import EditorProviders from './EditorProviders';
import './registerDefaults';

export type { EditorHostProps } from './EditorHost';
export { default as EditorHost } from './EditorHost';
export { default as AceEditorProvider } from './AceEditorProvider';
export { ACE_EDITOR_ID } from './registerDefaults';

const provider = EditorProviders.getInstance();

export const useEditor = (language: editorsApi.EditorLanguage) =>
  useSyncExternalStore(
    provider.subscribe,
    () => provider.getProvider(language),
    () => undefined,
  );

/**
 * Host-internal accessors for the per-language provider selection. Which
 * choice it is and at what scope it is stored belongs to the surface, so the
 * selection is not part of the public extension API.
 */
export const editorSelection = {
  getProviders: provider.getProvidersForLanguage.bind(provider),
  getSelected: provider.getSelectedProvider.bind(provider),
  setSelected: provider.setSelectedProvider.bind(provider),
  subscribe: provider.subscribe,
};

export const editors: typeof editorsApi = {
  registerEditor: provider.registerProvider.bind(provider),
  getEditor: provider.getProvider.bind(provider),
  getDefaultEditor: provider.getDefaultProvider.bind(provider),
  getOverrideEditor: provider.getOverrideProvider.bind(provider),
  hasEditor: provider.hasProvider.bind(provider),
  getAllEditors: provider.getAllProviders.bind(provider),
  onDidRegisterEditor: provider.onDidRegister.bind(provider),
  onDidUnregisterEditor: provider.onDidUnregister.bind(provider),
};
