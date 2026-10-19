import { readFileSync } from "node:fs";
import pg from "pg";

export function databaseUrl() {
  // Preserva caracteres especiais em senhas de URLs ainda não escapadas no .env.
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((line) => /^SUPABASE_DB_URL=/.test(line));
  const raw = (line?.slice(line.indexOf("=") + 1) ?? process.env.SUPABASE_DB_URL ?? "").trim().replace(/^(['"])(.*)\1$/, "$2");
  const match = /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^/?#]+)(\/[^?#]*)?(\?.*)?$/.exec(raw);
  if (!match) throw new Error("Configuração de conexão Postgres inválida.");
  let password = match[2];
  try { password = decodeURIComponent(password); } catch { /* Senha ainda não escapada. */ }
  const url = new URL(`postgresql://${match[1]}:${encodeURIComponent(password)}@${match[3]}${match[4] ?? "/postgres"}${match[5] ?? ""}`);
  const expected = "ilgfcujtprcrugrnrsdh";
  if (!url.hostname.includes(expected) && !decodeURIComponent(url.username).includes(expected)) throw new Error("Projeto de banco diferente do Finbast.");
  return url.toString();
}
export function databaseClient() { return new pg.Client({ connectionString: databaseUrl(), connectionTimeoutMillis: 10000 }); }
