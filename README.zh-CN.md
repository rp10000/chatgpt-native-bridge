# chatgpt-native-bridge

[English](README.md) | 简体中文

让 Codex 在本地写代码、跑测试、改文件；让 ChatGPT 网页端负责规划、研究、设计批判、文案、图片方向和二次复核。

不需要 OpenAI API key。
不调用隐藏接口。
不抓取 ChatGPT 网页。
不强制 JSON。
你仍然在 ChatGPT 网页里使用原生功能。

![chatgpt-native-bridge 使用效果图](docs/assets/marketing/hero.jpg)

> Public beta：核心 Codex -> ChatGPT -> Codex handoff 流程已经可用，但仍期待真实试用反馈。

![chatgpt-native-bridge 中文流程](docs/assets/flow.zh-CN.svg)

## 最简单用法：把这段复制给 Codex

第一次安装时，不要先背 npm 或 `cgn` 命令。把下面这段直接复制给 Codex：

```text
请在当前项目安装并初始化这个工具：

https://github.com/rp10000/chatgpt-native-bridge

你可以优先运行：

npx github:rp10000/chatgpt-native-bridge init

然后运行：

cgn doctor

确认 .agents/skills/chatgpt-native-bridge/SKILL.md 和 .chatgpt-native/project-instructions.md 已生成。

最后告诉我：
1. 是否安装成功
2. 我是否需要重启 Codex
3. 我应该把 .chatgpt-native/project-instructions.md 粘到 ChatGPT Project 的哪里
```

## 日常怎么触发？

不要输入 `/chatgpt-native-bridge`。这不是官方 Skill 触发方式。

在 Codex 中推荐三种方式：

### 方式 A：`/skills`

输入 `/skills`，选择 `chatgpt-native-bridge`。

### 方式 B：`$` mention

输入：

```text
$chatgpt-native-bridge
```

然后描述你的任务。

### 方式 C：自然语言

```text
请使用 chatgpt-native-bridge 处理这个任务。
```

以后如果这个项目打包成 Codex Plugin，可能会支持 `@chatgpt-native-bridge` 这类插件入口；当前阶段请使用 `/skills`、`$chatgpt-native-bridge` 或自然语言。

## 我需要记哪些命令？

正常情况下，你不需要记住所有命令。

新手只需要记住：

- 第一次：让 Codex 运行 `npx github:rp10000/chatgpt-native-bridge init`
- 日常：在 Codex 里使用 `$chatgpt-native-bridge` 或 `/skills`
- ChatGPT 回复后：运行 `cgn done`，或让 Codex 提醒你运行

其他命令主要是 Codex 或高级用户使用的底层能力。

## 用户不需要背命令

```text
用户说任务
-> Codex 判断是否需要 bridge
-> Codex 运行 cgn handoff
-> 用户在 ChatGPT 网页里粘贴、上传、分析
-> 用户运行 cgn done
-> Codex 读取 reply.md 并继续本地执行
```

## 一句话解释

`chatgpt-native-bridge` 是一个给 Codex 用的本地桥接工具。

它做的事情很简单：

```text
Codex 在本地准备上下文
-> 生成 ask.md / context.md / diff.patch / screenshots
-> 打开 ChatGPT 网页端
-> 你在 ChatGPT 里使用原生功能分析
-> 把 ChatGPT 回复导回本地
-> Codex 继续修改、测试、总结
```

它不是 API wrapper。
它不是浏览器机器人。
它不偷抓 ChatGPT 输出。
它只是把“Codex 本地执行”和“ChatGPT 网页端高阶判断”接起来。

## 它解决什么问题？

Codex 很适合做本地执行：

- 读 repo
- 改代码
- 跑测试
- 看 diff
- 修 bug
- 生成报告

但有些事情更适合交给 ChatGPT 网页端：

- 长上下文规划
- 需求澄清
- 架构批判
- 命名、定位、产品文案
- UI/UX 截图批判
- Web Search / Deep Research
- Canvas 长文档或方案整理
- 图片生成和视觉方向
- 对 Codex 生成的 diff / report 做二次复核

这个工具就是把两者接起来。

## 谁负责什么？

用户负责：

- 提出任务目标
- 在 ChatGPT 网页中粘贴 prompt、上传必要文件
- 把 ChatGPT 回复导回本地

Codex 负责：

- 读 repo、看 diff、整理上下文
- 运行 `cgn ask` 生成 handoff
- 本地修改代码、跑测试、总结结果
- 读取 `reply.md` 后继续执行

ChatGPT 网页端负责：

- 规划
- 架构批判
- UI/UX 复核
- 研究
- 图片方向
- diff/report 二次审查

## 手动模式：你自己运行命令

### 第 1 步：在你的项目里初始化

npm 发布前：

```bash
npx github:rp10000/chatgpt-native-bridge init
```

npm 发布后：

```bash
npx chatgpt-native-bridge init
```

本地开发：

```bash
git clone https://github.com/rp10000/chatgpt-native-bridge.git
cd chatgpt-native-bridge
npm link
cgn init
```

这会生成：

```text
.agents/skills/chatgpt-native-bridge/SKILL.md
.chatgpt-native/project-instructions.md
.chatgpt-native/outbox/
.chatgpt-native/inbox/
```

### 第 2 步：创建 ChatGPT Project

打开 ChatGPT，创建一个 Project，名字可以叫：

```text
Codex Native Advisor
```

然后把这个文件内容粘到 Project instructions：

```text
.chatgpt-native/project-instructions.md
```

### 第 3 步：在 Codex 里这样说

```text
这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

你来运行 cgn handoff 生成并打开 handoff。
告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等我运行 cgn done 导入回复后，
你读取 .chatgpt-native/inbox/{id}/reply.md，
只采纳合理建议，继续本地修改、测试和总结。
```

也可以直接运行：

```bash
cgn guide codex --lang zh-CN
```

把输出复制给 Codex。

### 第 4 步：Codex 会生成 outbox

Codex 会运行类似：

```bash
cgn ask \
  --task "Review the new pricing page" \
  --type ux-review,naming-copy \
  --include-diff
```

生成：

```text
.chatgpt-native/outbox/{id}/
  ask.md
  context.md
  diff.patch
  screenshots/
```

### 第 5 步：打开 ChatGPT

Codex 或你运行：

```bash
cgn open latest
```

它会：

```text
打开 ChatGPT
把 ask.md 复制到剪贴板
告诉你 outbox 文件夹位置
```

### 第 6 步：在 ChatGPT 里操作

在 ChatGPT 里：

```text
1. 粘贴 ask.md
2. 上传 context.md / diff.patch / screenshots
3. 使用 ChatGPT 网页端原生功能分析
4. 复制 ChatGPT 最终回复
```

### 第 7 步：导回本地

```bash
cgn done
```

然后 Codex 读取：

```text
.chatgpt-native/inbox/{id}/reply.md
```

继续本地执行。

## 5 分钟真实例子：pricing 页面

你在 Codex 里说：

```text
帮我实现一个 pricing 页面。
实现前请使用 chatgpt-native-bridge 做规划、文案和 UI/UX 方向。
实现后再用 diff-review 做二次复核。
```

Codex 先运行：

```bash
cgn ask \
  --task "Plan and critique a new pricing page" \
  --type plan,naming-copy,ux-review \
  --include-files "src/**/*pricing*" \
  --include-screenshots "screenshots/*.png"
```

然后运行：

```bash
cgn open latest
```

你在 ChatGPT 里：

```text
1. 粘贴 ask.md
2. 上传 context.md
3. 上传截图或相关文件
4. 让 ChatGPT 给出 Codex next actions
5. 复制最终回复
```

导回本地：

```bash
cgn done
```

再让 Codex：

```text
读取刚才导入的 ChatGPT 回复。
采纳合理的 must-fix 项，忽略不适合本 repo 的建议。
完成实现后运行测试，并再生成一次 diff-review handoff。
```

## 什么时候用？

| 场景 | 推荐类型 |
| --- | --- |
| 复杂需求拆解 | `plan,requirements` |
| 架构改动前复核 | `architecture` |
| 页面设计或文案批判 | `ux-review,naming-copy` |
| 当前信息研究 | `research` |
| 图片方向或视觉提示词 | `image-direction` |
| Codex 做完后的二次复核 | `diff-review` |

## 什么时候不要用？

不要为了这些事情使用 bridge：

- 只改错别字
- 只改格式
- 明确的测试失败修复
- 只更新 lockfile
- 包含你不愿意上传给 ChatGPT 的秘密信息

## 常用命令

```bash
cgn setup
cgn handoff --task "..." --type plan,ux-review --include-diff
cgn done
cgn init
cgn ask --task "..." --type plan,ux-review --include-diff
cgn open latest
cgn import latest --from-clipboard
cgn status
cgn demo
cgn doctor
cgn guide codex --lang zh-CN
```

新手优先记 `cgn setup`、`cgn handoff`、`cgn done`。旧命令继续保留给高级用户和 Codex 自动调用。

## 中文文档

- [快速开始](docs/zh-CN/快速开始.md)
- [在 Codex 中使用](docs/zh-CN/在-Codex-中使用.md)
- [ChatGPT 项目设置](docs/zh-CN/ChatGPT-项目设置.md)
- [使用场景](docs/zh-CN/使用场景.md)
- [常见问题](docs/zh-CN/常见问题.md)
- [故障排查](docs/zh-CN/故障排查.md)

## 当前边界

- GitHub 仓库已公开。
- npm registry 可能还没有发布，发布前请用 `npx github:rp10000/chatgpt-native-bridge init` 或 `npm link`。
- 不提供浏览器 RPA。
- 不抓 ChatGPT 网页输出。
- 不接隐藏接口。
- 不替你判断哪些敏感文件可以上传；上传前仍要自己确认。
