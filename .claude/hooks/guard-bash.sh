#!/usr/bin/env bash
# Exit code 2 blocks the command and shows the message to Claude.
cmd=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null)
block() { echo "Blocked by .claude/hooks/guard-bash.sh: $1" >&2; exit 2; }

force_push='git push[^|;&]*(--force|[[:space:]]-f([[:space:]]|$))'
push_to_main='git push[^|;&]*[[:space:]:+]main([[:space:]]|$)'
read_env='(cat|less|more|head|tail|source)([[:space:]][^|;&]*)?[[:space:]/]\.env(\.[a-z]+)?([[:space:]]|$)'

[[ $cmd =~ $force_push ]] && block "force pushes are not allowed; open a PR instead."
[[ $cmd =~ $push_to_main ]] && block "never push to main; push a branch and open a PR."
without_example=${cmd//.env.example/}
[[ $without_example =~ $read_env ]] && block "don't read env files; .env.example has the names."
case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*) block "destructive delete." ;;
  *printenv*|*"env | "*) block "don't print the environment; it may hold secrets." ;;
  *"--no-verify"*) block "don't skip git hooks; fix what they report." ;;
esac
exit 0
