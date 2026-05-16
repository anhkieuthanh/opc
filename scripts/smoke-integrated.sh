#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAPERCLIP_PKG="$ROOT_DIR/paperclip/package.json"
NANOBOT_PYPROJECT="$ROOT_DIR/nanobot/pyproject.toml"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

printf 'Integrated workspace smoke check\n'
printf 'Root: %s\n\n' "$ROOT_DIR"

[[ -f "$PAPERCLIP_PKG" ]] || fail "Expected file not found: paperclip/package.json"
[[ -f "$NANOBOT_PYPROJECT" ]] || fail "Expected file not found: nanobot/pyproject.toml"

require_cmd node
require_cmd bash
require_cmd grep

printf 'Expected boot sequence:\n'
printf '1. Install Paperclip dependencies in paperclip/ with pnpm.\n'
printf '2. Install or sync Nanobot dependencies in nanobot/ with uv.\n'
printf '3. Start Paperclip from the root with: npm run dev:paperclip\n'
printf '4. Start Nanobot from the root with: npm run dev:nanobot\n'
printf '5. Implement the runtime bridge in a later phase; it is not wired here yet.\n\n'

printf 'Checking Paperclip package metadata...\n'
node - "$PAPERCLIP_PKG" <<'NODE'
const fs = require('fs');
const pkgPath = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const required = ['dev', 'dev:server', 'dev:ui'];
const missing = required.filter((name) => !pkg.scripts || !pkg.scripts[name]);
if (missing.length) {
  console.error(`ERROR: paperclip/package.json is missing scripts: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`paperclip scripts present: ${required.join(', ')}`);
NODE

printf '\nChecking Nanobot project metadata...\n'
grep -q '^\[project\]' "$NANOBOT_PYPROJECT" || fail "nanobot/pyproject.toml is missing a [project] table"
grep -q '^name = "nanobot-ai"' "$NANOBOT_PYPROJECT" || fail "nanobot/pyproject.toml is missing the expected project name"
grep -q '^requires-python = ">=3.11"' "$NANOBOT_PYPROJECT" || fail "nanobot/pyproject.toml is missing the expected Python requirement"
printf 'nanobot metadata present: [project], name, requires-python\n'

printf '\nSmoke check passed.\n'
