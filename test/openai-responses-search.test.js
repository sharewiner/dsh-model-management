import test from 'node:test';
import assert from 'node:assert/strict';
import {
  citationsFromOutput,
  createOpenAIResponsesSearchProvider,
  resolveApiKey,
  selectedOpenAIProfile,
} from '../lib/openai-responses-search.js';

function createError(message, code, options = {}) {
  const error = new Error(message, { cause: options.cause });
  error.code = code;
  return error;
}

const profile = {
  provider: 'openai',
  model: 'gpt-test',
  baseURL: 'https://api.example.test/v1',
  apiKeyEnv: 'OPENAI_API_KEY',
};

function provider(overrides = {}) {
  return createOpenAIResponsesSearchProvider({
    getProfile: () => profile,
    resolveApiKey: async () => 'test-key',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        output: [{
          type: 'message',
          content: [{
            type: 'output_text',
            annotations: [
              { type: 'url_citation', url: 'https://one.example', title: 'One' },
              { type: 'url_citation', url: 'https://one.example', title: 'Duplicate' },
              { type: 'url_citation', url: 'https://two.example' },
            ],
          }],
        }],
      }),
    }),
    createError,
    ...overrides,
  });
}

test('extracts only unique URL citations from output text', () => {
  assert.deepEqual(citationsFromOutput([
    { type: 'message', content: [{ type: 'output_text', annotations: [{ type: 'url_citation', url: 'https://one.example' }] }] },
    { type: 'reasoning', content: [{ type: 'output_text', annotations: [{ type: 'url_citation', url: 'https://ignored.example' }] }] },
  ]), [{ url: 'https://one.example' }]);
});

test('prefers the credential service, falls back to ambient values, and reports missing keys', async () => {
  const credentialReference = (name) => ({ name });
  const fromCredentials = await resolveApiKey({
    apiKeyEnv: 'OPENAI_API_KEY',
    credentials: { resolve: async () => ({ value: 'credential-key' }) },
    credentialReference,
    getAmbient: () => ({ value: 'ambient-key' }),
    createError,
  });
  assert.equal(fromCredentials, 'credential-key');

  const fromAmbient = await resolveApiKey({
    apiKeyEnv: 'OPENAI_API_KEY',
    credentials: { resolve: async () => undefined },
    credentialReference,
    getAmbient: () => ({ value: 'ambient-key' }),
    createError,
  });
  assert.equal(fromAmbient, 'ambient-key');

  await assert.rejects(resolveApiKey({
    apiKeyEnv: 'OPENAI_API_KEY',
    credentials: undefined,
    credentialReference,
    getAmbient: () => undefined,
    createError,
  }), { code: 'WEB_PROVIDER_CREDENTIAL_MISSING' });
});

test('selects only configured openai-responses default models', () => {
  const providers = {
    openai: {
      api: 'openai-responses',
      baseURL: 'https://api.example.test/v1/',
      apiKeyEnv: 'OPENAI_API_KEY',
      models: [{ id: 'gpt-test' }],
    },
  };
  assert.deepEqual(selectedOpenAIProfile({ provider: 'openai', model: 'gpt-test' }, providers), profile);
  assert.equal(selectedOpenAIProfile({ provider: 'openai', model: 'other' }, providers), undefined);
  assert.equal(selectedOpenAIProfile({ provider: 'openai', model: 'gpt-test' }, { openai: { ...providers.openai, api: 'openai-completions' } }), undefined);
});

test('builds a web-search request without exposing credentials in output', async () => {
  let request;
  const search = provider({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', annotations: [{ type: 'url_citation', url: 'https://source.example' }] }] }] }),
      };
    },
  });

  assert.equal(search.available(), true);
  assert.deepEqual(await search.search({ query: 'latest DSH release' }), {
    sources: [{ url: 'https://source.example' }],
    truncated: false,
  });
  assert.equal(request.url, 'https://api.example.test/v1/responses');
  assert.equal(request.options.headers.authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'gpt-test',
    input: 'Search the web for the following query. Return reliable, relevant sources: latest DSH release',
    tools: [{ type: 'web_search' }],
  });
});

test('rejects unavailable profiles and missing citations', async () => {
  const unavailable = provider({ getProfile: () => undefined });
  await assert.rejects(unavailable.search({ query: 'query' }), { code: 'WEB_PROVIDER_UNAVAILABLE' });

  const noCitations = provider({
    fetchImpl: async () => ({ ok: true, json: async () => ({ output: [] }) }),
  });
  await assert.rejects(noCitations.search({ query: 'query' }), { code: 'WEB_PROVIDER_ERROR', message: 'OpenAI search returned no URL citations' });
});

test('maps HTTP and aborted network failures to bounded errors', async () => {
  const httpFailure = provider({
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) }),
  });
  await assert.rejects(httpFailure.search({ query: 'query' }), { code: 'WEB_PROVIDER_ERROR', message: 'rate limited' });

  const longFailure = provider({
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: { message: `unsafe\n${'x'.repeat(600)}` } }) }),
  });
  await assert.rejects(longFailure.search({ query: 'query' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR');
    assert.equal(error.message.length, 500);
    assert.equal(error.message.includes('\n'), false);
    return true;
  });

  const controller = new AbortController();
  controller.abort('cancelled');
  const aborted = provider({ fetchImpl: async () => { throw new Error('network down'); } });
  await assert.rejects(aborted.search({ query: 'query' }, controller.signal), { code: 'WEB_ABORTED', message: 'OpenAI search aborted' });
});
