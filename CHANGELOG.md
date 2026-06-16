# Changelog

## v0.2.8

- Use the more reliable GitHub npx form: `npx --yes --package github:rp10000/chatgpt-native-bridge cgn ...`.
- Update generated Codex MCP config to launch through `npx --yes --package ... cgn mcp serve --stdio`.
- Keep local/global users on the shorter `cgn ...` commands after installation.

## v0.2.7

- Add `review_current_project` as the default one-call MCP entry for ChatGPT project review, planning, and continuation.
- Add `cgn mcp wait` so users can verify whether ChatGPT actually called the connector instead of only selecting it in the UI.
- Add ChatGPT Apps `_meta` invocation labels to MCP tool descriptors.
- Update README, Chinese README, MCP docs, quickstart, demo, and Codex guide with the new verification flow.

## v0.2.6

- Make the recommended ChatGPT flow automatic: users ask naturally, ChatGPT should inspect the project through MCP and write final advice back to Codex.
- Strengthen ChatGPT Project instructions so `bridge_status`, `read_git_diff`, relevant file reads, and `submit_reply_to_codex` happen by default for project tasks.
- Strengthen MCP tool descriptions and `nextAction` hints so ChatGPT knows the expected tool order without the user naming tools.
- Update README, Chinese README, quickstart, MCP docs, Codex workflow docs, and Skill template to stop teaching normal users to memorize MCP tool names.
- Update the ChatGPT connector description to say it automatically inspects bounded context and submits final advice back to Codex.

## v0.2.5

- Add a project-local `cloudflared` download fallback for `cgn mcp connect --yes --open` on Windows.
- Keep trying `winget` first, but continue by downloading `cloudflared.exe` into `.chatgpt-native/bin/` when `winget` fails.
- Update README, Chinese README, and MCP docs to explain the fallback install path.
- Add a regression test for project-local `cloudflared.exe` download.

## v0.2.4

- Add `cgn mcp connect --yes --open` as the recommended ChatGPT web setup command.
- Copy the generated HTTPS `/mcp` Server URL to the clipboard when the Cloudflare Tunnel URL is ready.
- Open the ChatGPT connector settings page on request and print the exact new-app fields to fill.
- Update README, Chinese README, and MCP docs with the direct ChatGPT link, Developer Mode fallback, and visible final Create step.

## v0.2.3

- Add `cgn mcp connect --yes`, a one-command ChatGPT web connector path.
- Start the local MCP server, install `cloudflared` with `winget` on Windows if missing, start a Cloudflare Tunnel, and print the HTTPS `/mcp` URL for ChatGPT.
- Keep `cgn mcp web`, `cgn mcp tunnel`, and `cgn mcp cloudflare` as guided/manual alternatives.
- Fix HTTP MCP test support for `port: 0`.

## v0.2.2

- Add `cgn mcp web`, a beginner guide for connecting ChatGPT web when localhost URLs are rejected.
- Add `cgn mcp tunnel` and `cgn mcp cloudflare` to start a Cloudflare Tunnel and print the HTTPS `/mcp` URL for ChatGPT.
- Update README and Chinese README with the shorter ChatGPT web connection path.
- Add tests for the web connector guide, tunnel dry-run output, and Cloudflare tunnel URL extraction.

## v0.2.1

- Add one-command Codex MCP installation with `cgn setup --mcp`.
- Add `cgn mcp install` to write the `chatgpt-native-bridge` MCP server block into Codex config.
- Use `npx --yes --package github:rp10000/chatgpt-native-bridge cgn mcp serve --stdio` in generated MCP config so users do not need a global `cgn` install.
- Update README, quickstart, Skill template, guide prompts, and troubleshooting docs for the MCP install-first workflow.
- Keep manual `cgn mcp serve` and Markdown handoff as fallback paths.

## v0.2.0

- Make MCP the primary bridge path with `cgn mcp serve`, `cgn mcp config`, and `cgn mcp doctor`.
- Add a local MCP server using `@modelcontextprotocol/sdk`.
- Expose the minimum MCP tool surface:
  - `bridge_status`
  - `create_handoff`
  - `list_handoff_files`
  - `read_handoff_file`
  - `read_repo_file`
  - `read_git_diff`
  - `submit_reply_to_codex`
- Keep Markdown handoff files as the fallback path.
- Add bounded file reads, path traversal checks, `.git`/`node_modules` blocking, secret-content checks, and compact MCP audit logging.
- Add MCP setup and MCP security docs.
- Update README, Chinese README, ChatGPT Project instructions, and Skill template for the MCP-first workflow.

## v0.1.2

- Add self-explaining handoff files in each outbox:
  - `START_HERE.md`
  - `01_PASTE_TO_CHATGPT.md`
  - `02_UPLOAD_THESE_FILES.md`
  - `03_AFTER_CHATGPT_REPLY.md`
  - `manifest.json`
- Make `cgn open` copy `01_PASTE_TO_CHATGPT.md`, with `ask.md` kept for compatibility.
- Make `cgn done` generate `CODEX_READ_THIS.md` next to `reply.md`.
- Update terminal output to show the run id, paste prompt file, upload checklist file, after-reply file, outbox, and reply path.
- Clarify that `manual`, `assist`, and `auto` only change local helper behavior and never automate ChatGPT web submission or scraping.

## v0.1.0 - Public Beta

Initial public beta.

- Codex-first local ChatGPT native handoff workflow
- Local CLI and Codex Skill template
- English and Chinese docs
- Beginner commands: `setup`, `handoff`, `done`
- Advanced commands: `init`, `ask`, `open`, `import`, `status`, `demo`, `doctor`, `guide codex`
- Lightweight secret guard
- Tests and smoke checks
- Prompt templates render the handoff task without raw `{{task}}` placeholders
