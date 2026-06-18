# chatgpt-native-bridge

[![CI](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/rp10000/chatgpt-native-bridge/actions/workflows/ci.yml)

[English](README.md) | 简体中文

**连接一次 MCP，然后直接在 ChatGPT 网页端操作当前本地项目。**

ChatGPT Native Bridge 会给 ChatGPT 一个可见的 MCP 工作区。ChatGPT 可以读取当前项目、修改文件、运行命令、显示网页端卡片，并生成交接报告给 Codex 最后复核。

![ChatGPT Native Bridge 工作流](docs/assets/readme/hero-workflow.svg)

## 快速开始

在你要处理的项目目录里运行：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

桌面客户端主流程：

```text
选择项目 -> 连接 ChatGPT -> 在 ChatGPT 网页端处理 -> 生成交接报告
```

桌面客户端只负责入口、连接状态和安全记录。真正的工作界面是 ChatGPT 网页端。

## 主流程

1. 在客户端选择本地项目。
2. 点击 `连接 ChatGPT`。
3. 在 ChatGPT 里刷新或选择 `chatgpt-native-bridge` 工具。
4. 让 ChatGPT 读取、修改、运行检查。
5. 让 ChatGPT 生成交接报告。
6. Codex 最后复核 diff、运行测试、提交和 push。

给 ChatGPT 的提示可以这样写：

```text
请使用 chatgpt-native-bridge 打开当前连接项目。你可以直接读取、修改文件并运行必要检查。完成后请生成交接报告，说明改了什么、跑了什么、还需要 Codex 复核什么。
```

## 桌面客户端

客户端显示一个项目和一个大状态灯：

![桌面端状态](docs/assets/readme/desktop-status.svg)

状态含义：

- 灰色：未连接。
- 蓝色：已连接。
- 黄色：ChatGPT 已访问工具列表。
- 绿色：ChatGPT 正在操作当前项目。
- 紫色：已生成交接报告。
- 红色：连接失效或项目不匹配。

主按钮只有：

```text
选择项目
连接 ChatGPT
生成交接报告
```

工具调用、命令输出、文件变更、诊断和备用方式都放在折叠区里。

## ChatGPT 网页端卡片

如果你的 ChatGPT 模式支持 MCP Apps UI，工具调用结果会在 ChatGPT 对话里显示成卡片。

![ChatGPT 网页端卡片](docs/assets/readme/chatgpt-cards.svg)

卡片会显示：

- 当前项目
- 命令结果
- 文件变更
- 交接报告

如果当前账号或模式不显示卡片，工具仍然会返回普通结构化结果，主流程不受影响。

## MCP 工作区

项目连接后，ChatGPT 可以使用 MCP 工作区工具：

```text
open_workspace
list_directory
search_workspace
read_project_instructions
read
write
edit
bash
show_changes
create_handoff_report
```

当前连接是项目级的。ChatGPT 默认不能浏览你的整台电脑。

`open_workspace` 只打开当前客户端选中的项目。如果 ChatGPT 请求其它路径，bridge 会拒绝，并提示先在客户端切换项目后重新连接。

## 模式

默认模式保持实用：

```text
tool-mode: standard
shell-mode: trusted
```

如果你想让 ChatGPT 看到更少的工具：

```bash
cgn config set tool-mode simple
```

如果你想限制 shell：

```bash
cgn config set shell-mode safe
```

`safe` 只允许常见测试、构建、lint 和 git 查看命令。需要完整项目 shell 权限时用 `trusted`，不想暴露 shell 时用 `off`。

## 交接报告

`create_handoff_report` 会生成：

```text
.chatgpt-native/reports/{id}/HANDOFF_REPORT.md
.chatgpt-native/inbox/{id}/reply.md
.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md
```

报告包含：

- git status
- diff 摘要
- 最近 MCP 工具调用
- 最近 shell 命令
- 修改过的文件
- ChatGPT 说明
- Codex 复核清单

`write_to_codex` 继续保留为兼容别名，但推荐使用 `create_handoff_report`。

## 安全边界

![安全边界](docs/assets/readme/safety-boundary.svg)

边界很明确：

- 不需要 OpenAI API key。
- 不做浏览器插件。
- 不抓取 ChatGPT 网页。
- 不调用隐藏接口。
- 默认不开放全局文件系统。
- 不自动 commit 或 push。
- 命令输出和文件变更会显示在桌面客户端。
- Codex 负责最后本地复核、测试、提交和 push。

临时 MCP tunnel URL 要当作本地能力链接看待，不要公开泄露。

## 常用命令

```bash
cgn start
cgn desktop
cgn config show
cgn config set shell-mode safe
cgn config set tool-mode simple
cgn projects add .
cgn projects list
cgn mcp connect --yes --open
cgn mcp trace
cgn mcp doctor
cgn doctor
```

普通用户用桌面客户端。CLI 用于安装、诊断、自动化和高级流程。

## Pro 辅助规划

当当前 ChatGPT 对话不能调用 MCP 工具时，Pro 辅助规划只是备用方式。

Pro 只能看到客户端打包的上下文：

```text
客户端复制项目上下文 -> 你粘贴给 Pro -> 客户端导入带标记的 Pro 回复
```

真正读取本地文件、修改文件和运行命令，要走 MCP 工作区。

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

`v1.2` 重点是：

- Web-first MCP 工作流
- 只允许当前项目的工作区访问
- 极简桌面连接器
- ChatGPT 网页端卡片
- 本地命令和文件变更可见
- 可配置 shell 和工具模式
- 给 Codex 复核的交接报告
- Pro 和 Markdown 备用方式
