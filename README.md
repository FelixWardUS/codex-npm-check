# check-codex-release

`ccr` is a terminal tool for checking whether recent Codex CLI releases have
been fully published for the target platforms you care about.

It stores a small local config with:

- The platform list to check
- How many latest stable Codex versions to inspect

## Features

- First-run setup in the terminal
- Saved configuration under `~/.config/ccr/config.json` or `$XDG_CONFIG_HOME/ccr/config.json`
- Multi-platform release checks
- Optional ad-hoc check for one specific version

## Requirements

- Node.js `20+`
- `npm` available in `PATH`

## Install

Clone the repository, then from the project root run:

```bash
npm test
npm install -g .
```

That installs the `ccr` command globally through npm.

If you specifically want a local symlink to this working tree instead, you can still use:

```bash
bash scripts/install-local-link.sh
```

## Usage

```bash
ccr
ccr 0.124.0
ccr --set
ccr --show
ccr --reset
```

### First run

On the first run, `ccr` asks for:

1. Which platforms to check
2. How many latest stable Codex versions to inspect

It saves that config and immediately runs the checks.

### Commands

- `ccr`
  Runs checks using the saved platform list and latest-version count.
- `ccr 0.124.0`
  Checks one specific Codex version with the saved platform list.
- `ccr --set`
  Re-runs setup and overwrites the saved config.
- `ccr --show`
  Prints the current config.
- `ccr --reset`
  Deletes the current config.

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

If any selected platform is missing for any checked version, `ccr` exits with a
non-zero status code.
