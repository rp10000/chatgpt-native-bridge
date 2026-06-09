# Basic handoff

```bash
cgn init
cgn ask --task "Plan the first MVP implementation" --type plan,requirements
cgn open latest
```

After ChatGPT replies, save the response:

```bash
cgn import latest ./reply.md
cgn status
```
