# Contributing

Thanks for helping improve `codex-npm-check`.

## Development

```bash
npm test
node bin/cnc.js --help
```

Use Node.js 20 or newer. The project uses the built-in `node:test` runner and
does not require third-party runtime dependencies.

## Pull Requests

- Keep changes focused on one behavior or documentation improvement.
- Add or update tests when CLI behavior changes.
- Run `npm test` before opening a pull request.
- Update `README.md` when user-facing commands or output change.

## Release Checklist

```bash
npm test
npm pack --dry-run
npm publish --registry=https://registry.npmjs.org/
git tag v0.2.0
git push origin main v0.2.0
gh release create v0.2.0 --notes-file RELEASE_NOTES.md
```
