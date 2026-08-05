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
import { DefaultableRegistry } from './DefaultableRegistry';

test('resolves the default when no override is registered', () => {
  const registry = new DefaultableRegistry<string>();
  registry.setDefaultProvider('superset.built-in', 'default');

  expect(registry.getDefault()).toBe('default');
  expect(registry.getOverride()).toBeUndefined();
  expect(registry.getActive()).toBe('default');
  expect(registry.getActiveId()).toBe('superset.built-in');
});

test('an override takes precedence over the default', () => {
  const registry = new DefaultableRegistry<string>();
  registry.setDefaultProvider('superset.built-in', 'default');
  registry.registerProvider('acme.override', 'override');

  expect(registry.getDefault()).toBe('default');
  expect(registry.getOverride()).toBe('override');
  expect(registry.getActive()).toBe('override');
  expect(registry.getActiveId()).toBe('acme.override');
});

test('disposing an override falls back to the default', () => {
  const registry = new DefaultableRegistry<string>();
  registry.setDefaultProvider('superset.built-in', 'default');
  const disposable = registry.registerProvider('acme.override', 'override');

  disposable.dispose();

  expect(registry.getOverride()).toBeUndefined();
  expect(registry.getActive()).toBe('default');
});

test('the most recent override displaces the previous one, never the default', () => {
  const registry = new DefaultableRegistry<string>();
  registry.setDefaultProvider('superset.built-in', 'default');
  const first = registry.registerProvider('acme.first', 'first');
  registry.registerProvider('acme.second', 'second');

  expect(registry.getActive()).toBe('second');

  // Disposing the displaced override does not disturb the active one
  first.dispose();
  expect(registry.getActive()).toBe('second');
  expect(registry.getDefault()).toBe('default');
});

test('setting the default is idempotent by id', () => {
  const registry = new DefaultableRegistry<string>();
  const listener = jest.fn();
  registry.subscribe(listener);

  registry.setDefaultProvider('superset.built-in', 'default');
  registry.setDefaultProvider('superset.built-in', 'default');

  expect(listener).toHaveBeenCalledTimes(1);
});

test('notifies subscribers when resolution changes', () => {
  const onChange = jest.fn();
  const registry = new DefaultableRegistry<string>(onChange);
  const listener = jest.fn();
  const unsubscribe = registry.subscribe(listener);

  registry.registerProvider('acme.override', 'override');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledTimes(1);

  unsubscribe();
  registry.registerProvider('acme.other', 'other');
  expect(listener).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledTimes(2);
});
