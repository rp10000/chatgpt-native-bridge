function demoText() {
  return `30-second MCP-first bridge demo

1. Initialize the bridge inside a Codex project:
   cgn setup

2. Start the local MCP bridge:
   cgn mcp serve --host 127.0.0.1 --port 47832

3. Print connection hints:
   cgn mcp config

4. In ChatGPT:
   - connect to the MCP endpoint
   - inspect bounded repo context with the bridge tools
   - submit final advice with submit_reply_to_codex

5. If MCP is unavailable, use the Markdown fallback:
   cgn handoff --task "Review onboarding UX" --type plan,ux-review,naming-copy

6. In fallback mode:
   - paste 01_PASTE_TO_CHATGPT.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

7. Copy ChatGPT's final answer, then import it:
   cgn done

8. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md

9. Codex continues local implementation and runs relevant checks.
`;
}

module.exports = {
  demoText
};
