# 在 Codex 中使用

这页回答一个最常见的问题：到底是谁运行命令？

答案是：三种模式都可以。

## 推荐触发方式

不要输入 `/chatgpt-native-bridge`。这不是官方 Skill 触发方式。

推荐三种方式：

### 方式 A：`/skills`

在 Codex 中输入 `/skills`，选择 `chatgpt-native-bridge`。

### 方式 B：`$` mention

```text
$chatgpt-native-bridge
```

然后描述你的任务。

### 方式 C：自然语言

```text
请使用 chatgpt-native-bridge 处理这个任务。
```

当前项目不是 Codex Plugin，所以不要把 `@chatgpt-native-bridge` 当成当前入口；以后如果打包成插件，再考虑 `@` 入口。

## 最简单安装方式

把这段复制给 Codex：

```text
请在当前项目安装并初始化这个工具：

https://github.com/rp10000/chatgpt-native-bridge

你可以优先运行：

npx github:rp10000/chatgpt-native-bridge setup --mcp

然后运行：

npx github:rp10000/chatgpt-native-bridge doctor

确认 .agents/skills/chatgpt-native-bridge/SKILL.md 和 .chatgpt-native/project-instructions.md 已生成。

最后告诉我：
1. 是否安装成功
2. 我是否需要重启 Codex
3. 我应该把 .chatgpt-native/project-instructions.md 粘到 ChatGPT Project 的哪里
```

## 用户不需要背命令

```text
用户提示任务
-> Codex 判断是否需要 bridge
-> ChatGPT 通过本地 MCP 读取受限上下文
-> ChatGPT 把建议写回本地 inbox
-> Codex 读取 reply.md 并继续本地执行
```

如果 MCP 不可用，再使用 `cgn handoff -> ChatGPT 网页端 -> cgn done` 的手动备用流程。

## 模式 A：用户自己安装 MCP

适合你不想让 Codex 操作终端的情况。

你自己运行：

```bash
npx github:rp10000/chatgpt-native-bridge setup --mcp
```

然后重启 Codex，或打开一个新的 Codex 线程。ChatGPT 连接好以后，用户只需要在 ChatGPT 里自然语言要求它复核项目并写回 Codex。

## 模式 B：备用手动 handoff

如果 MCP 不能用，你自己运行：

```bash
cgn handoff --task "Review current diff" --type diff-review --include-diff
```

在 ChatGPT 里完成分析后：

```bash
cgn done
```

然后对 Codex 说：

```text
请读取 .chatgpt-native/inbox/latest 对应的 reply.md，
根据 ChatGPT 的建议继续修改。
```

## 模式 C：让 Codex 帮你运行 bridge

这是推荐模式。

你对 Codex 说：

```text
使用 chatgpt-native-bridge 做一次架构复核。
先检查 .chatgpt-native/inbox 是否已有新回复，有就读取 reply.md 和 CODEX_READ_THIS.md。
优先走 MCP 主路径。如果 ChatGPT 还没连接，你来运行或提示我运行 npx github:rp10000/chatgpt-native-bridge mcp connect --yes --open。
如果 MCP 还没安装，你来运行或提示我运行 npx github:rp10000/chatgpt-native-bridge setup --mcp，然后提醒我重启 Codex 或打开新线程。
如果 MCP 不可用，再运行 cgn handoff，告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等 ChatGPT 自动写回，或我运行 cgn done 导入回复后，你读取 reply.md，继续执行。
```

Codex 会负责：

```text
1. 判断任务适合哪些 --type
2. 优先检查 inbox 和 MCP 连接
3. MCP 不可用时运行 cgn handoff
4. 等 ChatGPT 自动写回或你导入回复后读取 reply.md
5. 继续本地修改和测试
```

高级用户也可以拆开执行：

```bash
cgn ask --task "Review current diff" --type diff-review --include-diff
cgn open latest
cgn import latest --from-clipboard
```

## 模式 D：作为项目固定流程

如果你想让项目长期使用这个 bridge，可以把下面内容放进项目 `AGENTS.md`：

```markdown
当任务涉及以下内容时，优先使用 chatgpt-native-bridge：
- 长上下文规划
- 架构改动
- UI/UX 截图复核
- 命名、定位、文案
- 复杂研究
- 图片方向
- Codex diff 二次复核

使用流程：
1. 优先使用 chatgpt-native-bridge MCP server，让 ChatGPT 通过 MCP 读取受限上下文
2. 如果 MCP 不可用，运行 cgn handoff
3. 等 ChatGPT 通过 MCP 写回，或等用户导入 ChatGPT 回复
4. 读取 .chatgpt-native/inbox/{id}/reply.md
5. 只采纳合理建议
6. 本地修改并运行测试
```

## 可直接复制给 Codex 的提示词

```text
这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

先检查 .chatgpt-native/inbox 是否已有新回复，有就读取 reply.md 和 CODEX_READ_THIS.md。
优先走 MCP 主路径。如果 ChatGPT 还没连接，请运行或提示我运行 npx github:rp10000/chatgpt-native-bridge mcp connect --yes --open。
如果 MCP 还没安装，请运行或提示我运行 npx github:rp10000/chatgpt-native-bridge setup --mcp，然后重启 Codex 或打开新线程。
如果 MCP 不可用，再运行 cgn handoff 生成并打开 handoff，告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等 ChatGPT 自动写回，或我运行 cgn done 导入回复后，
你读取 .chatgpt-native/inbox/{id}/reply.md 和 CODEX_READ_THIS.md，
只采纳合理建议，继续本地修改、测试和总结。
```

命令版：

```bash
cgn guide codex --lang zh-CN
```
