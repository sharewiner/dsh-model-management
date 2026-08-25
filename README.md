# DSH Model Management

[中文文档](README.zh-CN.md)

A DSH Web profile plugin for managing OpenAI-compatible model providers, choosing a default model, controlling model visibility, and optionally routing web search through the selected OpenAI Responses provider.

## Features

- Adds a `模型管理` settings section.
- Lists every model currently registered with DSH, grouped by provider.
- Sets the default provider, model, and supported reasoning effort.
- Hides individual models from the composer model picker and `/model` command.
- Closes an entire provider in the composer model picker and `/model` command.
- Keeps the currently selected model visible until another model is selected, preventing an active session from losing its current route.
- Registers `model-management-openai-responses`, a web-search provider that uses the active default OpenAI Responses model, base URL, and credential reference.

## Beta Status and Compatibility

This is a beta release. It was tested with DeepSeek Harness `0.1.1-rc.2` package APIs and DSH Desktop Web profiles current on 2026-08-25.

Model visibility synchronization wraps DSH's client-side `modelDirectories` service because DSH does not currently expose a public model-directory filtering API. Verify the composer model picker and `/model` command after every DeepSeek Harness upgrade. Report compatibility issues in this repository's issue tracker.

## Requirements

- A DSH Web profile with the `settings`, `credentials`, `agentDefaultModel`, `llm`, and `web` services.
- Node.js 22.19 or newer.
- Compatible host packages matching the peer dependency versions in `package.json`.
- An OpenAI-compatible endpoint for any configured provider.

## Install

Install this directory as its own package in the DSH profile that Desktop starts:

```bash
cd ~/.dsh/profiles/desktop
pnpm add "file:/absolute/path/to/dsh-model-management"
```

Ensure `@dsh-local/model-management` appears in that profile's `dsh.profile.bundles`. The package bundle patch inserts the `model-management` Host entry. Restart DSH Desktop after installing or updating the package.

## Use

Open DSH Settings and select **模型管理**.

1. Add an OpenAI-compatible provider and its models in DSH's native **模型** settings page.
2. Choose a default model from **模型管理**.
3. Use **隐藏** to remove one model from the composer model picker and `/model` list.
4. Use **关闭提供方** to remove all models from a provider in those model lists.
5. Use **显示** or **开启提供方** to restore them.

Provider headers are expandable. Clicking the header, its empty area, or the chevron expands or collapses the provider; the enable or disable button only changes the provider state.

## Web Search

When the selected default model belongs to a configured `openai-responses` provider, the plugin registers `model-management-openai-responses`. Configure DSH's web service to use that provider if you want web searches to follow the current default model automatically.

The selected endpoint must support:

- `openai-responses`: `POST {baseURL}/responses`
- `openai-completions`: OpenAI-compatible chat completions through `pi-ai`
- Model discovery: `GET {baseURL}/models`

## Verification

```bash
cd ~/.dsh/profiles/desktop
pnpm exec node --input-type=module -e "import('@dsh-local/model-management').then(() => console.log('host entry loaded'))"
node --check node_modules/@dsh-local/model-management/lib/client.js

cd /absolute/path/to/dsh-model-management
node --check lib/index.js
node --check lib/client.js
pnpm pack --pack-destination /tmp .
```

Restart the DSH Web profile and confirm the **模型管理** settings section appears. Test provider visibility changes in both the composer model picker and the `/model` command.

## Security

This plugin reads provider credentials through DSH's credential service or launch environment only when it performs an OpenAI Responses web-search request. It does not store API keys, tokens, or endpoint secrets in the plugin source or model-management settings.

Do not commit local DSH settings, credential files, or profile directories to this repository.
