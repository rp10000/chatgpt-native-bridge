# Changelog

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
