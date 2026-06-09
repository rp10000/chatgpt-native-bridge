# chatgpt-native-bridge

Use ChatGPT's native web app as a visible advisor for Codex.

No OpenAI API key. No hidden endpoints. No browser scraping. No rigid JSON protocol.

Codex runs locally. ChatGPT plans, critiques, researches, reviews, and creates visual direction using the tools you already have in ChatGPT. The user controls the visible ChatGPT web session.

## What it is

`chatgpt-native-bridge` is a small local npm CLI plus a Codex Skill template.

It packages local context into a handoff folder:

- task prompt
- repo context
- optional git diff
- optional test output
- selected files
- selected screenshots

Then it opens ChatGPT, copies the prompt, and leaves the user in control of the ChatGPT session. When the user copies ChatGPT's answer back, Codex imports the reply and continues local execution.

## What it does not do

- It does not use the OpenAI API.
- It does not read cookies, tokens, localStorage, IndexedDB, DOM output, or network requests.
- It does not scrape ChatGPT.
- It does not automate ChatGPT as a browser robot.
- It does not force ChatGPT replies into JSON.
- It does not act as a SaaS proxy.

## Install

Inside a Codex project:

```bash
npx chatgpt-native-bridge init
```

When installed locally or globally, the short command is:

```bash
cgn init
```

`init` creates:

```text
.agents/
  skills/
    chatgpt-native-bridge/
      SKILL.md

.chatgpt-native/
  config.json
  project-instructions.md
  outbox/
  inbox/
  assets/
  runs/
  prompts/
```

Open ChatGPT, create a Project such as `Codex Native Advisor`, and paste `.chatgpt-native/project-instructions.md` into the Project instructions.

## Commands

### `cgn init`

Create the local Codex Skill and `.chatgpt-native` workspace.

```bash
cgn init
```

### `cgn ask`

Create a ChatGPT-native handoff pack.

```bash
cgn ask \
  --task "Review the new pricing page" \
  --type ux-review,naming-copy \
  --include-diff
```

Useful options:

```bash
--task "..."
--type plan,requirements,architecture,naming-copy,ux-review,research,image-direction,diff-review
--include-diff
--include-tests
--include-files "src/*.js,README.md"
--include-screenshots "screenshots/*.png"
```

The command writes:

```text
.chatgpt-native/outbox/<id>/
  ask.md
  context.md
  diff.patch
  test-output.md
  files/
  screenshots/
```

Only files that exist and pass the lightweight secret guard are copied.

### `cgn open`

Open ChatGPT and copy `ask.md` to the clipboard.

```bash
cgn open latest
```

For dry runs:

```bash
cgn open latest --dry-run
```

### `cgn import`

Import the user-provided ChatGPT reply.

```bash
cgn import latest ./reply.md
```

Or from the clipboard:

```bash
cgn import latest --from-clipboard
```

The reply is saved to:

```text
.chatgpt-native/inbox/<id>/reply.md
```

### `cgn status`

Show pending handoffs and imported replies.

```bash
cgn status
```

## Request types

The CLI includes eight small prompt modules:

- `plan`
- `requirements`
- `architecture`
- `naming-copy`
- `ux-review`
- `research`
- `image-direction`
- `diff-review`

ChatGPT can answer in free-form Markdown. The templates ask for a `Codex next actions` section when possible, but they do not require a strict schema.

## Safety boundary

The bridge has a lightweight secret guard. It blocks obvious sensitive paths or content:

- `.env` and `.env.*`
- private key files such as `*.pem`, `*.key`, SSH private keys
- cookie or session files
- private key blocks
- Authorization headers
- API key, token, secret, or password assignments

This is intentionally not an enterprise data-loss-prevention system. Review what you include before uploading anything to ChatGPT.

## Examples

Planning:

```bash
cgn ask --task "Plan a small refactor for onboarding" --type plan,requirements
cgn open latest
```

Architecture review:

```bash
cgn ask --task "Review the local handoff protocol" --type architecture --include-files "src/*.js"
```

UX screenshot review:

```bash
cgn ask --task "Critique the first-run UI" --type ux-review,naming-copy --include-screenshots "screenshots/*.png"
```

Image direction:

```bash
cgn ask --task "Suggest a hero image direction for the app" --type image-direction
```

Diff review:

```bash
cgn ask --task "Review Codex's current diff" --type diff-review --include-diff
```

## Development

```bash
npm test
npm run smoke
npm pack --dry-run
```

This package has no runtime dependencies.
