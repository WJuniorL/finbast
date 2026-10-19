import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { databaseUrl } from "./db-client.mjs";

try {
  const output = execFileSync(process.execPath, [resolve("node_modules/supabase/dist/supabase.js"), "db", "advisors", "--db-url", databaseUrl(), "--type", "security", "--level", "warn", "--fail-on", "error"], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
  console.log(output.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[conexão omitida]").trim() || "Auditoria de segurança do banco sem alertas.");
} catch (error) {
  console.error("Falha na auditoria do banco:", error.code ?? error.status ?? error.name);
  process.exitCode = 1;
}
