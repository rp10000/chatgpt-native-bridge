# Image direction tutorial

## Goal

Use ChatGPT's visual reasoning or image generation to choose a direction before Codex updates a page.

If MCP is available, let ChatGPT use the bridge tools directly. The command below is the Markdown fallback.

## Command

```bash
cgn handoff \
  --task "Suggest visual direction for the product hero" \
  --type image-direction \
  --include-screenshots "screenshots/*.png"
```

## Files generated

```text
.chatgpt-native/outbox/{id}/01_PASTE_TO_CHATGPT.md
.chatgpt-native/outbox/{id}/context.md
.chatgpt-native/outbox/{id}/screenshots/
```

## In ChatGPT

1. Paste `01_PASTE_TO_CHATGPT.md`.
2. Upload the screenshot if available.
3. Ask for 2-4 directions, prompts, placement guidance, and a recommendation.

## Example answer shape

```markdown
## Direction A
- Calm product workspace scene
- Prompt: ...
- Best placement: hero background

## Direction B
- Interface detail macro
- Prompt: ...
- Best placement: docs header

## Recommendation
Use Direction A for the first release.

## Codex next actions
- Generate or source a hero image.
- Keep the image behind the headline, not inside a card.
- Verify mobile crop.
```

## What Codex should do next

Codex should implement the selected visual direction, keep assets inspectable, and verify that responsive crops do not hide important content.
