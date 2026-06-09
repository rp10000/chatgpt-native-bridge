# FAQ

## Is this using the OpenAI API?

No. It is a local CLI that packages context and opens the visible ChatGPT web app.

## Does it scrape ChatGPT?

No. It does not read DOM output, cookies, localStorage, IndexedDB, tokens, or network requests.

## Why not automate the browser?

Browser automation is fragile and would blur the safety boundary. This project keeps the user in control of the visible ChatGPT session.

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

`cgn init` installs `.agents/skills/chatgpt-native-bridge/SKILL.md`. You can also explicitly tell Codex: `Use chatgpt-native-bridge for this task.`
