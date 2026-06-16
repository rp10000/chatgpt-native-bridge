# Public Beta Dogfood

## 2026-06-09 v0.1.0 self-test

Test target:

- GitHub release/tag: `v0.1.0`
- Release target before the dogfood fix: `425a5cc`
- Clean test project: Windows temp directory

## Flow tested

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn setup --lang zh-CN
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn handoff \
  --task "Dogfood beta workflow and review the small greet diff" \
  --type plan,diff-review \
  --include-diff \
  --include-files "README.md,src/index.js" \
  --dry-run
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn done dogfood-reply.md
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn status
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn doctor
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

- Keep future beta feedback focused on install, Skill triggering, handoff packaging, `done`, and Codex continuation.

## 2026-06-09 post-fix public tag retest

After moving `v0.1.0` to the placeholder fix commit, the public GitHub install path was tested again from a fresh Windows temp project with a fresh npm cache:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn setup --lang zh-CN
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn handoff \
  --task "Post-fix public beta dogfood" \
  --type plan,diff-review \
  --include-diff \
  --dry-run
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn done dogfood-reply.md
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn status
npx --yes --package github:rp10000/chatgpt-native-bridge#v0.1.0 cgn doctor
```

Result:

- `setup` completed and `doctor` reported `Result: ready`.
- `handoff --dry-run` created a new outbox.
- Generated `ask.md` contained the task text and did not contain `{{task}}`.
- `done` imported the reply.
- `status` showed no pending runs and one ready run.
- `doctor` reported latest handoff and latest reply as ready.
