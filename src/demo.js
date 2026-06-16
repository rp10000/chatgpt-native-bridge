function demoText() {
  return `30-second MCP-first bridge demo

1. Initialize the bridge inside a Codex project:
   cgn setup --mcp

2. If the project was already initialized, install only the MCP config:
   cgn mcp install

3. Restart Codex, or open a new Codex thread, so it reloads MCP config.

4. If you want ChatGPT web to connect, print the web setup guide:
   cgn mcp web

5. For ChatGPT web, keep a local server running and create an HTTPS tunnel:
   cgn mcp serve --host 127.0.0.1 --port 47832
   cgn mcp tunnel

6. Use the ChatGPT MCP connector:
   - inspect bounded repo context with the bridge tools
   - submit final advice with submit_reply_to_codex

7. If web MCP is unavailable, use the Markdown fallback:
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
