function demoText() {
  return `30-second native handoff demo

1. Initialize the bridge inside a Codex project:
   cgn init

2. Create a handoff pack:
   cgn ask --task "Review onboarding UX" --type plan,ux-review,naming-copy

3. Open ChatGPT and copy ask.md:
   cgn open latest

4. In ChatGPT:
   - paste ask.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

5. Copy ChatGPT's final answer, then import it:
   cgn import latest --from-clipboard

6. Ask Codex to read:
   .chatgpt-native/inbox/<id>/reply.md

7. Codex continues local implementation and runs relevant checks.
`;
}

module.exports = {
  demoText
};
