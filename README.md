# check-codex-release

[![CI](https://github.com/FelixWardUS/check-codex-release/actions/workflows/ci.yml/badge.svg)](https://github.com/FelixWardUS/check-codex-release/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/check-codex-release.svg)](https://www.npmjs.com/package/check-codex-release)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

Avoid broken Codex CLI upgrades by checking whether `@openai/codex` and the
platform packages you need are published to npm before you install.

`ccr` is a small terminal tool for developers who install Codex CLI across
Linux, macOS, or Windows machines and want a quick release readiness check.

## Quick Start

```bash
npm install -g check-codex-release
ccr
```

On first run, `ccr` asks which platforms you care about and how many latest
stable Codex CLI versions to inspect. It saves that config for future checks.

## Why

Codex CLI ships through npm as `@openai/codex` plus platform-specific package
variants. A release can be visible before every platform package you need is
available. `ccr` catches that gap before the upgrade lands on your machine or
in your CI job.

## Usage

```bash
ccr
ccr 0.124.0
ccr --platform linux-x64,darwin-arm64 --latest 3
ccr 0.124.0 --platform win32-x64 --json
ccr --set
ccr --show
ccr --reset
```

### Commands

- `ccr` runs checks using the saved platform list and latest-version count.
- `ccr 0.124.0` checks one specific Codex version with the saved platform list.
- `ccr --platform linux-x64,darwin-arm64` overrides the saved platform list for one run.
- `ccr --latest 3` overrides how many latest stable versions to inspect for one run.
- `ccr --json` prints machine-readable results for scripts and CI.
- `ccr --set` re-runs setup and overwrites the saved config.
- `ccr --show` prints the current config.
- `ccr --reset` deletes the current config.

If any selected platform package is missing for any checked version, `ccr`
exits with a non-zero status code.

## Example Output

```text
Checking latest 3 stable releases...

0.124.0
  linux-x64: missing
  darwin-arm64: OK

0.123.0
  linux-x64: OK
  darwin-arm64: OK
```

JSON mode:

```json
{
  "ok": false,
  "versions": [
    {
      "version": "0.124.0",
      "mainExists": true,
      "platformStatuses": {
        "linux-x64": false,
        "darwin-arm64": true
      },
      "ok": false
    }
  ]
}
```

## GitHub Actions

Use the bundled action to fail CI when a Codex CLI release is incomplete for
your target platforms:

```yaml
name: Check Codex release

on:
  workflow_dispatch:
  schedule:
    - cron: "0 * * * *"

jobs:
  codex-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: FelixWardUS/check-codex-release@v0.1.1
        with:
          platforms: linux-x64,darwin-arm64,win32-x64
          latest: 3
```

## Configuration

The saved config contains:

- The platform list to check.
- How many latest stable Codex CLI versions to inspect.

Config is stored under `~/.config/ccr/config.json` or
`$XDG_CONFIG_HOME/ccr/config.json`. Tests can override this with
`CCR_CONFIG_HOME`.

Supported platforms:

- `linux-x64`
- `linux-arm64`
- `darwin-x64`
- `darwin-arm64`
- `win32-x64`
- `win32-arm64`

## Requirements

- Node.js `20+`
- `npm` available in `PATH`

## Local Development

```bash
git clone https://github.com/FelixWardUS/check-codex-release.git
cd check-codex-release
npm test
npm install -g .
```

## FAQ

### Does this install Codex CLI?

No. It only reads npm package metadata with `npm view`.

### Does it require a GitHub token or npm token?

No. Normal use only needs public npm registry access.

### Why not just install the latest Codex CLI?

That is fine for many cases. `ccr` is for teams and scripts that want to know
whether the platform package they need exists before upgrading.

## Support

If this saved you from a broken Codex CLI install, consider starring the repo.
Issues and pull requests are welcome.
