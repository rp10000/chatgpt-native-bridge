# 在 Codex 中使用

这页回答一个最常见的问题：到底是谁运行命令？

答案是：三种模式都可以。

## 模式 A：用户自己运行 `cgn`

适合你不想让 Codex 操作终端的情况。

你自己运行：

```bash
cgn ask --task "Review current diff" --type diff-review --include-diff
cgn open latest
```

在 ChatGPT 里完成分析后：

```bash
cgn import latest --from-clipboard
```

然后对 Codex 说：

```text
请读取 .chatgpt-native/inbox/latest 对应的 reply.md，
根据 ChatGPT 的建议继续修改。
```

## 模式 B：让 Codex 帮你运行 bridge

这是推荐模式。

你对 Codex 说：

```text
使用 chatgpt-native-bridge 做一次架构复核。
你来运行 cgn ask 和 cgn open。
告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等我运行 cgn import latest --from-clipboard 导入回复后，
你读取 reply.md，继续执行。
```

Codex 会负责：

```text
1. 判断任务适合哪些 --type
2. 运行 cgn ask
3. 运行 cgn open latest
4. 告诉你 outbox 文件夹里哪些文件要上传
5. 等你导入回复后读取 reply.md
6. 继续本地修改和测试
```

## 模式 C：作为项目固定流程

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
1. 运行 cgn ask
2. 运行 cgn open latest
3. 等用户导入 ChatGPT 回复
4. 读取 .chatgpt-native/inbox/<id>/reply.md
5. 只采纳合理建议
6. 本地修改并运行测试
```

## 可直接复制给 Codex 的提示词

```text
这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

你来运行 cgn ask 生成 handoff。
然后运行 cgn open latest。
告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等我运行 cgn import latest --from-clipboard 导入回复后，
你读取 .chatgpt-native/inbox/<id>/reply.md，
只采纳合理建议，继续本地修改、测试和总结。
```

命令版：

```bash
cgn guide codex --lang zh-CN
```
