# chatgpt-native-bridge

[English](README.md) | 简体中文

ChatGPT Native Bridge 是给 Codex 用的本地桌面桥接客户端。

Codex 负责本地改代码、跑测试、提交结果。ChatGPT 负责复核、规划和把建议写回 Codex。GPT-5.5 Pro 可以辅助规划，但它只能看客户端复制过去的上下文，不能直接读取你的本地项目。

![chatgpt-native-bridge 使用预览](docs/assets/marketing/hero.svg)

## 主路径

在你要处理的项目目录里运行：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

桌面客户端只保留三个主按钮：

```text
连接 ChatGPT -> 开始复核 -> 交给 Codex
```

使用方式：

1. 点 `连接 ChatGPT`。
2. 连接状态变成已连接后，在 ChatGPT 创建或刷新工具。
3. 点 `开始复核`，把复制好的话发给 ChatGPT。
4. 等 ChatGPT 写回。
5. 点 `交给 Codex`，把复制好的话发给 Codex。

## 三条路径

主路径：

```text
ChatGPT Thinking/MCP 读取项目 -> 写回 Codex
```

辅助路径：

```text
Pro 辅助规划 -> 剪贴板接力
```

Pro 不能直接读取本地文件。它只能基于客户端打包给它的上下文做规划。

## 备用方式

```bash
cgn handoff --task "复核这个项目"
cgn done
```

## 第一次设置

在项目里安装 Codex MCP 配置：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

如果 Codex 提示需要重启，就重启 Codex，或者开一个新线程。

## 常用命令

```bash
cgn start
cgn desktop
cgn client
cgn setup --mcp
cgn mcp connect --yes --open
cgn mcp trace
cgn handoff
cgn done
cgn doctor
```

## 安全边界

- 不需要 OpenAI API key。
- 不做浏览器插件。
- 不抓取 ChatGPT 网页。
- 不调用隐藏接口。
- 不提供任意 shell 执行。
- 不自动 commit 或 push。

## 桌面端开发

```bash
npm install
npm run desktop:dev
npm run desktop:pack
```

npm 包保持 CLI 轻量。桌面安装包通过 GitHub Release 发布。

## 当前状态

`v0.7.0` 把 Thinking/MCP 改为真实读取本地项目的主路径，GPT-5.5 Pro 只保留为打包上下文后的辅助规划。
