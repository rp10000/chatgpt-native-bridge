# FAQ

## Is this using the OpenAI API?

No. The normal flow uses the visible ChatGPT web app and a local bridge. No API key is required.

## Does it scrape ChatGPT?

No. It does not read the ChatGPT page, DOM, cookies, localStorage, IndexedDB, tokens, or browser network requests.

## What is the main path now?

Since `v1.0.0`, the main path is:

```text
Select project -> Connect ChatGPT -> Work in ChatGPT web -> Create handoff report
```

ChatGPT Thinking/MCP is the path that can read the local project through workspace tools, run commands, edit files, show result cards, and create a handoff report for Codex review.

When the current ChatGPT mode supports MCP Apps UI, key tool calls also show project, command, file-change, and handoff report cards in the ChatGPT web conversation.

## Can ChatGPT see my whole computer?

No. By default, ChatGPT can only work in the current project selected in the desktop client.

If ChatGPT asks for a different path, the bridge rejects it with a project-mismatch error. Switch projects in the desktop client and reconnect if you really want ChatGPT to work on another project.

## What is GPT-5.5 Pro used for?

Pro is an auxiliary planning path. It cannot directly read local files or call the bridge tools in this design.

The desktop client packages context, copies it to the clipboard, and imports a marked Pro reply as a fallback note.

## Why not automate the browser?

Browser automation is fragile and would blur the safety boundary. This project keeps the user in control of the visible ChatGPT session.

## Why cannot the client create the ChatGPT app automatically?

Creating or editing ChatGPT apps through the web UI would require browser automation or hidden web calls. This project does not do that.

The client prepares the connection address and keeps the steps short.

## Does MCP give ChatGPT shell access?

Yes. The MCP workspace path exposes `bash` for the connected project. It also exposes `read`, `write`, `edit`, `list_directory`, `search_workspace`, `command_history`, and `show_changes`.

It does not automatically commit or push. The REST Actions fallback does not expose shell or source-file write tools.

## Can I still use the manual mode?

Yes:

```bash
cgn handoff --task "Review this project"
cgn done
```

## What should I not send to ChatGPT?

Do not send `.env`, private keys, cookies, session dumps, authorization headers, tokens, passwords, or anything you are not willing to share with ChatGPT.
