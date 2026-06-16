# Codex workflow

The installed Skill lives at:

```text
.agents/skills/chatgpt-native-bridge/SKILL.md
```

Codex can use that Skill when the task benefits from ChatGPT-native review or planning. You can also ask explicitly.

## General prompt

```text
Use chatgpt-native-bridge for this task.

First decide whether the task needs ChatGPT-native planning, architecture critique,
UX review, naming/copy review, research, image direction, or diff review.

If yes:
1. First check whether `.chatgpt-native/inbox` has a new reply. If yes, read `reply.md` and `CODEX_READ_THIS.md`.
2. Prefer the MCP-first path. If ChatGPT is connected, tell me to ask ChatGPT naturally: "Use chatgpt-native-bridge to review this project and send your final advice back to Codex."
3. If MCP is not installed, run or ask me to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn setup --mcp`, then restart Codex or open a new thread.
4. If ChatGPT web is not connected, run or ask me to run `npx --yes --package github:rp10000/chatgpt-native-bridge -- cgn mcp connect --yes --open`.
5. If MCP is unavailable, run `cgn handoff` with the right --type values.
6. After ChatGPT writes back through MCP or I import the reply with `cgn done`, read `reply.md` and `CODEX_READ_THIS.md`.
7. Continue implementation locally.
8. Run relevant tests.
```

## Planning and requirements

```text
Use chatgpt-native-bridge for planning and requirements before implementation.
Prefer MCP. If MCP is unavailable, create a handoff with --type plan,requirements,
then wait for my imported reply.
```

## Architecture review

```text
Before refactoring, use chatgpt-native-bridge for architecture review.
Include the relevant source files and ask ChatGPT to identify simpler options,
risks, and tests Codex should run.
```

## UX review with screenshots

```text
Use chatgpt-native-bridge for UX review and naming/copy critique.
Include screenshots from screenshots/*.png and any relevant component files.
After I import ChatGPT's reply, apply the must-fix items locally.
```

## Research or deep research

```text
Use chatgpt-native-bridge for research.
Ask ChatGPT to use web-native research tools if useful and to return sources,
tradeoffs, and Codex next actions.
```

## Image direction

```text
Use chatgpt-native-bridge for visual direction.
Ask ChatGPT for image prompts, placement guidance, and what would clash with
the current product.
```

## Diff review after implementation

```text
After implementation, prefer MCP for diff review. If MCP is unavailable, create
a diff-review handoff with --include-diff and --include-tests. Import ChatGPT's
reply, then fix only the must-fix items that are technically sound for this repo.
```
