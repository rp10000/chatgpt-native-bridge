function codexGuideText(lang = "en") {
  if (lang === "zh-CN") return chineseCodexGuide();
  return englishCodexGuide();
}

function englishCodexGuide() {
  return `Copy this into Codex:

Use chatgpt-native-bridge for this task.

If the task needs planning, architecture critique, UX review, naming/copy,
research, image direction, or diff review:

1. Prefer the MCP-first path. Check whether a chatgpt-native-bridge MCP server is available in Codex.
2. If it is not installed, run or ask me to run npx github:rp10000/chatgpt-native-bridge setup --mcp, then restart Codex or open a new thread.
3. If MCP is unavailable, run cgn handoff with the right --type values and tell me what to paste or upload into ChatGPT.
4. After ChatGPT submits through MCP or I run cgn done, read .chatgpt-native/inbox/{id}/reply.md and CODEX_READ_THIS.md.
5. Apply only useful recommendations locally.
6. Run tests.
`;
}

function chineseCodexGuide() {
  return `复制下面这段给 Codex：

这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

优先走 MCP 主路径。先检查 Codex 是否已经有 chatgpt-native-bridge MCP server。
如果还没安装，请运行或提示我运行 npx github:rp10000/chatgpt-native-bridge setup --mcp，然后重启 Codex 或打开新线程。
如果 MCP 不可用，再运行 cgn handoff 生成并打开 handoff，告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等 ChatGPT 通过 MCP 提交回复，或我运行 cgn done 导入回复后，
你读取 .chatgpt-native/inbox/{id}/reply.md 和 CODEX_READ_THIS.md，
只采纳合理建议，继续本地修改、测试和总结。
`;
}

module.exports = {
  codexGuideText
};
