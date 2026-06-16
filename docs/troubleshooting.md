# Troubleshooting

## `npx` command not found

Install Node.js and npm, then retry. The package requires Node 18 or newer.

## Package not published yet

This repo is public, but npm registry publication may happen later. Use the GitHub form:

```bash
npx github:rp10000/chatgpt-native-bridge init
```

or clone locally:

```bash
git clone https://github.com/rp10000/chatgpt-native-bridge.git
cd chatgpt-native-bridge
npm link
cgn --help
```

## MCP endpoint is not running

Start the local server:

```bash
cgn mcp serve --host 127.0.0.1 --port 47832
```

Then open:

```text
http://127.0.0.1:47832/health
```

It should return a small JSON health response.

## MCP port is already in use

Choose another port:

```bash
cgn mcp serve --host 127.0.0.1 --port 47833
cgn mcp config --port 47833
```

Use the matching `/mcp` endpoint in ChatGPT.

## ChatGPT cannot reach `127.0.0.1`

Some ChatGPT MCP connection paths cannot call your local loopback address directly. Use the official MCP connection flow available to your account or workspace, such as a Secure MCP Tunnel.

Do not solve this by scraping ChatGPT web sessions, extracting cookies, or using hidden endpoints.

## I expected a shell tool

The MCP server intentionally does not expose arbitrary shell execution. ChatGPT advises through bounded MCP tools, then Codex executes locally.

Available MCP tools are listed by:

```bash
cgn mcp config
```

## `cgn open` does not open the browser

Run:

```bash
cgn open latest --dry-run
```

Then open `https://chatgpt.com` manually and paste `.chatgpt-native/outbox/{id}/01_PASTE_TO_CHATGPT.md`.

To print paths only:

```bash
cgn open latest --mode manual
```

To open both ChatGPT and the outbox folder:

```bash
cgn open latest --mode auto
```

## Clipboard copy failed

Open the outbox path printed by `cgn open`, then manually copy `01_PASTE_TO_CHATGPT.md`.

## I cannot see what to upload

Run:

```bash
cgn open latest --mode manual
```

Check the output sections:

```text
Paste prompt
Upload/select in ChatGPT
Outbox
```

## Latest handoff not found

Run:

```bash
cgn status
```

If there are no pending or ready items, create one:

```bash
cgn handoff --task "Review onboarding UX" --type plan,ux-review
```

## ChatGPT reply not imported

Copy the ChatGPT reply and run:

```bash
cgn done
```

or save it to a file:

```bash
cgn import latest ./reply.md
```

## Codex did not pick the skill

Ask explicitly:

```text
Use chatgpt-native-bridge for this task.
```

Also verify the Skill exists:

```bash
cgn doctor
```

## Screenshots not included

Check the glob and path:

```bash
cgn handoff --task "Review UI" --type ux-review --include-screenshots "screenshots/*.png"
```

The CLI copies matching files into the outbox `screenshots/` folder.

## Secret guard blocked a file

The bridge blocks obvious sensitive paths and secret-like content. Remove the sensitive material, create a safe summary, or leave the file out of the handoff.
