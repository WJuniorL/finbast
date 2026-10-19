import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { databaseClient } from "./db-client.mjs";

const client = databaseClient();
let checks = 0;
let context = "schema";
async function asUser(id) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
  await client.query("set local role authenticated");
}
function equal(actual, expected) { assert.deepEqual(actual,expected,context); checks++; }
async function denied(sql,args=[],codes=["42501"]) {
  await client.query("savepoint expected_denial");
  let code;
  try { await client.query(sql,args); } catch(error) { code = error.code; }
  await client.query("rollback to savepoint expected_denial");
  assert.ok(codes.includes(code),`${context}: operação deveria ser recusada (${code ?? 'aceita'}).`); checks++;
}
const tables = ["categorias","centros_custo","clientes","fornecedores"];
function insert(table) { return table === "categorias"
  ? "insert into public.categorias (empresa_id,nome,tipo) values ($1,$2,'despesa') returning id"
  : `insert into public.${table} (empresa_id,nome) values ($1,$2) returning id`; }

try {
  await client.connect();
  await client.query("begin");
  for (const [table,file] of [["empresas","20261013135519_auth_empresas.sql"],["categorias","20261013144244_cadastros_base.sql"]]) {
    const { rows } = await client.query("select to_regclass($1) as name",[`public.${table}`]);
    if (!rows[0].name) await client.query(readFileSync(`supabase/migrations/${file}`,"utf8"));
  }
  const ownerA = randomUUID(), ownerB = randomUUID(), outsider = randomUUID();
  const members = Object.fromEntries(["administrador","operador","leitura","contador_completo","contador_leitura"].map((role)=>[role,randomUUID()]));
  for (const id of [ownerA,ownerB,outsider,...Object.values(members)]) await client.query("insert into auth.users (id,email) values ($1,$2)",[id,`${id}@test.invalid`]);
  await asUser(ownerA);
  const empresaA = (await client.query("select public.criar_empresa('Cadastros A','CPF','52998224725') as id")).rows[0].id;
  for (const [role,id] of Object.entries(members)) await client.query("insert into public.usuarios_empresas (empresa_id,usuario_id,papel) values ($1,$2,$3)",[empresaA,id,role]);
  const recordsA = {};
  for (const table of tables) recordsA[table] = (await client.query(insert(table),[empresaA,`Cadastro A ${table}`])).rows[0].id;
  await asUser(ownerB);
  const empresaB = (await client.query("select public.criar_empresa('Cadastros B','CPF','52998224725') as id")).rows[0].id;
  const recordsB = {};
  for (const table of tables) recordsB[table] = (await client.query(insert(table),[empresaB,`Cadastro A ${table}`])).rows[0].id;
  for (const [role,id] of [["proprietario",ownerA],...Object.entries(members),["sem_vinculo",outsider]]) {
    await asUser(id);
    const write = ["proprietario","administrador","operador","contador_completo"].includes(role);
    for (const table of tables) {
      context = `${role}/${table}`;
      equal((await client.query(`select id from public.${table} where id=$1`,[recordsA[table]])).rows.length,role === "sem_vinculo" ? 0 : 1);
      equal((await client.query(`select id from public.${table} where id=$1`,[recordsB[table]])).rows.length,0);
      equal((await client.query(`update public.${table} set nome=$1 where id=$2`,[`${role} ${table}`,recordsA[table]])).rowCount,write ? 1 : 0);
      equal((await client.query(`update public.${table} set ativo=false where id=$1`,[recordsA[table]])).rowCount,write ? 1 : 0);
      equal((await client.query(`update public.${table} set ativo=true where id=$1`,[recordsA[table]])).rowCount,write ? 1 : 0);
      if (write) equal((await client.query(insert(table),[empresaA,`Novo ${role} ${table}`])).rowCount,1);
      else await denied(insert(table),[empresaA,`Negado ${role} ${table}`]);
      await denied(insert(table),[empresaB,`Intrusão ${role} ${table}`]);
      await denied(`update public.${table} set empresa_id=$1 where id=$2`,[empresaB,recordsA[table]]);
      await denied(`delete from public.${table} where id=$1`,[recordsA[table]]);
    }
  }
  await asUser(ownerA);
  context = "hierarquia e custo fixo";
  const parent = (await client.query("insert into public.categorias (empresa_id,nome,tipo,custo_fixo) values ($1,'Pai','despesa',true) returning id",[empresaA])).rows[0].id;
  const sub = (await client.query("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Sub','despesa',$2) returning id",[empresaA,parent])).rows[0].id;
  await denied("update public.categorias set ativo=false where id=$1",[parent],["23514"]);
  await denied("update public.categorias set tipo='receita',custo_fixo=false where id=$1",[parent],["23514"]);
  await denied("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Nível 3','despesa',$2)",[empresaA,sub],["23514"]);
  await denied("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Cruzada','despesa',$2)",[empresaA,recordsB.categorias],["23514","23503"]);
  await denied("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Receita','receita',$2)",[empresaA,parent],["23514"]);
  await denied("insert into public.categorias (empresa_id,nome,tipo,custo_fixo) values ($1,'Receita fixa','receita',true)",[empresaA],["23514"]);
  await denied("insert into public.categorias (empresa_id,nome,tipo) values ($1,'  PAI  ','despesa')",[empresaA],["23505"]);
  await client.query("update public.categorias set ativo=false where id=$1",[sub]);
  await client.query("update public.categorias set ativo=false where id=$1",[parent]);
  await denied("update public.categorias set ativo=true where id=$1",[sub],["23514"]);
  await client.query("update public.categorias set ativo=true where id=$1",[parent]);
  equal((await client.query("update public.categorias set ativo=true where id=$1",[sub])).rowCount,1);
  for (const table of ["clientes","fornecedores"]) {
    context = `documento/${table}`;
    await client.query(`update public.${table} set documento='52998224725' where id=$1`,[recordsA[table]]);
    await denied(`insert into public.${table} (empresa_id,nome,documento) values ($1,'Duplicado','52998224725')`,[empresaA],["23505"]);
    await denied(`update public.${table} set documento='abc' where id=$1`,[recordsA[table]],["23514"]);
    await denied(`update public.${table} set atualizado_em=now() where id=$1`,[recordsA[table]]);
  }
  context = "revogação de escrita sem renovar token";
  await client.query("update public.usuarios_empresas set papel='leitura' where empresa_id=$1 and usuario_id=$2",[empresaA,members.operador]);
  await asUser(members.operador);
  equal((await client.query("update public.centros_custo set nome='Revogado' where id=$1",[recordsA.centros_custo])).rowCount,0);
  await client.query("reset role");
  await client.query("set local role anon");
  for (const table of tables) {
    context = `anon/${table}`;
    await denied(`select id from public.${table}`);
    await denied(insert(table),[empresaA,"Anônimo"]);
    await denied(`update public.${table} set nome='Anônimo' where id=$1`,[recordsA[table]]);
    await denied(`delete from public.${table} where id=$1`,[recordsA[table]]);
  }
  await client.query("reset role");
  equal((await client.query("select count(*)::int as n from pg_tables where schemaname='public' and tablename=any($1::text[]) and rowsecurity",[tables])).rows[0].n,4);
  console.log(`${checks} verificações de cadastros, RLS, papéis e hierarquia passaram. Fixtures revertidas.`);
} catch(error) {
  console.error("Falha na validação dos cadastros:", context, error.code ?? error.name, error instanceof assert.AssertionError ? error.message : "");
  process.exitCode = 1;
} finally { await client.query("rollback").catch(()=>{}); await client.end(); }
