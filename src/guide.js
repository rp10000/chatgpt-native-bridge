function codexGuideText(lang = "en") {
  if (lang === "zh-CN") return chineseCodexGuide();
  return englishCodexGuide();
}

function englishCodexGuide() {
  return `Copy this into Codex:

Use chatgpt-native-bridge for this task.

If the task needs planning, architecture critique, UX review, naming/copy,
research, image direction, or diff review:

1. First check whether .chatgpt-native/inbox has a new reply. If yes, read reply.md and CODEX_READ_THIS.md and continue locally.
2. Prefer the desktop main path. Run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start.
3. In the client, use 连接 ChatGPT -> 开始复核 -> 交给 Codex.
4. Treat ChatGPT Thinking/MCP as the path that can read the local project and write back to Codex.
5. Treat GPT-5.5 Pro only as packaged-context planning. Pro cannot directly read local files through this bridge.
6. If MCP is missing in Codex, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp, then restart Codex or open a new thread.
7. If ChatGPT web MCP is not connected, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open.
8. If ChatGPT is selected but no reply appears, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp wait to confirm whether ChatGPT actually called MCP.
9. If desktop and MCP are unavailable, run cgn handoff with the right --type values and tell me what to paste or upload into ChatGPT.
10. After the client imports a Pro reply, ChatGPT writes back through MCP, or I run cgn done, read .chatgpt-native/inbox/{id}/reply.md and CODEX_READ_THIS.md.
11. Apply only useful recommendations locally.
12. Run tests.
`;
}

function chineseCodexGuide() {
  return `复制下面这段给 Codex：

请使用 chatgpt-native-bridge 处理这个任务。

如果任务需要规划、架构复核、UX 复核、命名文案、研究、图片方向或 diff review：

1. 先检查 .chatgpt-native/inbox 是否有新回复。如果有，读取 reply.md 和 CODEX_READ_THIS.md，然后继续本地执行。
2. 优先使用桌面客户端主路径。运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start。
3. 在客户端里按：连接 ChatGPT -> 开始复核 -> 交给 Codex。
4. ChatGPT Thinking/MCP 才是真正读取本地项目并写回 Codex 的路径。
5. GPT-5.5 Pro 只作为打包上下文后的辅助规划，不能直接读取本地文件。
6. 如果 Codex 没有安装 MCP，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp，然后重启 Codex 或打开新线程。
7. 如果 ChatGPT 网页端 MCP 没连上，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open。
8. 如果 ChatGPT 已选中 app 但没有回复写回，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp wait，确认 ChatGPT 是否真的调用了 MCP。
9. 如果桌面客户端和 MCP 都不可用，再运行 cgn handoff，并告诉我需要在 ChatGPT 粘贴或上传什么。
10. 等客户端导入 Pro 回复、ChatGPT 通过 MCP 写回，或我运行 cgn done 后，读取 .chatgpt-native/inbox/{id}/reply.md 和 CODEX_READ_THIS.md。
11. 只采纳合理建议，继续本地修改。
12. 运行测试。
`;
}

module.exports = {
  codexGuideText
};
