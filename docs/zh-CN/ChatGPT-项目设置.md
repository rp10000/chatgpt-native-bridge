# ChatGPT 项目设置

## 1. 创建 Project

打开 ChatGPT，创建一个 Project：

```text
Codex Native Advisor
```

## 2. 粘贴 Project instructions

在本地项目里运行：

```bash
cgn init
```

然后打开：

```text
.chatgpt-native/project-instructions.md
```

把文件内容复制到 ChatGPT Project instructions。

## 3. 每次 handoff 时上传什么？

`cgn ask` 会生成：

```text
.chatgpt-native/outbox/<id>/
  ask.md
  context.md
  diff.patch
  test-output.md
  files/
  screenshots/
```

通常这样做：

```text
1. 粘贴 ask.md
2. 上传 context.md
3. 如果是代码复核，上传 diff.patch
4. 如果是 UI/UX，上传 screenshots/
5. 如果是文件分析，上传 files/ 里相关文件
```

## 4. ChatGPT 回复格式

建议让 ChatGPT 最后输出：

```markdown
## Codex next actions
- Must fix:
- Nice to have:
- Tests to run:
- Risks:
```

这样 Codex 更容易继续本地执行。
