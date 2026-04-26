# codex-npm-check

[![CI](https://github.com/FelixWardUS/codex-npm-check/actions/workflows/ci.yml/badge.svg)](https://github.com/FelixWardUS/codex-npm-check/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/codex-npm-check.svg)](https://www.npmjs.com/package/codex-npm-check)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

Avoid broken Codex CLI upgrades by checking whether `@openai/codex` and the
platform packages you need are published to npm before you install.

`cnc` is a small terminal tool for developers who install Codex CLI across
Linux, macOS, or Windows machines and want a quick release readiness check.

## Quick Start

```bash
npm install -g codex-npm-check
cnc
```

On first run, `cnc` asks which platforms you care about and how many latest
stable Codex CLI versions to inspect. It saves that config for future checks.

## Why

Codex CLI ships through npm as `@openai/codex` plus platform-specific package
variants. A release can be visible before every platform package you need is
available. `cnc` catches that gap before the upgrade lands on your machine or
in your CI job.

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

### Commands

- `cnc` runs checks using the saved platform list and latest-version count.
- `cnc 0.124.0` checks one specific Codex version with the saved platform list.
- `cnc --platform linux-x64,darwin-arm64` overrides the saved platform list for one run.
- `cnc --latest 3` overrides how many latest stable versions to inspect for one run.
- `cnc --json` prints machine-readable results for scripts and CI.
- `cnc --set` re-runs setup and overwrites the saved config.
- `cnc --show` prints the current config.
- `cnc --reset` deletes the current config.

By default, `cnc` checks both your local npm registry configuration and the
official npm registry. If your local npm registry is already
`https://registry.npmjs.org/`, it checks that source only once. If any selected
package metadata or package tarball is unavailable in any checked registry for
any checked version, `cnc` exits with a non-zero status code.
When checking latest releases, stable version lists are merged from both
registries before the latest count is applied.

## Example Output

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

JSON mode:

```json
{
  "ok": false,
  "versions": [
    {
      "version": "0.124.0",
      "mainExists": true,
      "mainPackageStatus": {
        "metadataExists": true,
        "tarballUrl": "https://registry.npmmirror.com/@openai/codex/-/codex-0.124.0.tgz",
        "tarballAvailable": true,
        "ok": true,
        "reason": null,
        "registries": {
          "configured": {
            "metadataExists": true,
            "tarballUrl": "https://registry.npmmirror.com/@openai/codex/-/codex-0.124.0.tgz",
            "tarballAvailable": true,
            "ok": true,
            "reason": null
          },
          "official": {
            "metadataExists": true,
            "tarballUrl": "https://registry.npmjs.org/@openai/codex/-/codex-0.124.0.tgz",
            "tarballAvailable": true,
            "ok": true,
            "reason": null
          }
        }
      },
      "platformStatuses": {
        "linux-x64": {
          "metadataExists": true,
          "tarballUrl": null,
          "tarballAvailable": false,
          "ok": false,
          "reason": "registry issues found",
          "registries": {
            "configured": {
              "metadataExists": true,
              "tarballUrl": "https://registry.npmmirror.com/@openai/codex/-/codex-0.124.0-linux-x64.tgz",
              "tarballAvailable": true,
              "ok": true,
              "reason": null
            },
            "official": {
              "metadataExists": true,
              "tarballUrl": "https://registry.npmjs.org/@openai/codex/-/codex-0.124.0-linux-x64.tgz",
              "tarballAvailable": false,
              "ok": false,
              "reason": "tarball unavailable"
            }
          }
        },
        "darwin-arm64": {
          "metadataExists": true,
          "tarballUrl": "https://registry.npmmirror.com/@openai/codex/-/codex-0.124.0-darwin-arm64.tgz",
          "tarballAvailable": true,
          "ok": true,
          "reason": null,
          "registries": {
            "configured": {
              "metadataExists": true,
              "tarballUrl": "https://registry.npmmirror.com/@openai/codex/-/codex-0.124.0-darwin-arm64.tgz",
              "tarballAvailable": true,
              "ok": true,
              "reason": null
            },
            "official": {
              "metadataExists": true,
              "tarballUrl": "https://registry.npmjs.org/@openai/codex/-/codex-0.124.0-darwin-arm64.tgz",
              "tarballAvailable": true,
              "ok": true,
              "reason": null
            }
          }
        }
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
      - uses: FelixWardUS/codex-npm-check@v0.2.0
        with:
          platforms: linux-x64,darwin-arm64,win32-x64
          latest: 3
```

## Configuration

The saved config contains:

- The platform list to check.
- How many latest stable Codex CLI versions to inspect.

Config is stored under `~/.config/codex-npm-check/config.json` or
`$XDG_CONFIG_HOME/codex-npm-check/config.json`. Tests can override this with
`CNC_CONFIG_HOME`.

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
git clone https://github.com/FelixWardUS/codex-npm-check.git
cd codex-npm-check
npm test
npm install -g .
```

## FAQ

### Does this install Codex CLI?

No. It reads npm package metadata with `npm view` and verifies package tarball
availability, but it does not link or install Codex CLI.

### Does it require a GitHub token or npm token?

No. Normal use only needs access to your local npm registry configuration and
the public npm registry.

### Why not just install the latest Codex CLI?

That is fine for many cases. `cnc` is for teams and scripts that want to know
whether the platform package they need exists before upgrading.

## Support

If this saved you from a broken Codex CLI install, consider starring the repo.
Issues and pull requests are welcome.
