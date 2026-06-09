# ChatGPT Project setup

## 1. Create the Project

Open ChatGPT and create a Project named:

```text
Codex Native Advisor
```

## 2. Paste Project instructions

Run:

```bash
cgn init
```

Then open:

```text
.chatgpt-native/project-instructions.md
```

Paste the file into the ChatGPT Project instructions.

## 3. Upload the handoff material

After:

```bash
cgn ask --task "..." --type plan,ux-review
cgn open latest
```

paste `ask.md` into ChatGPT.

Upload only what the task needs:

- `context.md`
- `diff.patch`
- `test-output.md`
- files copied under `files/`
- screenshots copied under `screenshots/`

## 4. Use native tools

Let ChatGPT use native tools when helpful: file analysis, image analysis, research, Canvas, image generation, or long-context Project memory.

## 5. Bring back the answer

Ask ChatGPT to end with:

```markdown
## Codex next actions
```

Copy the final answer and run:

```bash
cgn import latest --from-clipboard
```

Codex can now read:

```text
.chatgpt-native/inbox/<id>/reply.md
```
