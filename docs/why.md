# Why this exists

`chatgpt-native-bridge` is not another agent platform. It is a small handoff protocol between two strengths:

- Codex executes locally in the repo.
- ChatGPT web handles visible native thinking, review, research, file/image workflows, and Project context.

## Comparison

| Approach | What works | What gets awkward |
| --- | --- | --- |
| Manual copy-paste | Fast for tiny questions | Easy to omit diffs, tests, screenshots, file context, or the exact task goal |
| OpenAI API | Good for programmable workflows | Does not naturally use your visible ChatGPT Project, Canvas, uploaded files, image generation, or web-native session |
| Browser RPA | Can imitate clicks | Fragile, high-maintenance, and not aligned with this project's safety boundary |
| `chatgpt-native-bridge` | Creates a consistent handoff, keeps the user in control, imports the answer for Codex | Still requires the user to operate ChatGPT and decide what to upload |

## Product principle

This project intentionally avoids hidden endpoints and scraping. The visible ChatGPT session is a feature: the user can inspect what is being sent, decide whether to upload attachments, use native ChatGPT tools, and bring back only the final answer.
