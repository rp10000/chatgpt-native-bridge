# Image direction

This example shows how to ask ChatGPT for visual direction, image prompts, and placement guidance.

## Problem

The product hero needs a visual asset, but Codex should not invent a random illustration without product direction.

## Why use ChatGPT web?

ChatGPT can combine visual reasoning, image generation, screenshot analysis, and copy context in one visible session. Codex can then implement the selected direction locally.

## Command

```bash
cgn ask \
  --task "Suggest visual direction for the product hero" \
  --type image-direction \
  --include-screenshots "screenshots/*.png"

cgn open latest
```

## Generated files

```text
.chatgpt-native/outbox/{id}/
  ask.md
  context.md
  screenshots/
```

See:

- [sample-ask.md](sample-ask.md)
- [sample-context.md](sample-context.md)
- [sample-reply.md](sample-reply.md)
- [codex-next-actions.md](codex-next-actions.md)

## In ChatGPT

1. Paste `ask.md`.
2. Upload current screenshots if available.
3. Ask for 2-4 visual directions, image prompts, placement suggestions, and a final recommendation.

## Codex follow-up

Codex should implement the selected direction, not every option. It should verify responsive crop and text contrast after placing the image.
