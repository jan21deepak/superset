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

import type { editors } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';
import { SelectableRegistry } from '../registry';

type EditorLanguage = editors.EditorLanguage;
type EditorProvider = editors.EditorProvider;
type Editor = editors.Editor;
type EditorComponent = editors.EditorComponent;
type EditorRegisteredEvent = editors.EditorRegisteredEvent;
type EditorUnregisteredEvent = editors.EditorUnregisteredEvent;

type Listener<T> = (e: T) => void;

/**
 * Singleton manager for editor providers.
 *
 * Editors are an augmentable contribution point: the built-in editor occupies
 * the default tier per language and extensions add providers alongside it, so
 * a user selection can decide which one renders. Resolution is owned by a
 * {@link SelectableRegistry} per language rather than by a host code branch.
 */
class EditorProviders {
  private static instance: EditorProviders;

  /**
   * Map of provider ID to EditorProvider, covering both tiers.
   */
  private providers: Map<string, EditorProvider> = new Map();

  /**
   * Per-language resolution, owning the default and override tiers.
   */
  private registries: Map<EditorLanguage, SelectableRegistry<EditorProvider>> =
    new Map();

  private registerEmitter = createEventEmitter<EditorRegisteredEvent>();

  private unregisterEmitter = createEventEmitter<EditorUnregisteredEvent>();

  private syncListeners: Set<() => void> = new Set();

  /**
   * Stable-reference subscribe function for useSyncExternalStore.
   * Defined as an arrow property so the reference is bound to this instance at construction.
   */
  public subscribe = (listener: () => void): (() => void) => {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  };

  // eslint-disable-next-line no-useless-constructor
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of EditorProviders.
   * @returns The singleton instance.
   */
  public static getInstance(): EditorProviders {
    if (!EditorProviders.instance) {
      EditorProviders.instance = new EditorProviders();
    }
    return EditorProviders.instance;
  }

  private notify(): void {
    this.syncListeners.forEach(l => l());
  }

  private registryFor(
    language: EditorLanguage,
  ): SelectableRegistry<EditorProvider> {
    let registry = this.registries.get(language);
    if (!registry) {
      registry = new SelectableRegistry<EditorProvider>(() => this.notify());
      this.registries.set(language, registry);
    }
    return registry;
  }

  /**
   * Register the built-in editor as the default provider for its languages.
   *
   * Host-internal and idempotent by id: it is deliberately not exposed on
   * `window.superset`, and it is independent of the extensions feature flag
   * and the extensions loader so that core surfaces always render.
   *
   * @param editor The editor descriptor, using a reserved `superset.` id.
   * @param component The React component implementing the editor.
   */
  public setDefaultProvider(editor: Editor, component: EditorComponent): void {
    const provider: EditorProvider = { editor, component };
    this.providers.set(editor.id, provider);
    editor.languages.forEach(language => {
      this.registryFor(language).setDefaultProvider(editor.id, provider);
    });
  }

  /**
   * Register an editor provider alongside the built-in default.
   *
   * The most recently registered provider is active for its languages until a
   * selection is made; disposing it falls back through the registry.
   *
   * @param editor The editor descriptor.
   * @param component The React component implementing the editor.
   * @returns A Disposable to unregister the provider.
   */
  public registerProvider(
    editor: Editor,
    component: EditorComponent,
  ): Disposable {
    const { id, languages } = editor;

    // Check if provider with this ID already exists
    if (this.providers.has(id)) {
      // eslint-disable-next-line no-console
      console.warn(`Editor provider with id "${id}" is already registered.`);
      return new Disposable(() => {});
    }

    const provider: EditorProvider = {
      editor,
      component,
    };

    this.providers.set(id, provider);

    const disposables = languages.map(language =>
      this.registryFor(language).registerProvider(id, provider),
    );

    // Fire registration event
    this.registerEmitter.fire({ editor });
    this.notify();

    // Return disposable for cleanup
    return new Disposable(() => {
      if (this.providers.get(id) !== provider) {
        return;
      }
      this.providers.delete(id);
      disposables.forEach(disposable => disposable.dispose());
      this.unregisterEmitter.fire({ editor });
      this.notify();
    });
  }

  /**
   * Get the active editor provider for a language: the extension provider when
   * one is registered, otherwise the built-in default.
   * @param language The language to get a provider for.
   * @returns The active provider, or undefined if the language has none.
   */
  public getProvider(language: EditorLanguage): EditorProvider | undefined {
    return this.registries.get(language)?.getActive();
  }

  /**
   * Get the built-in provider for a language, ignoring extensions.
   */
  public getDefaultProvider(
    language: EditorLanguage,
  ): EditorProvider | undefined {
    return this.registries.get(language)?.getDefault();
  }

  /**
   * Get the extension provider active for a language, if any.
   */
  public getOverrideProvider(
    language: EditorLanguage,
  ): EditorProvider | undefined {
    return this.registries.get(language)?.getOverride();
  }

  /**
   * Get every provider available for a language, the default first.
   */
  public getProvidersForLanguage(language: EditorLanguage): EditorProvider[] {
    return (
      this.registries
        .get(language)
        ?.getAll()
        .map(entry => entry.provider) ?? []
    );
  }

  /**
   * Get the id of the provider selected for a language, if any.
   */
  public getSelectedProvider(language: EditorLanguage): string | undefined {
    return this.registries.get(language)?.getSelection();
  }

  /**
   * Select which of the available providers renders for a language.
   */
  public setSelectedProvider(
    language: EditorLanguage,
    id: string | undefined,
  ): void {
    this.registries.get(language)?.setSelection(id);
  }

  /**
   * Check if a provider is available for a language.
   * @param language The language to check.
   * @returns True if an editor renders for this language.
   */
  public hasProvider(language: EditorLanguage): boolean {
    return this.getProvider(language) !== undefined;
  }

  /**
   * Check if an extension has overridden the built-in editor for a language.
   */
  public hasOverride(language: EditorLanguage): boolean {
    return this.getOverrideProvider(language) !== undefined;
  }

  /**
   * Get all registered providers, across both tiers.
   * @returns Array of all registered providers.
   */
  public getAllProviders(): EditorProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Subscribe to provider registration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidRegister(
    listener: Listener<EditorRegisteredEvent>,
    thisArgs?: unknown,
  ): Disposable {
    return this.registerEmitter.subscribe(listener, thisArgs);
  }

  /**
   * Subscribe to provider unregistration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidUnregister(
    listener: Listener<EditorUnregisteredEvent>,
    thisArgs?: unknown,
  ): Disposable {
    return this.unregisterEmitter.subscribe(listener, thisArgs);
  }

  /**
   * Reset the manager state. Intended for tests.
   */
  public reset(): void {
    this.providers.clear();
    this.registries.clear();
    this.syncListeners.clear();
    this.registerEmitter = createEventEmitter<EditorRegisteredEvent>();
    this.unregisterEmitter = createEventEmitter<EditorUnregisteredEvent>();
  }
}

export default EditorProviders;
