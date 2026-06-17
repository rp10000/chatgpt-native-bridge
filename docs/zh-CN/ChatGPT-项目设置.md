# ChatGPT 项目设置

这个项目不强制使用 ChatGPT Project，但 Project 可以保存固定说明。

## 1. 创建 Project

在 ChatGPT 里创建一个 Project，例如：

```text
Codex Native Advisor
```

## 2. 粘贴说明

把当前项目里的这个文件内容粘到 Project instructions：

```text
.chatgpt-native/project-instructions.md
```

## 3. 使用方式

在 ChatGPT 里可以说：

```text
请使用 chatgpt-native-bridge 复核这个项目，并把最终建议写回 Codex。
```

如果当前模型不能调用 MCP，就用桌面客户端的 `Pro 深度规划`。

## 4. MCP connector

如果要让 Thinking 通过 MCP 读取项目：

```bash
cgn mcp connect --yes --open
```

然后在 ChatGPT 的 Apps & Connectors 里创建或刷新 connector，使用命令打印出来的 `https://.../mcp` Server URL。
