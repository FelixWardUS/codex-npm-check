# v0.1.2

Feature release for `check-codex-release`.

`ccr` now checks `@openai/codex` release metadata and package tarballs against both your local npm registry configuration and the official npm registry. Normal OK output stays compact; if a registry has a problem, the failing registry is expanded with a ❌ and the healthy registry is shown with a ✅.

Highlights:

- Check configured npm registry and `https://registry.npmjs.org/` by default.
- Avoid duplicate checks when the configured npm registry is already the official registry.
- Merge stable version lists from both registries before applying the latest-version count.
- Keep successful text output concise while expanding registry-level details only when something fails.
- Include per-registry status details under `registries` in JSON output.

Install from npm:

```bash
npm install -g check-codex-release@0.1.2
ccr
```

Source install options:

```bash
npm install -g https://github.com/FelixWardUS/check-codex-release/archive/refs/tags/v0.1.2.tar.gz
ccr
```

Or download `Source code` from this release, then run:

```bash
cd check-codex-release-0.1.2
npm install -g .
ccr
```
