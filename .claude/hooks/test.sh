#!/usr/bin/env bash
# Stop — roda os testes quando o Claude termina de responder. É o único hook dos três que
# entende regra de negócio; os outros dois só olham a forma (tipo e build).
set -u

input="$(cat)"

# Trava contra loop infinito: se este Stop já foi disparado por um Stop anterior (porque o
# hook pediu retry), não dispara de novo.
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

# Sem script de teste declarado ainda (projeto sem framework de teste configurado) — convive
# em silêncio em vez de falhar com "missing script: test".
has_test="$(node -e '
try { const p = require(process.argv[1]); process.stdout.write(p.scripts && p.scripts.test ? "yes" : "no"); }
catch { process.stdout.write("no"); }
' "$root/package.json")"
if [ "$has_test" != "yes" ]; then exit 0; fi

cd "$root" || exit 0
output="$(npm test 2>&1)"
status=$?

if [ "$status" -ne 0 ]; then
  echo "Testes falharam:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
