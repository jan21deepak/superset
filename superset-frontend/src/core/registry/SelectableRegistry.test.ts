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
import { SelectableRegistry } from './SelectableRegistry';

const build = () => {
  const registry = new SelectableRegistry<string>();
  registry.setDefaultProvider('superset.built-in', 'default');
  return registry;
};

test('added providers coexist with the default', () => {
  const registry = build();
  registry.registerProvider('acme.added', 'added');

  expect(registry.getAll()).toEqual([
    { id: 'superset.built-in', provider: 'default' },
    { id: 'acme.added', provider: 'added' },
  ]);
  expect(registry.getDefault()).toBe('default');
});

test('the most recently added provider is active while nothing is selected', () => {
  const registry = build();
  registry.registerProvider('acme.first', 'first');
  registry.registerProvider('acme.second', 'second');

  expect(registry.getActive()).toBe('second');
  expect(registry.getSelection()).toBeUndefined();
});

test('the selection decides which provider is active', () => {
  const registry = build();
  registry.registerProvider('acme.added', 'added');

  registry.setSelection('superset.built-in');
  expect(registry.getActive()).toBe('default');
  expect(registry.getActiveId()).toBe('superset.built-in');

  registry.setSelection('acme.added');
  expect(registry.getActive()).toBe('added');

  registry.setSelection(undefined);
  expect(registry.getActive()).toBe('added');
});

test('an unknown selection is ignored', () => {
  const registry = build();
  registry.setSelection('acme.missing');

  expect(registry.getSelection()).toBeUndefined();
  expect(registry.getActive()).toBe('default');
});

test('disposing a provider clears its selection and falls back', () => {
  const registry = build();
  registry.registerProvider('acme.first', 'first');
  const second = registry.registerProvider('acme.second', 'second');
  registry.setSelection('acme.second');

  second.dispose();

  expect(registry.getSelection()).toBeUndefined();
  expect(registry.getActive()).toBe('first');
  expect(registry.getAll()).toHaveLength(2);
});

test('disposing the last added provider falls back to the default', () => {
  const registry = build();
  const disposable = registry.registerProvider('acme.added', 'added');

  disposable.dispose();

  expect(registry.getOverride()).toBeUndefined();
  expect(registry.getActive()).toBe('default');
});
