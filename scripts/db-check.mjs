import { databaseClient } from "./db-client.mjs";
let client;
try {
  client = databaseClient();
  await client.connect();
  const { rows } = await client.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename");
  const migrations = await client.query("select version,name from supabase_migrations.schema_migrations order by version");
  console.log(JSON.stringify({ project: "ilgfcujtprcrugrnrsdh", tables: rows, migrations: migrations.rows }));
} catch (error) {
  console.error("Falha na verificação do banco:", error.code ?? error.name);
  process.exitCode = 1;
} finally { await client?.end(); }
