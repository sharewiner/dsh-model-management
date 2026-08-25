# DSH Model Management

A DSH Web profile plugin for managing independent OpenAI-compatible model providers and optional OpenAI Responses web search.

## Requirements

- DSH Web profile with the `settings`, `credentials`, `agentDefaultModel`, `llm`, and `web` services.
- Node.js 22.19 or newer.
- Compatible host packages matching the peer dependency versions in `package.json`.

## Local installation

Install this directory as its own package. It is not included by the parent `dsh-provider-manager` package.

```bash
cd ~/.dsh/profiles/desktop
pnpm add "file:/absolute/path/to/dsh-model-management"
```

Install it in whichever profile DSH Desktop starts (`desktop` by default), and ensure `@dsh-local/model-management` is listed in that profile's `dsh.profile.bundles`. The package bundle patch inserts the `model-management` host entry. Restart DSH Desktop after changing the package or profile.

## Usage

Open DSH Settings and select **模型管理**:

1. Add an OpenAI-compatible provider with a base URL such as `https://api.example.com/v1`.
2. Add at least one model and save the provider API key.
3. Select a model to make it the default model.
4. Closing a provider or hiding a model synchronizes the DSH composer and `/model` selection lists. A currently selected model remains visible until another model is selected.
5. Select an `openai-responses` model as the default; web search uses that provider's base URL, credential reference, and model automatically.

The provider endpoint must support the selected protocol:

- `openai-responses`: `POST {baseURL}/responses`
- `openai-completions`: OpenAI-compatible chat-completions through `pi-ai`
- model discovery: `GET {baseURL}/models`

## Verification

```bash
cd ~/.dsh/profiles/desktop
pnpm exec node --input-type=module -e "import('@dsh-local/model-management').then(() => console.log('host entry loaded'))"
node --check node_modules/@dsh-local/model-management/lib/client.js
pnpm pack --pack-destination /tmp .
```

Then restart the DSH Web profile and confirm the **模型管理** settings section appears. Configure a non-production test provider before making a streaming request or enabling web search.
