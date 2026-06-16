function demoText() {
  return `30-second MCP-first bridge demo

1. Initialize the bridge inside a Codex project:
   cgn setup --mcp

2. If the project was already initialized, install only the MCP config:
   cgn mcp install

3. Restart Codex, or open a new Codex thread, so it reloads MCP config.

4. Print connection hints when needed:
   cgn mcp config

5. Use the ChatGPT MCP connector:
   - inspect bounded repo context with the bridge tools
   - submit final advice with submit_reply_to_codex

6. Manual local server fallback:
   cgn mcp serve --host 127.0.0.1 --port 47832

7. If MCP is unavailable, use the Markdown fallback:
   cgn handoff --task "Review onboarding UX" --type plan,ux-review,naming-copy

8. In fallback mode:
   - paste 01_PASTE_TO_CHATGPT.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

9. Copy ChatGPT's final answer, then import it:
   cgn done

10. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md

11. Codex continues local implementation and runs relevant checks.
`;
}

module.exports = {
  demoText
};
