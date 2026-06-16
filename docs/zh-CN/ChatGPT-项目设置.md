# ChatGPT 项目设置

## 1. 创建 Project

打开 ChatGPT，创建一个 Project：

```text
Codex Native Advisor
```

## 2. 粘贴 Project instructions

在本地项目里运行：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge cgn setup --mcp
```

然后打开：

```text
.chatgpt-native/project-instructions.md
```

把文件内容复制到 ChatGPT Project instructions。

## 3. 优先连接 MCP

这个命令会安装 Codex MCP 配置。然后重启 Codex，或打开一个新的 Codex 线程。

如果项目已经初始化，但 Codex 里还没有 MCP，运行：

```bash
cgn mcp install
```

ChatGPT 网页连接：

```bash
cgn mcp connect --yes --open
```

按命令打印的字段创建 ChatGPT connector。创建好以后，不要让用户记工具名。直接在 ChatGPT 里说：

```text
请使用 chatgpt-native-bridge 复核这个项目。
自动检查当前项目状态和 diff，需要上下文就读取相关文件，
最后把你的建议写回本地 Codex。
```

MCP 可用时，ChatGPT 应该自动读取受限上下文、diff、相关文件，并在结束前写回本地 Codex。

手动 HTTP server 备用路径：

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

## 4. 备用 handoff：需要上传什么？

MCP 不可用时，`cgn handoff` 会生成：

```text
.chatgpt-native/outbox/{id}/
  ask.md
  01_PASTE_TO_CHATGPT.md
  02_UPLOAD_THESE_FILES.md
  03_AFTER_CHATGPT_REPLY.md
  context.md
  diff.patch
  test-output.md
  files/
  screenshots/
```

通常这样做：

```text
1. 粘贴 01_PASTE_TO_CHATGPT.md
2. 按 02_UPLOAD_THESE_FILES.md 上传 context.md
3. 如果是代码复核，上传 diff.patch
4. 如果是 UI/UX，上传 screenshots/
5. 如果是文件分析，上传 files/ 里相关文件
```

## 5. ChatGPT 回复格式

建议让 ChatGPT 最后输出：

```markdown
## Codex next actions
- Must fix:
- Nice to have:
- Tests to run:
- Risks:
```

这样 Codex 更容易继续本地执行。
