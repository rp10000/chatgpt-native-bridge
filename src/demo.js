function demoText() {
  return `30-second native handoff demo

1. Initialize the bridge inside a Codex project:
   cgn setup

2. Create and open a handoff pack:
   cgn handoff --task "Review onboarding UX" --type plan,ux-review,naming-copy

3. In ChatGPT:
   - paste ask.md
   - upload context.md and any files/screenshots from the outbox
   - use native ChatGPT tools when helpful

4. Copy ChatGPT's final answer, then import it:
   cgn done

5. Ask Codex to read:
   .chatgpt-native/inbox/{id}/reply.md

6. Codex continues local implementation and runs relevant checks.
`;
}

module.exports = {
  demoText
};
