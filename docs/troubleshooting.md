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

## `cgn open` does not open the browser

Run:

```bash
cgn open latest --dry-run
```

Then open `https://chatgpt.com` manually and paste `.chatgpt-native/outbox/{id}/ask.md`.

To print paths only:

```bash
cgn open latest --mode manual
```

To open both ChatGPT and the outbox folder:

```bash
cgn open latest --mode auto
```

## Clipboard copy failed

Open the outbox path printed by `cgn open`, then manually copy `ask.md`.

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
cgn ask --task "Review onboarding UX" --type plan,ux-review
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
cgn ask --task "Review UI" --type ux-review --include-screenshots "screenshots/*.png"
```

The CLI copies matching files into the outbox `screenshots/` folder.

## Secret guard blocked a file

The bridge blocks obvious sensitive paths and secret-like content. Remove the sensitive material, create a safe summary, or leave the file out of the handoff.
