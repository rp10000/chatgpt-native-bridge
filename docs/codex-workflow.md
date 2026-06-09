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
1. Run cgn ask with the right --type values.
2. Run cgn open latest.
3. Tell me exactly what to paste or upload into ChatGPT.
4. After I import the reply with cgn import, read the reply.md.
5. Continue implementation locally.
6. Run relevant tests.
```

## Planning and requirements

```text
Use chatgpt-native-bridge for planning and requirements before implementation.
Create a handoff with --type plan,requirements, then wait for my imported reply.
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
After implementation, create a diff-review handoff with --include-diff and
--include-tests. Import ChatGPT's reply, then fix only the must-fix items that
are technically sound for this repo.
```
