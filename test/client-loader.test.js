import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const clientUrl = new URL('../lib/client.js', import.meta.url);

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
const groupIds = (groups) => Array.from(groups, (group) => ({
  id: group.id,
  models: Array.from(group.models, (model) => model.id),
}));

test('client loader uses only platform seeds and exercises the inlined compatibility layer', async () => {
  const source = await readFile(clientUrl, 'utf8');
  let descriptor;
  let styleRemoved = false;
  const warnings = [];
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) {
          descriptor = value;
        },
      },
    },
    document: {
      createElement(name) {
        assert.equal(name, 'style');
        return {
          textContent: '',
          remove() {
            styleRemoved = true;
          },
        };
      },
      head: {
        append() {},
      },
    },
    console: {
      warn(message) {
        warnings.push(message);
      },
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' });

  assert.equal(descriptor.id, '@sharewiner/dsh-model-management');
  const required = [];
  const plugin = descriptor.factory((specifier) => {
    required.push(specifier);
    if (specifier === 'react') return { createElement() { return null; } };
    throw new Error(`unexpected client require: ${specifier}`);
  });
  assert.deepEqual(required, ['react']);
  assert.equal(typeof plugin.apply, 'function');

  const originalResult = {
    groups: [
      { id: 'deepseek', models: [{ id: 'flash' }, { id: 'reasoner' }] },
      { id: 'openai', models: [{ id: 'sol' }, { id: 'terra' }] },
    ],
    current: { provider: 'deepseek', model: 'flash' },
  };
  let state = structuredClone(originalResult);
  const directory = {
    store: {
      update(callback) {
        callback(state);
      },
      getSnapshot() {
        return state;
      },
    },
    async load() {
      state = structuredClone(originalResult);
      return structuredClone(originalResult);
    },
  };
  const originalLoad = directory.load;
  const directories = {
    live: { directories: new Map([['session', directory]]) },
    directoryFor() {
      return directory;
    },
  };
  const originalDirectoryFor = directories.directoryFor;
  let stopped = false;
  const remote = {
    $on() {
      return () => {
        stopped = true;
      };
    },
  };
  const connection = {
    api: {
      settings: {
        async describe() {
          return {
            result: {
              ok: true,
              value: {
                namespaces: [{
                  ns: 'model-management-control',
                  value: {
                    hidden: ['openai/terra'],
                    disabledProviders: ['deepseek'],
                  },
                }],
              },
            },
          };
        },
      },
    },
  };
  const effects = [];
  const slots = {
    inject(_name, register) {
      register();
    },
    register() {
      return () => {};
    },
  };
  const ctx = {
    get(name) {
      return { modelDirectories: directories, connection, remote, slots }[name];
    },
    effect(install) {
      effects.push(install());
    },
  };

  plugin.apply(ctx);
  await flushPromises();
  const filtered = await directory.load();
  assert.deepEqual(groupIds(filtered.groups), [
    { id: 'deepseek', models: ['flash'] },
    { id: 'openai', models: ['sol'] },
  ]);
  assert.deepEqual(groupIds(state.groups), groupIds(filtered.groups));
  assert.equal(warnings.length, 0);

  for (const dispose of effects.reverse()) dispose();
  assert.equal(directories.directoryFor, originalDirectoryFor);
  assert.equal(directory.load, originalLoad);
  assert.equal(stopped, true);
  assert.equal(styleRemoved, true);
});
