# codex-npm-check

[![CI](https://github.com/FelixWardUS/codex-npm-check/actions/workflows/ci.yml/badge.svg)](https://github.com/FelixWardUS/codex-npm-check/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/codex-npm-check.svg)](https://www.npmjs.com/package/codex-npm-check)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

Check whether a Codex CLI npm release is actually ready before you install or
upgrade it.

`cnc` verifies the main `@openai/codex` package and the platform builds you care
about. It checks both npm metadata and the real tarball URLs, using your
configured npm registry plus the official npm registry.

## Install

```bash
npm install -g codex-npm-check
cnc
```

On first run, `cnc` asks which platforms to check and how many latest stable
Codex versions to inspect.

## Usage

```bash
cnc
cnc 0.124.0
cnc --platform linux-x64,darwin-arm64 --latest 3
cnc 0.124.0 --platform win32-x64 --json
cnc --set
cnc --show
cnc --reset
```

- `cnc` checks the latest stable releases with your saved config.
- `cnc 0.124.0` checks one specific Codex version.
- `--platform` overrides platforms for one run.
- `--latest` overrides how many latest stable versions to check.
- `--json` prints machine-readable output.
- `--set`, `--show`, and `--reset` manage saved config.

## Output

```text
Checking latest 3 stable releases...

0.124.0: issues found ❌
  main package: OK ✅
  linux-x64: issues found ❌
    configured: OK ✅
    official: tarball unavailable ❌
  darwin-arm64: OK ✅

0.123.0: OK ✅
  main package: OK ✅
  linux-x64: OK ✅
  darwin-arm64: OK ✅
```

If any selected package is missing metadata or has an unavailable tarball in any
checked registry, `cnc` exits non-zero.

## What It Catches

`cnc` catches npm publishing and registry problems, including:

- Missing `@openai/codex` release metadata.
- Missing platform build metadata, such as `@openai/codex@0.124.0-win32-x64`.
- Tarball URLs that exist in metadata but return an error.
- Mirror registry drift from the official npm registry.

It does not run Codex after install, so it will not catch runtime bugs, macOS
signing problems, config regressions, or local npm optional dependency bugs when
the packages and tarballs are already available.

## Platforms

- `linux-x64`
- `linux-arm64`
- `darwin-x64`
- `darwin-arm64`
- `win32-x64`
- `win32-arm64`

## Config

Config is stored at:

- `~/.config/codex-npm-check/config.json`
- `$XDG_CONFIG_HOME/codex-npm-check/config.json`

Tests and scripts can override the config base directory with `CNC_CONFIG_HOME`.

## Development

```bash
git clone https://github.com/FelixWardUS/codex-npm-check.git
cd codex-npm-check
npm test
npm install -g .
```

Requires Node.js 20+ and `npm` in `PATH`.
