# ChatGPT Project setup

## 1. Create the Project

Open ChatGPT and create a Project named:

```text
Codex Native Advisor
```

## 2. Paste Project instructions

Run:

```bash
npx github:rp10000/chatgpt-native-bridge setup --mcp
```

Then open:

```text
.chatgpt-native/project-instructions.md
```

Paste the file into the ChatGPT Project instructions.

## 3. Connect the MCP bridge first

The setup command installs the Codex MCP config. Restart Codex, or open a new Codex thread, so the MCP config reloads.

If the project was already initialized but the MCP server is missing from Codex, run:

```bash
cgn mcp install
```

Print connection hints:

```bash
cgn mcp config
```

Connect ChatGPT to the `/mcp` endpoint through the official MCP connection flow available to your account or workspace.

Manual HTTP server fallback:

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

## 4. Fallback: upload the handoff material

After:

```bash
cgn handoff --task "..." --type plan,ux-review
```

paste `01_PASTE_TO_CHATGPT.md` into ChatGPT.

Upload only what the task needs:

- `context.md`
- `diff.patch`
- `test-output.md`
- files copied under `files/`
- screenshots copied under `screenshots/`

## 5. Use native tools

Let ChatGPT use native tools when helpful: file analysis, image analysis, research, Canvas, image generation, or long-context Project memory.

## 6. Bring back the answer

Ask ChatGPT to end with:

```markdown
## Codex next actions
```

With MCP, use `submit_reply_to_codex`.

Without MCP, copy the final answer and run:

```bash
cgn done
```

Codex can now read:

```text
.chatgpt-native/inbox/{id}/reply.md
```
