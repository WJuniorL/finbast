#!/usr/bin/env bash
# PostToolUse (matcher Edit|Write) — typecheck rápido a cada arquivo salvo.
# Sai 2 em erro (Claude lê a saída e corrige); 0 em qualquer outro caso, sem barulho.
set -u

input="$(cat)"

# Caminho do arquivo editado, normalizado (Windows manda barra invertida — Git Bash não acha
# o arquivo sem isso).
file_path="$(node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    const p = (j.tool_input && j.tool_input.file_path) || "";
    process.stdout.write(p.replace(/\\\\/g, "/"));
  } catch { process.stdout.write(""); }
});
' <<< "$input")"

# Só nos importa TypeScript/TSX. Qualquer outra extensão, sai em silêncio.
case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Acha a raiz do projeto subindo a árvore até achar package.json — nunca caminho fixo.
dir="$(cd "$(dirname "$0")" && pwd)"
root=""
while [ "$dir" != "/" ]; do
  if [ -f "$dir/package.json" ]; then root="$dir"; break; fi
  dir="$(dirname "$dir")"
done

# Projeto ainda não existe (sem package.json) — convive em silêncio.
if [ -z "$root" ]; then exit 0; fi
if ! grep -q '"typescript"' "$root/package.json" 2>/dev/null; then exit 0; fi

cd "$root" || exit 0
output="$(npx tsc --noEmit 2>&1)"
status=$?

if [ "$status" -ne 0 ]; then
  echo "Typecheck falhou:" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
