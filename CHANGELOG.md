# Changelog

## 0.2.0 - 2026-04-26

### Changed

- Rename the npm package to `codex-npm-check`.
- Rename the CLI entrypoint to `cnc` and expose `codex-npm-check` as a long command alias.
- Store new configuration under `~/.config/codex-npm-check/config.json` or `$XDG_CONFIG_HOME/codex-npm-check/config.json`.

### Added

- Check both the configured npm registry and `https://registry.npmjs.org/` by default.
- Merge stable version lists from both registries before applying the latest-version count.
- Include per-registry status details under `registries` in JSON output.
