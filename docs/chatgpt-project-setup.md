# ChatGPT Project setup

## 1. Create the Project

Open ChatGPT and create a Project named:

```text
Codex Native Advisor
```

## 2. Paste Project instructions

Run:

```bash
npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp
```

Then open:

```text
.chatgpt-native/project-instructions.md
```

Paste the file into the ChatGPT Project instructions.

## 3. Connect the MCP bridge

The setup command installs the Codex MCP config. Restart Codex, or open a new Codex thread, so the MCP config reloads.

If the project was already initialized but the MCP server is missing from Codex, run:

```bash
cgn mcp install
```

For ChatGPT web, run:

```bash
cgn mcp connect --yes --open
```

Create the ChatGPT connector with the printed fields. After that, use natural language in ChatGPT:

```text
Use chatgpt-native-bridge to review this project.
Check the current project state and diff, read relevant files if needed,
then send your final advice back to Codex.
```

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

With MCP, ChatGPT should write the final advice back automatically.

Without MCP, copy the final answer and run:

```bash
cgn done
```

Codex can now read:

```text
.chatgpt-native/inbox/{id}/reply.md
```
