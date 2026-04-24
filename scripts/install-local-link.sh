#!/usr/bin/env bash

set -euo pipefail

mkdir -p "${HOME}/.local/bin"
ln -sfn "$(pwd)/bin/ccr.js" "${HOME}/.local/bin/ccr"
printf 'Linked ccr to %s\n' "${HOME}/.local/bin/ccr"
