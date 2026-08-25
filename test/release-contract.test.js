import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const expectedName = '@sharewiner/dsh-model-management';

test('package metadata satisfies the DSH market install boundary', async () => {
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.name, expectedName);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.publishConfig?.access, 'public');
  assert.equal(manifest.publishConfig?.registry, 'https://registry.npmjs.org');
  assert.equal(manifest.repository?.url, 'git+https://github.com/sharewiner/dsh-model-management.git');
  assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml');
  for (const script of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(Object.hasOwn(manifest.scripts || {}, script), false);
  }
  assert.equal(manifest.files.some((entry) => entry.startsWith('test')), false);
});

test('package, client loader, exports, and bundle patch use one identity', async () => {
  const manifest = JSON.parse(await read('package.json'));
  const client = await read('lib/client.js');
  const patch = await read('cordis.patch.yml');
  const readme = await read('README.md');
  const readmeZh = await read('README.zh-CN.md');
  const submission = await read('docs/marketplace-submission.md');

  assert.match(client, new RegExp(`id: '${expectedName.replace('/', '\\/')}'`));
  assert.doesNotMatch(client, new RegExp(`require\\('${expectedName.replace('/', '\\/')}/`));
  assert.match(client, /const visibility = \{/);
  assert.match(client, /const directoryCompat = \{/);
  assert.equal(manifest.exports['./model-visibility'], './lib/model-visibility.js');
  assert.equal(manifest.exports['./model-directory-compat'], './lib/model-directory-compat.js');
  assert.match(patch, new RegExp(`name: '${expectedName.replace('/', '\\/')}'`));
  const installRef = `${expectedName}@${manifest.version}`;
  assert.equal(readme.includes(installRef), true);
  assert.equal(readmeZh.includes(installRef), true);
  assert.equal(submission.includes(`Exact version: \`${manifest.version}\``), true);
});
