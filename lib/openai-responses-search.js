export const SEARCH_PROVIDER_ID = 'model-management-openai-responses';

export function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export function citationsFromOutput(output) {
  const sources = [];
  const seen = new Set();

  for (const item of output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type !== 'output_text') continue;
      for (const annotation of content.annotations || []) {
        if (annotation.type !== 'url_citation' || typeof annotation.url !== 'string' || seen.has(annotation.url)) continue;
        seen.add(annotation.url);
        sources.push({
          url: annotation.url,
          ...(typeof annotation.title === 'string' && annotation.title.length > 0 ? { title: annotation.title } : {}),
        });
      }
    }
  }

  return sources;
}

export async function resolveApiKey({ apiKeyEnv, credentials, credentialReference, getAmbient, createError }) {
  if (credentials !== undefined) {
    const value = await credentials.resolve(credentialReference(apiKeyEnv));
    if (value?.value) return value.value;
  }

  const ambient = getAmbient(apiKeyEnv);
  if (ambient?.value) return ambient.value;
  throw createError(`OpenAI search has no API key for "${apiKeyEnv}"`, 'WEB_PROVIDER_CREDENTIAL_MISSING');
}

export function selectedOpenAIProfile(selection, providers) {
  if (!selection?.provider || !selection?.model) return undefined;
  const profile = providers?.[selection.provider];
  if (!profile || profile.api !== 'openai-responses' || typeof profile.baseURL !== 'string' || profile.baseURL.length === 0) return undefined;

  const modelIsConfigured = !Array.isArray(profile.models) || profile.models.some((entry) => entry?.id === selection.model);
  if (!modelIsConfigured) return undefined;

  return {
    provider: selection.provider,
    model: selection.model,
    baseURL: trimTrailingSlash(profile.baseURL),
    apiKeyEnv: profile.apiKeyEnv,
  };
}

function boundedMessage(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\r\n\t]+/g, ' ').trim();
  return normalized.length === 0 ? fallback : normalized.slice(0, 500);
}

export function createOpenAIResponsesSearchProvider({ getProfile, resolveApiKey, fetchImpl, createError }) {
  return {
    id: SEARCH_PROVIDER_ID,
    available() {
      const profile = getProfile();
      return profile !== undefined && URL.canParse(profile.baseURL) && typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv.length > 0;
    },
    async search(request, signal) {
      const profile = getProfile();
      if (profile === undefined) {
        throw createError('Web search requires the current default model to use a configured OpenAI Responses provider.', 'WEB_PROVIDER_UNAVAILABLE');
      }

      const key = await resolveApiKey(profile.apiKeyEnv);
      let response;
      try {
        response = await fetchImpl(`${profile.baseURL}/responses`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            model: profile.model,
            input: `Search the web for the following query. Return reliable, relevant sources: ${request.query}`,
            tools: [{ type: 'web_search' }],
          }),
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        if (signal?.aborted) throw createError('OpenAI search aborted', 'WEB_ABORTED', { cause: signal.reason });
        throw createError(`OpenAI search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error });
      }

      if (!response.ok) {
        let message = `OpenAI API error (HTTP ${response.status})`;
        try {
          const body = await response.json();
          message = boundedMessage(body?.error?.message || body?.message, message);
        } catch {}
        throw createError(message, 'WEB_PROVIDER_ERROR');
      }

      let body;
      try {
        body = await response.json();
      } catch (error) {
        throw createError(`OpenAI returned an invalid response: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error });
      }

      const sources = citationsFromOutput(body.output);
      if (sources.length === 0) throw createError('OpenAI search returned no URL citations', 'WEB_PROVIDER_ERROR');
      return { sources, truncated: false };
    },
  };
}
