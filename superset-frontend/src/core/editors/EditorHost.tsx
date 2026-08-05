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
 * @fileoverview EditorHost component for dynamic editor resolution.
 *
 * The component renders whichever provider the `editors` contribution point
 * resolves as active for the language. Resolution, including the fallback to
 * the built-in editor, is owned by the registry, so the host has a single code
 * path for built-in and extension editors alike.
 */

import { useSyncExternalStore, forwardRef } from 'react';
import type { editors } from '@apache-superset/core';
import { useTheme } from '@apache-superset/core/theme';
import EditorProviders from './EditorProviders';
import './registerDefaults';

type EditorProps = editors.EditorProps;
type EditorHandle = editors.EditorHandle;

/**
 * Props for EditorHost component.
 * Uses the generic EditorProps interface that all editor implementations support.
 */
export type EditorHostProps = EditorProps;

/**
 * EditorHost component that dynamically resolves and renders the appropriate editor.
 *
 * This component serves as the main entry point for rendering editors in Superset.
 * It renders the active provider for the requested language: an extension's
 * editor when one is registered, otherwise the built-in default.
 *
 * @example
 * ```tsx
 * <EditorHost
 *   id="sql-editor-1"
 *   value={sql}
 *   onChange={setSql}
 *   language="sql"
 *   height="400px"
 * />
 * ```
 */
const EditorHost = forwardRef<EditorHandle, EditorHostProps>((props, ref) => {
  const { language } = props;
  const theme = useTheme();
  const manager = EditorProviders.getInstance();
  const getProvider = () => manager.getProvider(language);
  const provider = useSyncExternalStore(
    manager.subscribe,
    getProvider,
    getProvider,
  );

  if (!provider) {
    return null;
  }

  const EditorComponent = provider.component;
  return <EditorComponent ref={ref} {...props} theme={theme} />;
});

EditorHost.displayName = 'EditorHost';

export default EditorHost;

export { EditorHost };
