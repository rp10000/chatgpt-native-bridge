function demoText() {
  return `30-second chatgpt-native-bridge demo

1. Open the local sidecar GUI inside a Codex project:
   cgn start

2. For GPT-5.5 Pro planning:
   - click Deep Pro Plan / Copy Pro Prompt
   - paste the prompt into GPT-5.5 Pro
   - copy Pro's marked reply
   - let the GUI import it into the Codex inbox

3. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md

4. Codex continues local implementation and runs relevant checks.

5. To initialize the bridge in a new project:
   cgn setup --mcp

6. If the project was already initialized, install only the MCP config:
   cgn mcp install

7. Restart Codex, or open a new Codex thread, so it reloads MCP config.

8. If you want ChatGPT Thinking to connect through MCP, print the web setup guide:
   cgn mcp web

9. For ChatGPT web MCP, use one command:
   cgn mcp connect --yes --open

10. In ChatGPT, create the connector with the printed fields:
   - Name: chatgpt-native-bridge
   - Server URL: the copied https://.../mcp URL
   - Authentication: No authentication

11. After selecting the app in ChatGPT, verify that it really calls MCP:
   cgn mcp wait

12. In ChatGPT Thinking, ask naturally:
   Use chatgpt-native-bridge to review this project and send your final advice back to Codex.

13. If web MCP is unavailable, use the Markdown fallback:
   cgn handoff --task "Review onboarding UX" --type plan,ux-review,naming-copy

14. In fallback mode:
   - paste 01_PASTE_TO_CHATGPT.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

15. Copy ChatGPT's final answer, then import it:
   cgn done
`;
}

module.exports = {
  demoText
};
