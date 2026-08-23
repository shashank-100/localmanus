#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
AUTH_FILE="${PI_AUTH_FILE:-$HOME/.pi/agent/auth.json}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to read $AUTH_FILE" >&2
  exit 1
fi

if [ ! -f "$AUTH_FILE" ]; then
  echo "Pi auth file not found: $AUTH_FILE" >&2
  exit 1
fi

DEEPSEEK_API_KEY=$(jq -er '.deepseek.key' "$AUTH_FILE")
export DEEPSEEK_API_KEY
export REASONING_API_KEY="$DEEPSEEK_API_KEY"
export REASONING_BASE_URL="https://api.deepseek.com"
export REASONING_MODEL="deepseek-reasoner"
export BASIC_API_KEY="$DEEPSEEK_API_KEY"
export BASIC_BASE_URL="https://api.deepseek.com"
export BASIC_MODEL="deepseek-chat"
export VL_API_KEY="$DEEPSEEK_API_KEY"
export VL_BASE_URL="https://api.deepseek.com"
export VL_MODEL="deepseek-chat"

cd "$PROJECT_DIR"
exec uv run python server.py
