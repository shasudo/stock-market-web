#!/usr/bin/env bash
# Local trigger: typecheck, test, push, then deploy a clean tree on rocket.
# Usage: bash scripts/deploy-to-rocket.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

REMOTE_HOST="${REMOTE_HOST:-rocket}"
# Relative to the remote $HOME (ssh starts there).
REMOTE_REPO_PATH="${REMOTE_REPO_PATH:-rocket/apps/stock-market-web}"

echo "==> [1/5] running typecheck"
./node_modules/.bin/tsc --noEmit

echo "==> [2/5] running tests"
npm test

echo "==> [3/5] refusing a dirty tree (commit first)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty; commit or stash before deploying." >&2
  exit 1
fi

echo "==> [4/5] pushing"
git push origin HEAD:main

echo "==> [5/5] syncing $REMOTE_HOST:$REMOTE_REPO_PATH and deploying"
git archive HEAD | ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_REPO_PATH' && tar -x -C '$REMOTE_REPO_PATH' && cd '$REMOTE_REPO_PATH' && bash scripts/deploy.sh"
