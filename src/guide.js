function codexGuideText(lang = "en") {
  if (lang === "zh-CN") return chineseCodexGuide();
  return englishCodexGuide();
}

function englishCodexGuide() {
  return `Copy this into Codex:

Use chatgpt-native-bridge for this task.

If the task needs planning, architecture critique, UX review, naming/copy,
research, image direction, or diff review:

1. First check whether .chatgpt-native/reports has a new HANDOFF_REPORT.md. If yes, read it and review the actual diff.
2. Prefer the desktop main path. Run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start.
3. In the client, use 选择项目 -> 连接 ChatGPT -> 生成交接报告.
4. Treat ChatGPT web MCP as the path that can read, edit, write, run commands, show changes, and create the Codex review report.
5. Treat GPT-5.5 Pro only as packaged-context planning. Pro cannot directly read local files through this bridge.
6. If MCP is missing in Codex, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp, then restart Codex or open a new thread.
7. If ChatGPT web MCP is not connected, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open.
8. If ChatGPT is selected but no tool activity appears, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp wait to confirm whether ChatGPT actually called MCP.
9. If desktop and MCP are unavailable, run cgn handoff with the right --type values, tell me what to paste or upload into ChatGPT, then use cgn done to import the reply.
10. After ChatGPT creates a handoff report, read .chatgpt-native/reports/{id}/HANDOFF_REPORT.md and .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md.
11. Review the actual diff and run tests.
12. Commit or push only after verification.
`;
}

function chineseCodexGuide() {
  return `复制下面这段给 Codex：

请使用 chatgpt-native-bridge 处理这个任务。

如果任务需要规划、架构复核、UX 复核、命名文案、研究、图片方向或 diff review：

1. 先检查 .chatgpt-native/reports 是否有新的 HANDOFF_REPORT.md。如果有，读取报告并复核真实 diff。
2. 优先使用桌面客户端主路径。运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start。
3. 在客户端里按：选择项目 -> 连接 ChatGPT -> 生成交接报告。
4. ChatGPT 网页端 MCP 才是真正读取、修改、运行命令、查看变更并生成交接报告的路径。
5. GPT-5.5 Pro 只作为打包上下文后的辅助规划，不能直接读取本地文件。
6. 如果 Codex 没有安装 MCP，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp，然后重启 Codex 或打开新线程。
7. 如果 ChatGPT 网页端 MCP 没连上，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open。
8. 如果 ChatGPT 已选中 app 但没有工具活动，运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp wait，确认 ChatGPT 是否真的调用了 MCP。
9. 如果桌面客户端和 MCP 都不可用，再运行 cgn handoff，并告诉我需要在 ChatGPT 粘贴或上传什么，然后用 cgn done 导入回复。
10. 等 ChatGPT 生成交接报告后，读取 .chatgpt-native/reports/{id}/HANDOFF_REPORT.md 和 .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md。
11. 复核真实 diff，并运行测试。
12. 验证后再提交或 push。
`;
}

module.exports = {
  codexGuideText
};
