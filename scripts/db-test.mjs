import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { databaseClient } from "./db-client.mjs";

const client = databaseClient();
let checks = 0;
async function asUser(id) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
  await client.query("set local role authenticated");
}
async function rows(sql, args = []) { return (await client.query(sql, args)).rows; }
async function deny(sql, args = []) {
  await client.query("savepoint expected_denial");
  let denied = false;
  try { await client.query(sql, args); }
  catch (error) { denied = error.code === "42501"; }
  await client.query("rollback to savepoint expected_denial");
  assert.ok(denied, "Operação deveria ser negada."); checks++;
}
function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }

try {
  await client.connect();
  await client.query("begin");
  const existing = await rows("select to_regclass('public.empresas') as table_name");
  if (!existing[0].table_name) await client.query(readFileSync("supabase/migrations/20261013135519_auth_empresas.sql", "utf8"));
  const [ownerA, ownerB, reader, outsider] = Array.from({ length: 4 }, () => randomUUID());
  for (const id of [ownerA, ownerB, reader, outsider]) {
    await client.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, `${id}@test.invalid`]);
  }
  await asUser(ownerA);
  const [{ id: empresaA }] = await rows("select public.criar_empresa('Empresa A', 'CNPJ', '11222333000181') as id");
  equal((await rows("select papel from public.usuarios_empresas where empresa_id = $1", [empresaA]))[0].papel, "proprietario");
  await asUser(ownerB);
  const [{ id: empresaB }] = await rows("select public.criar_empresa('Empresa B', 'CPF', '52998224725') as id");
  equal((await rows("select id from public.empresas")).length, 1);
  equal((await rows("select id from public.empresas where id = $1", [empresaA])).length, 0);
  await deny("insert into public.empresas (nome,tipo,documento,dono_id) values ('Intrusão','CPF','11111111111',$1)", [ownerA]);
  await deny("insert into public.usuarios_empresas values ($1,$2,'administrador',now())", [empresaA, ownerB]);
  await asUser(ownerA);
  await client.query("insert into public.usuarios_empresas (empresa_id,usuario_id,papel) values ($1,$2,'leitura')", [empresaA, reader]);
  equal((await rows("select usuario_id from public.usuarios_empresas where empresa_id = $1", [empresaA])).length, 2);
  equal((await client.query("update public.usuarios_empresas set papel = 'operador' where empresa_id = $1 and usuario_id = $2", [empresaA, reader])).rowCount, 1);
  equal((await client.query("update public.usuarios_empresas set papel = 'leitura' where usuario_id = $1", [ownerA])).rowCount, 0);
  equal((await client.query("delete from public.usuarios_empresas where usuario_id = $1", [ownerA])).rowCount, 0);
  await deny("update public.empresas set dono_id = $1 where id = $2", [reader, empresaA]);
  await deny("update public.usuarios_empresas set empresa_id = $1 where usuario_id = $2", [empresaB, reader]);
  await asUser(reader);
  equal((await rows("select id from public.empresas")).map((row) => row.id), [empresaA]);
  equal((await rows("select usuario_id from public.usuarios_empresas")).map((row) => row.usuario_id), [reader]);
  equal((await client.query("update public.empresas set nome = 'Ataque' where id = $1", [empresaA])).rowCount, 0);
  equal((await client.query("update public.usuarios_empresas set papel = 'administrador' where usuario_id = $1", [reader])).rowCount, 0);
  await deny("insert into public.usuarios_empresas (empresa_id,usuario_id,papel) values ($1,$2,'proprietario')", [empresaB, reader]);
  await deny("insert into public.usuarios_empresas (empresa_id,usuario_id,papel) values ($1,$2,'leitura')", [empresaA, outsider]);
  await asUser(outsider);
  equal((await rows("select id from public.empresas")).length, 0);
  await asUser(ownerA);
  const inviteHash = "a".repeat(64);
  await client.query("insert into public.convites_empresas (empresa_id,email,papel,token_hash) values ($1,$2,'leitura',$3)", [empresaA, `${outsider}@test.invalid`, inviteHash]);
  equal((await rows("select id from public.convites_empresas")).length, 1);
  await asUser(ownerB);
  equal((await rows("select id from public.convites_empresas")).length, 0);
  await deny("select public.aceitar_convite($1)", [inviteHash]);
  await asUser(reader);
  await deny("insert into public.convites_empresas (empresa_id,email,papel,token_hash) values ($1,'x@test.invalid','leitura',$2)", [empresaA, "b".repeat(64)]);
  await asUser(outsider);
  await deny("select public.aceitar_convite($1)", ["c".repeat(64)]);
  equal((await rows("select public.aceitar_convite($1) as id", [inviteHash]))[0].id, empresaA);
  equal((await rows("select papel from public.usuarios_empresas where empresa_id=$1 and usuario_id=$2", [empresaA, outsider]))[0].papel, "leitura");
  await deny("select public.aceitar_convite($1)", [inviteHash]);
  await asUser(ownerA);
  await client.query("insert into public.convites_empresas (empresa_id,email,papel,token_hash,criado_em,expira_em) values ($1,$2,'leitura',$3,now()-interval '8 days',now()-interval '1 day')", [empresaA, `${ownerB}@test.invalid`, "d".repeat(64)]);
  await asUser(ownerB);
  await deny("select public.aceitar_convite($1)", ["d".repeat(64)]);
  await client.query("reset role");
  await client.query("set local role anon");
  await deny("select id from public.empresas");
  await deny("select usuario_id from public.usuarios_empresas");
  await deny("select public.criar_empresa('Anon','CPF','52998224725')");
  await deny("select id from public.convites_empresas");
  await deny("select public.aceitar_convite($1)", [inviteHash]);
  await client.query("reset role");
  equal((await rows("select count(*)::int as count from pg_tables where schemaname='public' and tablename in ('empresas','usuarios_empresas','convites_empresas') and rowsecurity"))[0].count, 3);
  console.log(`${checks} verificações de RLS e permissões passaram. Fixtures e schema de teste revertidos.`);
} catch (error) {
  console.error("Falha na validação de RLS:", error.code ?? error.name, error instanceof assert.AssertionError ? error.message : "");
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
