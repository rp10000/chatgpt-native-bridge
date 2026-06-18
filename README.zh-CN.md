# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

[English](README.md) | 简体中文

**ChatGPT Native Bridge 是一个连接 ChatGPT、Codex 和本地项目的桌面桥接工具。**

它给 ChatGPT 一个可见的 MCP 工作区，让 ChatGPT 可以读取项目、运行命令、修改已连接项目、在 ChatGPT 网页端显示结果卡片，并把最终结果写回给 Codex 继续本地执行。

![ChatGPT Native Bridge 工作流](docs/assets/readme/hero-workflow.svg)

## 快速开始

在你要处理的项目目录里运行：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

然后在桌面客户端里按这个流程走：

```text
选择项目 -> 连接 ChatGPT -> 开始处理 -> 查看结果 -> 交给 Codex
```

新手主要用桌面客户端。CLI 仍然保留，用于安装、诊断、自动化和高级操作。

## 客户端会显示什么

它不是只负责打开 ChatGPT。它会告诉你 ChatGPT 有没有真的连上、调用了什么工具、跑了什么命令、改了什么文件、有没有写回 Codex。

![桌面端实时状态](docs/assets/readme/desktop-status.svg)

状态来自本地真实记录：

- MCP 请求日志
- MCP 工具调用审计日志
- 命令历史
- git status / diff
- Codex inbox 回复

## ChatGPT 网页端卡片

如果你的 ChatGPT 模式支持 MCP Apps UI，工具调用结果会在 ChatGPT 对话里显示成卡片。

![ChatGPT 网页端卡片](docs/assets/readme/chatgpt-cards.svg)

卡片会出现在这些关键动作上：

- 打开项目
- 运行命令
- 写入或编辑文件
- 查看变更
- 写回 Codex

如果当前账号或模式不支持卡片，工具仍然会返回普通结构化结果，不影响主流程。

## MCP 工作区

项目连接后，ChatGPT 可以使用这些 MCP 工作区工具：

```text
list_workspaces
open_workspace
list_directory
search_workspace
read_project_instructions
read
write
edit
bash
command_history
show_changes
write_to_codex
```

当前项目可以直接打开。其他项目需要先加入允许列表：

```bash
cgn projects add D:\path\to\project
```

## 安全边界

![安全边界](docs/assets/readme/safety-boundary.svg)

这个项目的边界很明确：

- 不需要 OpenAI API key。
- 不做浏览器插件。
- 不抓取 ChatGPT 网页。
- 不调用隐藏接口。
- 不会自动 commit 或 push。
- 命令输出和文件变更会显示在桌面客户端。
- Codex 仍然负责最后本地复核、测试、提交和 push。

临时 MCP tunnel URL 要当作本地能力链接看待，不要公开泄露。

## 常用命令

```bash
cgn start
cgn setup --mcp
cgn projects add .
cgn projects list
cgn auth rotate
cgn sessions list
cgn mcp connect --yes --open
cgn mcp trace
cgn mcp doctor
cgn doctor
```

## Pro 辅助规划

ChatGPT Pro 不能在任意对话里直接读取你的本地项目。只有当前 ChatGPT 会话能调用 MCP app 时，才可以走本地工具。

客户端里的 Pro 辅助功能只是打包上下文：

```text
客户端复制项目摘要 -> 你粘贴给 Pro -> 客户端导入带标记的回复
```

真正读取本地文件、运行命令、写回 Codex 的主路径是 Thinking / MCP。

## 备用方式

如果 MCP 暂时不可用：

```bash
cgn handoff --task "复核这个项目"
cgn done
```

它会生成可见的 Markdown handoff，再把 ChatGPT 回复导入 `.chatgpt-native/inbox`。

## 开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm test
npm run desktop:dev
npm run desktop:pack
```

npm 包保持 CLI 轻量。桌面安装包通过 GitHub Release 发布。

## 当前状态

`v1.0.0` 包含：

- 桌面客户端
- MCP 工作区工具
- shell 和文件变更可视化审计
- ChatGPT 网页端卡片
- Codex inbox 写回
- Markdown handoff 备用路径
