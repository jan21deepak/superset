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
 * @fileoverview Resolution model for augmentable contribution points, where
 * the built-in default and any number of added providers coexist and a
 * selection decides which one is active.
 *
 * Whether a contribution point is replaceable or augmentable is a property of
 * the point, declared once, not a decision an individual extension makes.
 * Where the selection lives and at what scope it is stored belongs to the
 * surface, not to this registry: the registry only owns resolution.
 */

import { Disposable } from '../models';
import { DefaultableRegistry, RegistryEntry } from './DefaultableRegistry';

/**
 * An augmentable (multi provider) contribution point: the default and every
 * added provider are valid at once, and the active provider is the selected
 * one, falling back to the most recently added provider and then the default.
 */
export class SelectableRegistry<T> extends DefaultableRegistry<T> {
  private added: Map<string, T> = new Map();

  private selectedId: string | undefined;

  /**
   * Adds a provider alongside the default rather than replacing it. The most
   * recently added provider becomes active while no explicit selection is
   * made, which keeps replace-style registration working unchanged.
   */
  public override registerProvider(id: string, provider: T): Disposable {
    this.added.set(id, provider);
    super.registerProvider(id, provider);

    return new Disposable(() => {
      if (this.added.get(id) !== provider) {
        return;
      }
      this.added.delete(id);
      if (this.selectedId === id) {
        this.selectedId = undefined;
      }
      const [fallback] = Array.from(this.added.entries()).slice(-1);
      if (fallback) {
        super.registerProvider(fallback[0], fallback[1]);
      } else {
        this.clearOverride();
      }
    });
  }

  private clearOverride(): void {
    this.overrideEntry = undefined;
    this.notify();
  }

  /** Every provider valid for this point, the default first. */
  public getAll(): RegistryEntry<T>[] {
    const entries: RegistryEntry<T>[] = this.defaultEntry
      ? [this.defaultEntry]
      : [];
    this.added.forEach((provider, id) => entries.push({ id, provider }));
    return entries;
  }

  /** The id explicitly selected, if any. */
  public getSelection(): string | undefined {
    return this.selectedId;
  }

  /**
   * Selects the active provider by id. Passing `undefined` clears the
   * selection; an unknown id is ignored.
   */
  public setSelection(id: string | undefined): void {
    if (id !== undefined && !this.added.has(id) && this.defaultEntry?.id !== id)
      return;
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.notify();
  }

  public override getActive(): T | undefined {
    if (this.selectedId !== undefined) {
      if (this.selectedId === this.defaultEntry?.id) {
        return this.defaultEntry.provider;
      }
      const selected = this.added.get(this.selectedId);
      if (selected) {
        return selected;
      }
    }
    return super.getActive();
  }

  public override getActiveId(): string | undefined {
    if (this.selectedId !== undefined && this.getActive() !== undefined) {
      return this.selectedId;
    }
    return super.getActiveId();
  }

  public override reset(): void {
    this.added.clear();
    this.selectedId = undefined;
    super.reset();
  }
}

export default SelectableRegistry;
