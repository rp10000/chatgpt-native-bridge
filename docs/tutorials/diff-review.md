# Diff review tutorial

## Goal

Use ChatGPT as a second-pass reviewer after Codex has implemented local changes.

If MCP is available, let ChatGPT use `read_git_diff` and related bridge tools directly. The command below is the Markdown fallback.

## Command

```bash
cgn handoff \
  --task "Review Codex's current implementation before commit" \
  --type diff-review \
  --include-diff \
  --include-tests
```

## Files generated

```text
.chatgpt-native/outbox/{id}/01_PASTE_TO_CHATGPT.md
.chatgpt-native/outbox/{id}/context.md
.chatgpt-native/outbox/{id}/diff.patch
.chatgpt-native/outbox/{id}/test-output.md
```

## In ChatGPT

1. Paste `01_PASTE_TO_CHATGPT.md`.
2. Upload `context.md`, `diff.patch`, and `test-output.md`.
3. Ask ChatGPT to separate must-fix from nice-to-have.

## Example answer shape

```markdown
## Must fix
- The CLI help mentions a command that is not documented in README.

## Nice to have
- Add a troubleshooting note for clipboard failures.

## Codex next actions
- Update README command list.
- Add a focused test for the help output.
```

## What Codex should do next

Codex should verify each must-fix item against the codebase before implementing it, then rerun tests and package checks.
