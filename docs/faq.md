# FAQ

## Is this using the OpenAI API?

No. The normal flow uses the visible ChatGPT web app and a local bridge. No API key is required.

## Does it scrape ChatGPT?

No. It does not read the ChatGPT page, DOM, cookies, localStorage, IndexedDB, tokens, or browser network requests.

## What is the main path now?

Since `v0.7.0`, the main path is:

```text
连接 ChatGPT -> 开始复核 -> 交给 Codex
```

ChatGPT Thinking/MCP is the path that can read the local project through bounded tools and write advice back to Codex.

## What is GPT-5.5 Pro used for?

Pro is an auxiliary planning path. It cannot directly read local files or call the bridge tools in this design.

The desktop client packages context, copies it to the clipboard, and imports a marked Pro reply back into the Codex inbox.

## Why not automate the browser?

Browser automation is fragile and would blur the safety boundary. This project keeps the user in control of the visible ChatGPT session.

## Why cannot the client create the ChatGPT app automatically?

Creating or editing ChatGPT apps through the web UI would require browser automation or hidden web calls. This project does not do that.

The client prepares the connection address and keeps the steps short.

## Does MCP give ChatGPT shell access?

No. The MCP tools are bounded. They can read project status, safe files, diffs, handoff files, and write final advice into `.chatgpt-native/inbox`.

They do not expose arbitrary shell, arbitrary file writes, commit, or push.

## Can I still use the manual mode?

Yes:

```bash
cgn handoff --task "Review this project"
cgn done
```

## What should I not send to ChatGPT?

Do not send `.env`, private keys, cookies, session dumps, authorization headers, tokens, passwords, or anything you are not willing to share with ChatGPT.
