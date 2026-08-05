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
 * @fileoverview Shared registration and resolution model for contribution
 * points that wrap built-in functionality.
 *
 * A contribution point has two tiers:
 *
 * - the default tier, occupied by the built-in extension, which registers
 *   through the contribution point itself under a reserved `superset.` id and
 *   independently of the extensions feature flag or the extensions loader;
 * - the override tier, occupied by providers registered through the public
 *   extension API.
 *
 * Resolution lives here rather than in a host code branch, so that
 * introspection is truthful: `getDefault`, `getOverride`, and `getActive` each
 * answer what they say, and disposing an override falls back to the default
 * through the registry.
 */

import { Disposable } from '../models';

/** A provider along with the id it was registered under. */
export interface RegistryEntry<T> {
  /** Unique provider id. */
  id: string;
  /** The registered provider. */
  provider: T;
}

/**
 * A replaceable (single slot) contribution point: at most one override
 * occupies the slot at a time, and the most recent registration displaces the
 * previous override, never the default.
 */
export class DefaultableRegistry<T> {
  protected defaultEntry: RegistryEntry<T> | undefined;

  protected overrideEntry: RegistryEntry<T> | undefined;

  private listeners: Set<() => void> = new Set();

  private readonly onChange: (() => void) | undefined;

  constructor(onChange?: () => void) {
    this.onChange = onChange;
  }

  /**
   * Stable-reference subscribe function for `useSyncExternalStore`.
   */
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Notifies subscribers that resolution may have changed. */
  protected notify(): void {
    this.listeners.forEach(listener => listener());
    this.onChange?.();
  }

  /**
   * Sets the built-in provider occupying the default tier. Host-internal and
   * idempotent by id: registering the same id again is a no-op.
   */
  public setDefaultProvider(id: string, provider: T): void {
    if (this.defaultEntry?.id === id) {
      return;
    }
    this.defaultEntry = { id, provider };
    this.notify();
  }

  /**
   * Registers a provider in the override tier, displacing any previous
   * override. Disposing the returned Disposable falls back to the default.
   */
  public registerProvider(id: string, provider: T): Disposable {
    const entry: RegistryEntry<T> = { id, provider };
    this.overrideEntry = entry;
    this.notify();

    return new Disposable(() => {
      if (this.overrideEntry !== entry) {
        return;
      }
      this.overrideEntry = undefined;
      this.notify();
    });
  }

  /** The built-in provider, if one occupies the default tier. */
  public getDefault(): T | undefined {
    return this.defaultEntry?.provider;
  }

  /** The provider registered by an extension, if any. */
  public getOverride(): T | undefined {
    return this.overrideEntry?.provider;
  }

  /** The provider that actually renders: `override ?? default`. */
  public getActive(): T | undefined {
    return this.getOverride() ?? this.getDefault();
  }

  /** The id of the active provider, if any. */
  public getActiveId(): string | undefined {
    return this.overrideEntry?.id ?? this.defaultEntry?.id;
  }

  /** Clears both tiers. Intended for tests. */
  public reset(): void {
    this.defaultEntry = undefined;
    this.overrideEntry = undefined;
    this.listeners.clear();
  }
}

export default DefaultableRegistry;
