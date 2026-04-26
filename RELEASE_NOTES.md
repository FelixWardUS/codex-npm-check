# v0.2.0

Feature release for `codex-npm-check`.

`codex-npm-check` renames the package and command surface to match the tool's scope: pre-install npm package checks for Codex CLI. The CLI is now `cnc`.

`cnc` checks `@openai/codex` release metadata and package tarballs against both your local npm registry configuration and the official npm registry. Normal OK output stays compact; if a registry has a problem, the failing registry is expanded with a ❌ and the healthy registry is shown with a ✅.

Highlights:

- Check configured npm registry and `https://registry.npmjs.org/` by default.
- Rename the npm package to `codex-npm-check` and the CLI command to `cnc`.
- Avoid duplicate checks when the configured npm registry is already the official registry.
- Merge stable version lists from both registries before applying the latest-version count.
- Keep successful text output concise while expanding registry-level details only when something fails.
- Include per-registry status details under `registries` in JSON output.

Install from npm:

```bash
npm install -g codex-npm-check@0.2.0
cnc
```

Source install options:

```bash
npm install -g https://github.com/FelixWardUS/codex-npm-check/archive/refs/tags/v0.2.0.tar.gz
cnc
```

Or download `Source code` from this release, then run:

```bash
cd codex-npm-check-0.2.0
npm install -g .
cnc
```
