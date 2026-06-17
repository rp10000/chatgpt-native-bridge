# FAQ

## Is this using the OpenAI API?

No. It is a local CLI and desktop client that packages context for the visible ChatGPT web app.

## Does it scrape ChatGPT?

No. It does not read DOM output, cookies, localStorage, IndexedDB, tokens, or network requests.

## Why not automate the browser?

Browser automation is fragile and would blur the safety boundary. This project keeps the user in control of the visible ChatGPT session.

## What is the main path now?

Since `v0.6.0`, the main path is the desktop client:

```bash
cgn start
```

Use `Pro 深度规划` for GPT-5.5 Pro clipboard relay, `Thinking 工具复核` for MCP-capable ChatGPT modes, and `写回 Codex` to copy the Codex continuation prompt.

## Can I choose automatic or manual mode?

Yes, but automatic means preparation, not submission:

```bash
cgn open latest --mode manual
cgn open latest --mode assist
cgn open latest --mode auto
```

`manual` prints paths only. `assist` opens ChatGPT and copies `01_PASTE_TO_CHATGPT.md`. `auto` also opens the outbox folder so you can see and select attachments. It does not paste, upload, click send, or scrape ChatGPT output.

## Do I need ChatGPT Plus or Pro?

The bridge can create handoff packs regardless of your ChatGPT plan. ChatGPT feature availability depends on your account and workspace.

## Can I use ChatGPT Projects?

Yes. The recommended setup is a Project named `Codex Native Advisor` with `.chatgpt-native/project-instructions.md` pasted into the Project instructions.

## Can I use images?

Yes. Include screenshots with `--include-screenshots "screenshots/*.png"` and upload them in ChatGPT.

## Can I upload files?

Yes. Use `--include-files` for relevant non-sensitive files, then upload the copied files from the outbox.

## What should I not upload?

Do not upload secrets, private keys, cookies, session dumps, authorization headers, `.env` files, or anything you are not willing to send to ChatGPT.

## How does Codex know when to use the bridge?

`npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp` installs `.agents/skills/chatgpt-native-bridge/SKILL.md` and the Codex MCP config block. You can also explicitly tell Codex: `Use chatgpt-native-bridge for this task.`
