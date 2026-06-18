function demoText() {
  return `30-second chatgpt-native-bridge demo

1. Open the desktop client inside a Codex project:
   cgn start

2. Main path:
   - click 选择项目 if needed
   - click 连接 ChatGPT
   - create or refresh the ChatGPT tool when the connection is ready
   - send this in ChatGPT: 请使用 chatgpt-native-bridge 打开当前连接项目
   - let ChatGPT read, edit, run checks, and show changes in the web chat
   - ask ChatGPT to create a handoff report, or click 生成交接报告 in the client

3. Pro helper path:
   - use Pro 辅助规划 when ChatGPT cannot call tools
   - Pro can only use the packaged context copied by the client

4. Ask Codex to review:
   .chatgpt-native/reports/{id}/HANDOFF_REPORT.md
   .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md

5. Codex reviews the actual diff, runs relevant checks, then commits or pushes if appropriate.

Install path:

6. Initialize the project:
   cgn setup

7. Install Codex MCP config:
   cgn setup --mcp
   or
   cgn mcp install

8. Restart Codex, or open a new Codex thread, so it reloads MCP config.

Terminal fallback:

9. If you want ChatGPT Thinking to connect through MCP, print the web setup guide:
   cgn mcp web

10. One-command ChatGPT web connector setup:
   cgn mcp connect --yes --open

11. Watch whether ChatGPT actually called the bridge:
   cgn mcp wait
   cgn mcp trace

Markdown fallback:

12. Create a handoff:
   cgn handoff --task "Review onboarding UX" --type ux-review --include-diff

13. Paste the generated handoff into ChatGPT, then import the reply:
   cgn done
`;
}

module.exports = {
  demoText,
  formatDemo: demoText
};
