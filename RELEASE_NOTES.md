# v0.1.1

Patch release for `check-codex-release`.

`ccr` still checks whether `@openai/codex` and the platform-specific package variants for the platforms you care about have been published to npm. This release fixes npm query error handling and tightens installation documentation.

Highlights:

- Treat only npm `E404` responses as missing packages.
- Surface network, registry, or npm execution failures as `npm view failed...` errors instead of false missing-platform results.
- Document Node.js 20 setup in the GitHub Actions example.
- Clarify pinned npm install and source install options.

Install from npm:

```bash
npm install -g check-codex-release@0.1.1
ccr
```

Source install options:

```bash
npm install -g https://github.com/FelixWardUS/check-codex-release/archive/refs/tags/v0.1.1.tar.gz
ccr
```

Or download `Source code` from this release, then run:

```bash
cd check-codex-release-0.1.1
npm install -g .
ccr
```
