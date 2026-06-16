function demoText() {
  return `30-second MCP-first bridge demo

1. Initialize the bridge inside a Codex project:
   cgn setup --mcp

2. If the project was already initialized, install only the MCP config:
   cgn mcp install

3. Restart Codex, or open a new Codex thread, so it reloads MCP config.

4. If you want ChatGPT web to connect, print the web setup guide:
   cgn mcp web

5. For ChatGPT web, use one command:
   cgn mcp connect --yes --open

6. In ChatGPT, create the connector with the printed fields:
   - Name: chatgpt-native-bridge
   - Server URL: the copied https://.../mcp URL
   - Authentication: No authentication

7. In ChatGPT, ask naturally:
   Use chatgpt-native-bridge to review this project and send your final advice back to Codex.

8. If web MCP is unavailable, use the Markdown fallback:
   cgn handoff --task "Review onboarding UX" --type plan,ux-review,naming-copy

9. In fallback mode:
   - paste 01_PASTE_TO_CHATGPT.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

10. Copy ChatGPT's final answer, then import it:
   cgn done

11. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md

12. Codex continues local implementation and runs relevant checks.
`;
}

module.exports = {
  demoText
};
