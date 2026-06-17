function demoText() {
  return `30-second chatgpt-native-bridge demo

1. Open the desktop client inside a Codex project:
   cgn start

2. Main path:
   - click 连接 ChatGPT
   - create or refresh the ChatGPT tool when the connection is ready
   - click 开始复核
   - paste the copied request into ChatGPT
   - wait for ChatGPT to write back
   - click 交给 Codex and paste the copied sentence into Codex

3. Pro helper path:
   - use Pro 辅助规划 when ChatGPT cannot call tools
   - Pro can only use the packaged context copied by the client

4. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md
   .chatgpt-native/inbox/{id}/CODEX_READ_THIS.md

5. Codex continues local implementation and runs relevant checks.

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
