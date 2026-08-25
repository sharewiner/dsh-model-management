# DSH Marketplace Submission

## Package identity

- Package: `@sharewiner/dsh-model-management`
- Exact version: `0.2.0`
- Repository: `https://github.com/sharewiner/dsh-model-management`
- License: MIT
- Category: Models
- Runtime: DSH Desktop Web Profile

## English listing

**Name:** DSH Model Management

**Summary:** Manage the default DSH model, synchronize provider and model visibility with the composer and `/model`, and route optional OpenAI Responses web search through the active default provider.

**Early-access notice:** Model picker synchronization uses a guarded compatibility layer around DSH `0.1.1-rc.2` client model directories. The layer validates the runtime contract and leaves native selection unchanged when incompatible.

## 中文条目

**名称：** DSH 模型管理

**简介：** 管理 DSH 默认模型，将 Provider 和单模型可见性同步到输入框与 `/model`，并可让 OpenAI Responses 联网搜索跟随当前默认 Provider。

**早期使用说明：** 模型选择器同步通过受保护的兼容层访问 DSH `0.1.1-rc.2` 客户端模型目录。兼容层会验证运行时契约；如不兼容，则保持原生模型选择器不变。

## Verification evidence

- No install lifecycle scripts.
- Public npm package with a stable exact SemVer.
- npm repository metadata matches the canonical GitHub repository.
- Tarball contains `cordis.patch.yml` at the path declared by `dsh.bundle.patch`.
- Automated tests cover visibility filtering, compatibility lifecycle, credentials, OpenAI Responses requests, citations, errors, and release identity.
- Clean DSH Web Profile smoke test covers tarball installation, composed bundle identity, Host entry import, and compatibility subpath import.
