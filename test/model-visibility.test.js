import test from 'node:test';
import assert from 'node:assert/strict';
import { filterModelGroups, modelVisibilityKey } from '../lib/model-visibility.js';

const groups = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [{ id: 'flash' }, { id: 'pro' }],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [{ id: 'sol' }, { id: 'terra' }],
  },
];

test('returns all groups when no visibility controls are set', () => {
  assert.deepEqual(filterModelGroups(groups, [], [], null), groups);
});

test('removes every model from a disabled provider', () => {
  assert.deepEqual(filterModelGroups(groups, [], ['deepseek'], null), [groups[1]]);
});

test('removes one hidden model but keeps its provider group', () => {
  assert.deepEqual(filterModelGroups(groups, [modelVisibilityKey('openai', 'terra')], [], null), [
    groups[0],
    { ...groups[1], models: [{ id: 'sol' }] },
  ]);
});

test('keeps the current model visible even when its model or provider is hidden', () => {
  assert.deepEqual(filterModelGroups(groups, [modelVisibilityKey('deepseek', 'flash')], ['deepseek'], {
    provider: 'deepseek',
    model: 'flash',
  }), [
    { ...groups[0], models: [{ id: 'flash' }] },
    groups[1],
  ]);
});

test('removes groups with no visible models', () => {
  assert.deepEqual(filterModelGroups(groups, [
    modelVisibilityKey('openai', 'sol'),
    modelVisibilityKey('openai', 'terra'),
  ], [], null), [groups[0]]);
});

test('does not mutate the source directory', () => {
  const before = structuredClone(groups);
  filterModelGroups(groups, [modelVisibilityKey('openai', 'terra')], [], null);
  assert.deepEqual(groups, before);
});
