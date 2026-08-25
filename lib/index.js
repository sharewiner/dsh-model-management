import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';
import { WebError } from '@deepseek-ai/dsh-web';
import { createOpenAIResponsesSearchProvider, resolveApiKey, selectedOpenAIProfile } from './openai-responses-search.js';

export const name = 'model-management';
export const inject = ['agentDefaultModel', 'settings', 'web'];

export const MODEL_MANAGEMENT_CONTROL_NAMESPACE = settingsNamespace('model-management-control');

const ControlConfig = z.object({
  hidden: z.array(z.string()).default([]),
  disabledProviders: z.array(z.string()).default([])
});

const PI_AI_NAMESPACE = settingsNamespace('llm-pi-ai');

function registerOpenAIResponsesSearch(ctx) {
  ctx.web.registerSearchProvider(createOpenAIResponsesSearchProvider({
    getProfile: () => selectedOpenAIProfile(
      ctx.agentDefaultModel.currentSelection(),
      ctx.settings.get(PI_AI_NAMESPACE)?.providers,
    ),
    resolveApiKey: (apiKeyEnv) => resolveApiKey({
      apiKeyEnv,
      credentials: ctx.get('credentials'),
      credentialReference: credentialRef,
      getAmbient: (name) => launchEnvironmentOf(ctx).get(name),
      createError: (message, code, options) => new WebError(message, code, options),
    }),
    fetchImpl: fetch,
    createError: (message, code, options) => new WebError(message, code, options),
  }));
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
