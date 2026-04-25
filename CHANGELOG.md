# Changelog

## 0.1.0 - 2026-04-25

### Added

- Initial `ccr` CLI for checking whether selected Codex CLI platform packages are published.
- Interactive first-run setup with saved config under `~/.config/ccr/config.json` or `$XDG_CONFIG_HOME/ccr/config.json`.
- Checks for the latest stable Codex CLI releases or one explicit version.
- Non-zero exit code when any selected platform package is missing.
- Test coverage for config handling, stable version parsing, CLI behavior, and package metadata.
