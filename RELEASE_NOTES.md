# v0.1.0

Initial release of `check-codex-release`.

`ccr` checks whether `@openai/codex` and the platform-specific package variants for the platforms you care about have been published to npm. It is useful before upgrading Codex CLI across Linux, macOS, or Windows machines.

Highlights:

- Interactive setup for target platforms and latest-version count.
- Saved local config for repeated checks.
- One-off checks for a specific Codex CLI version.
- Non-zero exit code when a configured platform package is missing.

Install from npm:

```bash
npm install -g check-codex-release@0.1.0
ccr
```

Source install options:

```bash
npm install -g https://github.com/FelixWardUS/check-codex-release/archive/refs/tags/v0.1.0.tar.gz
ccr
```

Or download `Source code` from this release, then run:

```bash
cd check-codex-release-0.1.0
npm install -g .
ccr
```
