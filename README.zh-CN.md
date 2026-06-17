# chatgpt-native-bridge

[English](README.md) | 简体中文

ChatGPT Native Bridge 是给 Codex 用的本地桌面桥接客户端。

Codex 负责本地改文件、跑测试、提交结果。ChatGPT 负责规划、复核、UX 判断、研究、图片方向和长上下文思考。这个项目负责在两边之间传递上下文和回复。

不需要 OpenAI API key。不调用隐藏接口。不抓 ChatGPT 网页。不提供任意 shell 执行。

![chatgpt-native-bridge 使用预览](docs/assets/marketing/hero.svg)

## 主入口：桌面客户端

在你要处理的项目目录里运行：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

`cgn start`、`cgn desktop`、`cgn client` 都是打开桌面客户端。

普通用户只需要看三个按钮：

- `Pro 深度规划`
- `Thinking 工具复核`
- `写回 Codex`

## Pro 深度规划

适合 GPT-5.5 Pro 不能直接调用 Apps/MCP 的情况。

```text
1. 打开客户端。
2. 点 Pro 深度规划。
3. 客户端复制提示词并打开 ChatGPT。
4. 你把提示词粘贴给 Pro。
5. 复制 Pro 的回复。
6. 客户端自动写回 Codex inbox。
7. 点 写回 Codex，把复制好的句子发给 Codex。
```

剪贴板监听只在你点击后启动，只接受当前任务 id 的回复，并且会自动超时。

## Thinking 工具复核

适合当前 ChatGPT 模式可以通过 Developer Mode MCP 调用工具的情况。

```text
1. 打开客户端。
2. 点 Thinking 工具复核。
3. 客户端启动本地 MCP server 和 tunnel。
4. 在 ChatGPT 里创建或刷新 connector。
5. 让 Thinking 读取项目、复核、写回 Codex。
```

MCP 只暴露有限能力：读取项目状态、安全读取文件和 diff、生成 handoff、把回复写回 Codex inbox。它不提供任意 shell、任意写文件、自动 commit 或 push。

## 备用方式

本地网页 GUI：

```bash
cgn app
```

手动 Markdown 交接：

```bash
cgn handoff --task "复核这个项目"
cgn done
```

终端 MCP 连接：

```bash
cgn mcp connect --yes --open
cgn mcp trace
```

## 安装到 Codex

第一次在项目里安装：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

如果 Codex 提示需要重启，就重启 Codex。

在 Codex 里可以这样触发：

- `/skills` 里选择 `chatgpt-native-bridge`
- 输入 `$chatgpt-native-bridge`
- 直接说：`请使用 chatgpt-native-bridge 处理这个任务`

## 桌面端开发

```bash
npm install
npm run desktop:dev
npm run desktop:pack
```

npm 包仍然保持 CLI 轻量。桌面安装包适合通过 GitHub Release 发布。

## 安全边界

- 不需要 OpenAI API key。
- 不调用隐藏 ChatGPT 接口。
- 不抓取 ChatGPT 网页。
- 不做浏览器插件。
- 不提供任意 shell 执行。
- 不自动 commit 或 push。

## 常用命令

```bash
cgn start
cgn desktop
cgn client
cgn app
cgn setup --mcp
cgn mcp connect --yes --open
cgn mcp trace
cgn handoff
cgn done
cgn doctor
```

## 当前状态

`v0.6.1` 继续保持 Windows 优先桌面客户端主路径，并修复 Windows 剪贴板接力导入中文 Pro 回复时的编码问题。
