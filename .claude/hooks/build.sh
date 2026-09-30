#!/usr/bin/env bash
# Stop — build de produção. Pega o que só aparece na montagem: import quebrado, rota
# inexistente, página que não compila em modo estrito.
set -u

input="$(cat)"

already_active="$(node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try { process.stdout.write(String(!!JSON.parse(d).stop_hook_active)); }
  catch { process.stdout.write("false"); }
});
' <<< "$input")"
if [ "$already_active" = "true" ]; then exit 0; fi

dir="$(cd "$(dirname "$0")" && pwd)"
root=""
while [ "$dir" != "/" ]; do
  if [ -f "$dir/package.json" ]; then root="$dir"; break; fi
  dir="$(dirname "$dir")"
done
if [ -z "$root" ]; then exit 0; fi

has_build="$(node -e '
try { const p = require(process.argv[1]); process.stdout.write(p.scripts && p.scripts.build ? "yes" : "no"); }
catch { process.stdout.write("no"); }
' "$root/package.json")"
if [ "$has_build" != "yes" ]; then exit 0; fi

cd "$root" || exit 0
output="$(npm run build 2>&1)"
status=$?

if [ "$status" -ne 0 ]; then
  echo "Build falhou:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
