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
2. Prefer the local GUI path for GPT-5.5 Pro planning. Run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start.
3. If ChatGPT Thinking should use MCP tools, check whether MCP is installed. If not, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp, then restart Codex or open a new thread.
4. If ChatGPT web MCP is not connected, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open.
5. If ChatGPT is selected but no reply appears, run or ask me to run npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp wait to confirm whether ChatGPT actually called MCP.
6. If GUI relay and MCP are unavailable, run cgn handoff with the right --type values and tell me what to paste or upload into ChatGPT.
7. After the GUI imports a Pro reply, ChatGPT writes back through MCP, or I run cgn done, read .chatgpt-native/inbox/{id}/reply.md and CODEX_READ_THIS.md.
8. Apply only useful recommendations locally.
9. Run tests.
`;
}

function chineseCodexGuide() {
  return `复制下面这段给 Codex：

这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

优先走本地 GUI 路径。需要 GPT-5.5 Pro 深度规划时，请运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn start。
如果需要 ChatGPT Thinking 通过 MCP 读取项目，再检查 Codex 是否已经有 chatgpt-native-bridge MCP server。
如果还没安装，请运行或提示我运行 npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp，然后重启 Codex 或打开新线程。
如果 GUI 接力和 MCP 都不可用，再运行 cgn handoff 生成并打开 handoff，告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等 GUI 导入 Pro 回复、ChatGPT 通过 MCP 提交回复，或我运行 cgn done 导入回复后，
你读取 .chatgpt-native/inbox/{id}/reply.md 和 CODEX_READ_THIS.md，
只采纳合理建议，继续本地修改、测试和总结。
`;
}

module.exports = {
  codexGuideText
};
