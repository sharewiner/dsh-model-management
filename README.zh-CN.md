# DSH 模型管理

[English README](README.md)

这是一个用于 DSH Web Profile 的模型管理插件，支持管理 OpenAI 兼容 Provider、选择默认模型、控制模型可见性，并可让联网搜索自动使用当前默认的 OpenAI Responses Provider。

## 功能

- 在设置页面增加“模型管理”分区。
- 按 Provider 分组展示 DSH 当前已注册的全部模型。
- 设置默认 Provider、模型以及支持的推理强度。
- 隐藏单个模型，使其不再显示在输入框模型选择器和 `/model` 命令中。
- 关闭整个 Provider，使该 Provider 的所有模型不再显示在输入框模型选择器和 `/model` 命令中。
- 当前会话正在使用的模型会暂时保留显示；切换到其他模型后才会遵守隐藏规则，避免会话失去当前路由。
- 注册 `model-management-openai-responses` 联网搜索 Provider，根据当前默认 OpenAI Responses 模型、服务地址和凭据引用执行搜索。

## Beta 状态与兼容性

项目仍处于早期使用阶段，但 npm `0.2.1` 按 DSH 托管市场要求使用稳定 SemVer。该版本已基于 DeepSeek Harness `0.1.1-rc.2` 的包 API 与 2026-08-25 当天的 DSH Desktop Web Profile 完成验证。

由于 DSH 暂未暴露公开的模型目录过滤 API，模型可见性同步会通过独立兼容层访问客户端 `modelDirectories` 服务。兼容层会在安装前探测目录契约、缓存可见性设置、在插件停止或更新时恢复所有被包装的方法；如契约不兼容，则保持原生模型选择器不变并输出一次诊断告警。每次升级 DeepSeek Harness 后，请重新验证输入框模型选择器和 `/model` 命令；兼容性问题请在本仓库 Issue 中反馈。

## 运行要求

- DSH Web Profile，且包含 `settings`、`credentials`、`agentDefaultModel`、`llm` 和 `web` 服务。
- Node.js 22.19 或更高版本。
- 与 `package.json` 中 peer dependencies 兼容的 DSH Host 包版本。
- 已配置可用的 OpenAI 兼容模型服务。

## 安装

可通过 DSH 插件市场安装已发布版本，或将精确 npm 版本添加到 DSH Desktop 实际启动的 Profile：

```bash
dsh plugin --profile web add @sharewiner/dsh-model-management@0.2.1
```

本地开发时，可在目标 Profile 中执行 `pnpm add "file:/绝对路径/dsh-model-management"` 安装当前源码。确认该 Profile 的 `dsh.profile.bundles` 包含 `@sharewiner/dsh-model-management`。插件的 bundle patch 会插入 `model-management` Host 条目。安装或更新后必须完全重启 DSH Desktop。

## 使用方法

打开 DSH 设置，选择 **模型管理**。

1. 先在 DSH 原生的 **模型** 设置页配置 OpenAI 兼容 Provider、模型和 API 凭据。
2. 在 **模型管理** 中选择默认模型。
3. 点击模型的 **隐藏**，该模型会从输入框模型选择器与 `/model` 列表中移除。
4. 点击 Provider 的 **关闭提供方**，该 Provider 下所有模型会从两个模型列表中移除。
5. 点击 **显示** 或 **开启提供方** 可以恢复对应模型或 Provider。

Provider 标题栏支持展开与收起：点击标题、空白区域或箭头均可切换；“开启提供方”或“关闭提供方”按钮只切换 Provider 状态，不会误触发展开或收起。

## 联网搜索

当当前默认模型属于已配置的 `openai-responses` Provider 时，插件会注册 `model-management-openai-responses`。将 DSH 的 web 服务配置为使用它后，联网搜索会自动跟随当前默认模型的 Provider、模型、服务地址与凭据引用。

对应服务端需要支持：

- `openai-responses`：`POST {baseURL}/responses`
- `openai-completions`：由 `pi-ai` 转换的 OpenAI 兼容 Chat Completions 请求
- 模型发现：`GET {baseURL}/models`

## 验证

```bash
cd ~/.dsh/profiles/desktop
pnpm exec node --input-type=module -e "import('@sharewiner/dsh-model-management').then(() => console.log('host entry loaded'))"
node --check node_modules/@sharewiner/dsh-model-management/lib/client.js

cd /绝对路径/dsh-model-management
node --check lib/index.js
node --check lib/client.js
pnpm pack --pack-destination /tmp .
```

重启 DSH Web Profile 后，确认设置中出现 **模型管理** 分区。关闭 Provider 或隐藏模型后，分别检查输入框中的模型选择器和 `/model` 命令是否同步更新。

## 安全说明

插件只有在执行 OpenAI Responses 联网搜索时，才会通过 DSH 的凭据服务或启动环境读取 Provider 凭据。插件源码及模型管理设置不会保存 API Key、Token 或端点密钥。

不要将本机 DSH settings、凭据文件或完整 Profile 目录提交到这个仓库。
