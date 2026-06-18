# 在 Codex 中使用

## 第一次安装

把这段给 Codex：

```text
请在当前项目安装并初始化 chatgpt-native-bridge：

https://github.com/rp10000/chatgpt-native-bridge

运行：
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp

然后运行：
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn doctor

告诉我是否安装成功，以及是否需要重启 Codex。
```

## 日常触发

推荐：

```text
$chatgpt-native-bridge
```

或者：

```text
请使用 chatgpt-native-bridge 处理这个任务。
```

## Codex 应该怎么做

Codex 应先检查：

```text
.chatgpt-native/inbox/{id}/CODEX_READ_THIS.md
.chatgpt-native/inbox/{id}/reply.md
```

如果已经有回复，就直接读取并继续本地实现。

如果需要 ChatGPT 复核，优先走桌面客户端主路径：

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start
```

客户端里的主流程是：

```text
连接 ChatGPT -> 开始处理 -> 交给 Codex
```

如果只需要 GPT-5.5 Pro 辅助规划，使用客户端里的 `Pro 辅助规划`。注意：Pro 只能看客户端打包的上下文，不能直接读取本地项目。

如果桌面客户端和 MCP 都不可用，再走手动备用：

```bash
cgn handoff --task "复核当前项目"
cgn done
```

## 给 Codex 的一句话

```text
读取最新 Bridge 回复，检查变更摘要，然后继续执行、测试和总结。
```
