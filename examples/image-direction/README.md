# Image direction

```bash
cgn ask \
  --task "Suggest visual direction and image prompts for the product hero" \
  --type image-direction
```

Ask ChatGPT to use native image generation when useful, then import the final direction:

```bash
cgn import latest ./reply.md
```
