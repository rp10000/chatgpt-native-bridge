# Public Beta Dogfood

## 2026-06-09 v0.1.0 self-test

Test target:

- GitHub release/tag: `v0.1.0`
- Release target before the dogfood fix: `425a5cc`
- Clean test project: Windows temp directory

## Flow tested

```bash
npx --yes github:rp10000/chatgpt-native-bridge#v0.1.0 setup --lang zh-CN
npx --yes github:rp10000/chatgpt-native-bridge#v0.1.0 handoff \
  --task "Dogfood beta workflow and review the small greet diff" \
  --type plan,diff-review \
  --include-diff \
  --include-files "README.md,src/index.js" \
  --dry-run
npx --yes github:rp10000/chatgpt-native-bridge#v0.1.0 done dogfood-reply.md
npx --yes github:rp10000/chatgpt-native-bridge#v0.1.0 status
npx --yes github:rp10000/chatgpt-native-bridge#v0.1.0 doctor
```

## Result

- Public GitHub install path worked.
- `setup` created the Codex Skill, `openai.yaml`, project instructions, config, outbox, inbox, assets, runs, and prompts.
- `doctor` reported `Result: ready` after setup.
- `handoff --dry-run` created an outbox without opening a browser or touching the clipboard.
- `status` moved from pending to ready after `done`.
- `doctor` reported latest handoff and latest reply as ready after `done`.

## Finding

The generated `ask.md` still contained raw `{{task}}` placeholders inside prompt template sections.

Impact:

- Not a workflow blocker because the top-level task was present.
- Still a public beta quality issue because ChatGPT would see unfinished template placeholders.

Fix:

- Render `{{task}}` in prompt templates while building `ask.md`.
- Add a regression assertion that `ask.md` does not contain `{{task}}`.

## Follow-up

- Re-run the public GitHub install path after the release tag is moved to the fix commit.
- Keep future beta feedback focused on install, Skill triggering, handoff packaging, `done`, and Codex continuation.
