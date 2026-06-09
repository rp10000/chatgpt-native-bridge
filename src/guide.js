function codexGuideText(lang = "en") {
  if (lang === "zh-CN") return chineseCodexGuide();
  return englishCodexGuide();
}

function englishCodexGuide() {
  return `Copy this into Codex:

Use chatgpt-native-bridge for this task.

If the task needs planning, architecture critique, UX review, naming/copy,
research, image direction, or diff review:

1. Run cgn ask with the right --type values.
2. Run cgn open latest.
3. Tell me what to paste or upload into ChatGPT.
4. Wait until I run cgn import latest --from-clipboard.
5. Read .chatgpt-native/inbox/<id>/reply.md.
6. Apply only useful recommendations locally.
7. Run tests.
`;
}

function chineseCodexGuide() {
  return `复制下面这段给 Codex：

这个任务如果需要规划、架构批判、UI/UX 复核、命名文案、研究、图片方向或 diff review，
请使用 chatgpt-native-bridge。

你来运行 cgn ask 生成 handoff。
然后运行 cgn open latest。
告诉我需要在 ChatGPT 里粘贴什么、上传什么。
等我运行 cgn import latest --from-clipboard 导入回复后，
你读取 .chatgpt-native/inbox/<id>/reply.md，
只采纳合理建议，继续本地修改、测试和总结。
`;
}

module.exports = {
  codexGuideText
};
