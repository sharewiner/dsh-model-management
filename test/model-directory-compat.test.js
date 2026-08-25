import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelDirectoryCompat } from '../lib/model-directory-compat.js';

function createStore(snapshot) {
  return {
    snapshot,
    getSnapshot() { return this.snapshot; },
    update(mutator) { mutator(this.snapshot); },
  };
}

function createDirectory(result) {
  const store = createStore({ current: result.current, groups: [], status: 'idle' });
  return {
    store,
    calls: 0,
    async load() {
      this.calls += 1;
      this.store.update((state) => {
        state.current = result.current;
        state.groups = structuredClone(result.groups);
      });
      return structuredClone(result);
    },
  };
}

function createResolver(entries = []) {
  const directories = new Map(entries);
  return {
    live: { directories },
    directoryFor(sessionId) {
      const directory = directories.get(sessionId);
      if (!directory) throw new Error(`unknown session ${sessionId}`);
      return directory;
    },
  };
}

const result = {
  current: { provider: 'openai', model: 'sol' },
  groups: [
    { id: 'deepseek', models: [{ id: 'flash' }] },
    { id: 'openai', models: [{ id: 'sol' }, { id: 'terra' }] },
  ],
};

test('filters existing and newly resolved session directories', async () => {
  const first = createDirectory(result);
  const second = createDirectory(result);
  const resolver = createResolver([['first', first], ['second', second]]);
  const compat = createModelDirectoryCompat({
    directories: resolver,
    getControl: () => ({ hidden: ['openai/terra'], disabledProviders: ['deepseek'] }),
  });

  await first.load();
  const loaded = await resolver.directoryFor('second').load();

  assert.deepEqual(first.store.getSnapshot().groups, [{ id: 'openai', models: [{ id: 'sol' }] }]);
  assert.deepEqual(loaded.groups, [{ id: 'openai', models: [{ id: 'sol' }] }]);
  assert.equal(compat.compatible, true);
});

test('preserves a current model from a disabled provider', async () => {
  const directory = createDirectory({
    current: { provider: 'deepseek', model: 'flash' },
    groups: result.groups,
  });
  const resolver = createResolver([['session', directory]]);
  createModelDirectoryCompat({
    directories: resolver,
    getControl: () => ({ hidden: [], disabledProviders: ['deepseek'] }),
  });

  const loaded = await directory.load();
  assert.deepEqual(loaded.groups, [
    { id: 'deepseek', models: [{ id: 'flash' }] },
    { id: 'openai', models: [{ id: 'sol' }, { id: 'terra' }] },
  ]);
});

test('is idempotent and restores original resolver and directory methods on dispose', async () => {
  const directory = createDirectory(result);
  const resolver = createResolver([['session', directory]]);
  const originalDirectoryFor = resolver.directoryFor;
  const originalLoad = directory.load;
  const first = createModelDirectoryCompat({ directories: resolver, getControl: () => ({}) });
  const second = createModelDirectoryCompat({ directories: resolver, getControl: () => ({}) });

  assert.notEqual(resolver.directoryFor, originalDirectoryFor);
  assert.equal(second, first);
  assert.equal(second.compatible, true);
  first.dispose();
  assert.equal(resolver.directoryFor, originalDirectoryFor);
  assert.equal(directory.load, originalLoad);
  second.dispose();
  const callsBeforeRestoreCheck = directory.calls;
  await directory.load();
  assert.equal(directory.calls, callsBeforeRestoreCheck + 1);
});

test('does not modify unsupported resolver or directory shapes', () => {
  const warnings = [];
  const unsupported = createModelDirectoryCompat({
    directories: {},
    getControl: () => ({}),
    onIncompatible: (reason) => warnings.push(reason),
  });
  assert.equal(unsupported.compatible, false);
  assert.equal(warnings.length, 1);

  const resolver = createResolver([['session', { load() {} }]]);
  const originalDirectoryFor = resolver.directoryFor;
  const compat = createModelDirectoryCompat({
    directories: resolver,
    getControl: () => ({}),
    onIncompatible: (reason) => warnings.push(reason),
  });
  resolver.directoryFor('session');
  assert.equal(compat.compatible, true);
  assert.equal(typeof resolver.directoryFor, 'function');
  compat.dispose();
  assert.equal(resolver.directoryFor, originalDirectoryFor);
  assert.equal(warnings.length, 2);
});

test('fails open for primitive directory values', () => {
  const warnings = [];
  const resolver = createResolver([['session', 'unsupported']]);
  const compat = createModelDirectoryCompat({
    directories: resolver,
    getControl: () => ({}),
    onIncompatible: (reason) => warnings.push(reason),
  });

  assert.equal(compat.compatible, true);
  assert.equal(resolver.directoryFor('session'), 'unsupported');
  assert.equal(warnings.length, 1);
  compat.dispose();
});

test('dispose does not overwrite wrappers installed later', () => {
  const directory = createDirectory(result);
  const resolver = createResolver([['session', directory]]);
  const compat = createModelDirectoryCompat({ directories: resolver, getControl: () => ({}) });
  const laterDirectoryFor = () => directory;
  const laterLoad = async () => result;

  resolver.directoryFor = laterDirectoryFor;
  directory.load = laterLoad;
  compat.dispose();

  assert.equal(resolver.directoryFor, laterDirectoryFor);
  assert.equal(directory.load, laterLoad);
});
