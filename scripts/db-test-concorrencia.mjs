import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { databaseClient } from "./db-client.mjs";

const setup = databaseClient(), writer = databaseClient(), archiver = databaseClient();
const userId = randomUUID();
let empresaId;
let userCreated = false;
async function transaction(client) {
  await client.query("begin");
  await client.query("set local statement_timeout='5s'");
  await client.query("select set_config('request.jwt.claim.sub',$1,true)",[userId]);
  await client.query("set local role authenticated");
}
async function blocked(client) {
  const pid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
  return pid;
}
async function verifyWaiting(pid) {
  for (let attempt=0;attempt<10;attempt++) {
    const row = (await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0];
    if (row?.wait_event_type === "Lock") return;
    await setup.query("select pg_sleep(0.1)");
  }
  throw new assert.AssertionError({message:"A operação concorrente deveria aguardar o lock da categoria principal."});
}
try {
  await Promise.all([setup.connect(),writer.connect(),archiver.connect()]);
  await setup.query("insert into auth.users (id,email) values ($1,$2)",[userId,`${userId}@test.invalid`]);
  userCreated = true;
  await transaction(setup);
  empresaId = (await setup.query("select public.criar_empresa('Teste concorrência','CPF','52998224725') as id")).rows[0].id;
  const parent = (await setup.query("insert into public.categorias (empresa_id,nome,tipo) values ($1,'Principal','despesa') returning id",[empresaId])).rows[0].id;
  await setup.query("commit");
  await setup.query("reset role");
  const writerPid = await blocked(writer), archiverPid = await blocked(archiver);
  await transaction(writer);
  const child = (await writer.query("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Subcategoria','despesa',$2) returning id",[empresaId,parent])).rows[0].id;
  await transaction(archiver);
  const archiveAttempt = archiver.query("update public.categorias set ativo=false where id=$1",[parent]).then(()=>"aplicada",error=>error.code);
  await verifyWaiting(archiverPid);
  await writer.query("commit");
  assert.equal(await archiveAttempt,"23514","Arquivamento deve perceber a subcategoria recém-confirmada.");
  await archiver.query("rollback");

  await transaction(setup);
  await setup.query("update public.categorias set ativo=false where id=$1",[child]);
  await setup.query("commit");
  await setup.query("reset role");
  await transaction(archiver);
  await archiver.query("update public.categorias set ativo=false where id=$1",[parent]);
  await transaction(writer);
  const createAttempt = writer.query("insert into public.categorias (empresa_id,nome,tipo,pai_id) values ($1,'Outra subcategoria','despesa',$2)",[empresaId,parent]).then(()=>"aplicada",error=>error.code);
  await verifyWaiting(writerPid);
  await archiver.query("commit");
  assert.equal(await createAttempt,"23514","Inserção deve perceber que a principal foi arquivada.");
  await writer.query("rollback");
  const invalid = (await setup.query("select count(*)::int as n from public.categorias filho join public.categorias pai on pai.empresa_id=filho.empresa_id and pai.id=filho.pai_id where filho.empresa_id=$1 and filho.ativo and not pai.ativo",[empresaId])).rows[0].n;
  assert.equal(invalid,0);
  console.log("5 verificações de concorrência passaram nas duas ordens de criação/arquivamento. Fixtures removidas.");
} catch(error) {
  console.error("Falha no teste de concorrência:",error.code ?? error.name,error instanceof assert.AssertionError ? error.message : "");
  process.exitCode = 1;
} finally {
  await Promise.all([writer.query("rollback").catch(()=>{}),archiver.query("rollback").catch(()=>{})]);
  await setup.query("rollback").catch(()=>{});
  await setup.query("reset role").catch(()=>{});
  try {
    if (empresaId) await setup.query("delete from public.empresas where id=$1 and dono_id=$2",[empresaId,userId]);
    if (userCreated) await setup.query("delete from auth.users where id=$1",[userId]);
  } finally { await Promise.all([setup.end(),writer.end(),archiver.end()]); }
}
