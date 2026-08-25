import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { WebError } from '@deepseek-ai/dsh-web';

export const name = 'model-management';
export const inject = ['agentDefaultModel', 'settings', 'web'];

export const MODEL_MANAGEMENT_CONTROL_NAMESPACE = settingsNamespace('model-management-control');

const ControlConfig = z.object({
  hidden: z.array(z.string()).default([]),
  disabledProviders: z.array(z.string()).default([])
});

const SEARCH_PROVIDER_ID = 'model-management-openai-responses';
const PI_AI_NAMESPACE = settingsNamespace('llm-pi-ai');

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function citationsFromOutput(output) {
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

async function resolveApiKey(ctx, apiKeyEnv) {
  const credentials = ctx.get('credentials');
  if (credentials !== undefined) {
    const value = await credentials.resolve(credentialRef(apiKeyEnv));
    if (value?.value) return value.value;
  }

  const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
  if (ambient?.value) return ambient.value;
  throw new WebError(`OpenAI search has no API key for "${apiKeyEnv}"`, 'WEB_PROVIDER_CREDENTIAL_MISSING');
}

function selectedOpenAIProfile(ctx) {
  const selected = ctx.agentDefaultModel.currentSelection();
  if (!selected?.provider || !selected?.model) return undefined;

  const profile = ctx.settings.get(PI_AI_NAMESPACE)?.providers?.[selected.provider];
  if (!profile || profile.api !== 'openai-responses' || typeof profile.baseURL !== 'string' || profile.baseURL.length === 0) return undefined;

  const modelIsConfigured = !Array.isArray(profile.models) || profile.models.some((entry) => entry?.id === selected.model);
  if (!modelIsConfigured) return undefined;

  return {
    provider: selected.provider,
    model: selected.model,
    baseURL: trimTrailingSlash(profile.baseURL),
    apiKeyEnv: profile.apiKeyEnv,
  };
}

function registerOpenAIResponsesSearch(ctx) {
  ctx.web.registerSearchProvider({
    id: SEARCH_PROVIDER_ID,
    available() {
      const profile = selectedOpenAIProfile(ctx);
      return profile !== undefined && URL.canParse(profile.baseURL) && typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv.length > 0;
    },
    async search(request, signal) {
      const profile = selectedOpenAIProfile(ctx);
      if (profile === undefined) {
        throw new WebError('Web search requires the current default model to use a configured OpenAI Responses provider.', 'WEB_PROVIDER_UNAVAILABLE');
      }

      const key = await resolveApiKey(ctx, profile.apiKeyEnv);
      let response;

      try {
        response = await fetch(`${profile.baseURL}/responses`, {
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
        if (signal?.aborted) throw new WebError('OpenAI search aborted', 'WEB_ABORTED', { cause: signal.reason });
        throw new WebError(`OpenAI search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error });
      }

      if (!response.ok) {
        let message = `OpenAI API error (HTTP ${response.status})`;
        try {
          const body = await response.json();
          message = body?.error?.message || body?.message || message;
        } catch {}
        throw new WebError(message, 'WEB_PROVIDER_ERROR');
      }

      let body;
      try {
        body = await response.json();
      } catch (error) {
        throw new WebError(`OpenAI returned an invalid response: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error });
      }

      const sources = citationsFromOutput(body.output);
      if (sources.length === 0) throw new WebError('OpenAI search returned no URL citations', 'WEB_PROVIDER_ERROR');
      return { sources, truncated: false };
    },
  });
}

/**
 * Native `llm-pi-ai` settings remain the source of truth for providers and
 * models. This plugin adds presentation settings and OpenAI web search.
 */
export function apply(ctx, config) {
  installSettingsSection(ctx, MODEL_MANAGEMENT_CONTROL_NAMESPACE, ControlConfig, {}, {
    setSource: () => {},
    onChange: () => {}
  });
  registerOpenAIResponsesSearch(ctx);
}
