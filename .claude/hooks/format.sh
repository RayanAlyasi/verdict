#!/usr/bin/env bash
file=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)
[ -z "$file" ] || [ ! -f "$file" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.json|*.md)
    [ -d node_modules ] && pnpm exec prettier --write --log-level warn "$file" >/dev/null 2>&1 ;;
  *.py)
    # Format only: a lint fix would delete an import added for the next edit.
    command -v uv >/dev/null && uv run --project services/api ruff format -q "$file" >/dev/null 2>&1 ;;
esac
exit 0
