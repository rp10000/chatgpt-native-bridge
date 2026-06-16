# Release Checklist

## v0.2.0

- [ ] `npm test`
- [ ] `npm run smoke`
- [ ] `node ./bin/cgn.js mcp config`
- [ ] `node ./bin/cgn.js mcp doctor`
- [ ] MCP HTTP server can initialize and list tools
- [ ] `npm pack --dry-run`
- [ ] GitHub Actions CI passing
- [ ] README MCP-first workflow verified
- [ ] README.zh-CN MCP-first workflow verified
- [ ] GitHub Release `v0.2.0 - MCP-first local bridge` created
- [ ] npm publish completed, if applicable

## v0.1.0

- [ ] `npm test`
- [ ] `npm run smoke`
- [ ] `npm pack --dry-run`
- [ ] GitHub Actions CI passing
- [ ] README install command verified
- [ ] README.zh-CN install command verified
- [ ] `cgn setup` verified in a clean temp repo
- [ ] `cgn handoff --dry-run` verified
- [ ] `cgn done` verified
- [ ] GitHub Release created
- [ ] npm publish completed, if applicable
