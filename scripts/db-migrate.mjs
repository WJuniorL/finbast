import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { databaseUrl } from "./db-client.mjs";

const dryRun = process.argv.includes("--dry-run");
try {
  const cli = resolve("node_modules/supabase/dist/supabase.js");
  const output = execFileSync(process.execPath, [cli, "db", "push", "--db-url", databaseUrl(), "--yes", "--skip-vault", ...(dryRun ? ["--dry-run"] : [])], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
  // Não encaminha detalhes de conexão nem credenciais retornados por ferramentas.
  console.log(dryRun ? "Dry-run da migration concluído." : "Migrations aplicadas e registradas pela CLI Supabase.");
  const applied = output.match(/Applying migration [\w.]+/g);
  if (applied) console.log(applied.join("\n"));
} catch (error) {
  console.error("Falha ao executar a CLI de migrations:", error.code ?? error.status ?? error.name);
  process.exitCode = 1;
}
