import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const setup=databaseClient(),first=databaseClient(),second=databaseClient();
const user=randomUUID();let empresa,userCreated=false,checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function begin(client){await client.query("begin");await client.query("set local statement_timeout='10s'");await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);await client.query("set local role authenticated");}
async function rpc(client,name,args){return(await client.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args)).rows[0].result;}
async function waiting(pid){for(let i=0;i<20;i++){if((await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0]?.wait_event_type==="Lock"){checks++;return;}await setup.query("select pg_sleep(0.1)");}throw new Error("Operação concorrente não aguardou o lock esperado.");}
try{
  await Promise.all([setup.connect(),first.connect(),second.connect()]);
  await setup.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,`${user}@test.invalid`]);userCreated=true;
  await begin(setup);
  empresa=(await setup.query("select public.criar_empresa('Concorrência Receber','CPF','52998224725') as id")).rows[0].id;
  const cat=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Serviços','receita') returning id",[empresa])).rows[0].id;
  const supplier=(await setup.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente') returning id",[empresa])).rows[0].id;
  await setup.query("commit");await setup.query("reset role");
  const secondPid=(await second.query("select pg_backend_pid() as pid")).rows[0].pid;
  const data={descricao:"Compra concorrente",documento:null,cliente_id:supplier,categoria_id:cat,centro_custo_id:null,valor_centavos:10000,vencimento:"2026-01-31",modo:"unica",parcelas:1};
  const request=randomUUID();
  await begin(first);const created=await rpc(first,"criar_receber",[empresa,request,data]);
  await begin(second);const duplicate=rpc(second,"criar_receber",[empresa,request,data]);await waiting(secondPid);
  await first.query("commit");equal((await duplicate).serie_id,created.serie_id);await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.lancamentos_receber where serie_id=$1",[created.serie_id])).rows[0].n,1);
  const item=(await setup.query("select id,atualizado_em::text as versao from public.lancamentos_receber where serie_id=$1",[created.serie_id])).rows[0];
  const payment={juros_centavos:0,multa_centavos:0,desconto_centavos:0,recebido_em:"2026-01-31"};
  await begin(first);equal((await rpc(first,"baixar_receber",[empresa,item.id,item.versao,payment])).codigo,"ok");
  await begin(second);const twice=rpc(second,"baixar_receber",[empresa,item.id,item.versao,payment]);await waiting(secondPid);
  await first.query("commit");equal((await twice).codigo,"estado_invalido");await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.baixas_receber where lancamento_id=$1",[item.id])).rows[0].n,1);
  await begin(first);const recurring=await rpc(first,"criar_receber",[empresa,randomUUID(),{...data,modo:"recorrente",vencimento:"2025-01-31"}]);await first.query("commit");
  await begin(first);const expanded=await rpc(first,"expandir_receber",[empresa]);assert.ok(expanded.gerados>0);checks++;
  await begin(second);const anotherExpansion=rpc(second,"expandir_receber",[empresa]);await waiting(secondPid);
  await first.query("commit");equal((await anotherExpansion).gerados,0);await second.query("commit");
  const unique=(await setup.query("select count(*)::int as n,count(distinct parcela)::int as u from public.lancamentos_receber where serie_id=$1",[recurring.serie_id])).rows[0];equal(unique.n,unique.u);
  const occurrence=(await setup.query("select id,atualizado_em::text as versao from public.lancamentos_receber where serie_id=$1 order by parcela limit 1",[recurring.serie_id])).rows[0];
  await begin(first);await rpc(first,"expandir_receber",[empresa]);
  await begin(second);const stop=rpc(second,"cancelar_receber",[empresa,occurrence.id,occurrence.versao,true]);await waiting(secondPid);
  await first.query("commit");equal((await stop).codigo,"ok");await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.lancamentos_receber where serie_id=$1 and status='aberto' and vencimento>timezone('America/Bahia',now())::date",[recurring.serie_id])).rows[0].n,0);
  // Arquivar antes da criacao: a criacao aguarda e recusa a referencia.
  await begin(first);await first.query("update public.clientes set ativo=false where id=$1",[supplier]);
  await begin(second);const archivedCreate=rpc(second,"criar_receber",[empresa,randomUUID(),data]);await waiting(secondPid);
  await first.query("commit");equal((await archivedCreate).codigo,"cadastro_invalido");await second.query("commit");
  await setup.query("update public.clientes set ativo=true where id=$1",[supplier]);
  // Criar antes de arquivar: a validacao segura a referencia ate o commit.
  await begin(first);equal((await rpc(first,"criar_receber",[empresa,randomUUID(),data])).codigo,"ok");
  await begin(second);const archive=second.query("update public.clientes set ativo=false where id=$1",[supplier]);await waiting(secondPid);
  await first.query("commit");equal((await archive).rowCount,1);await second.query("commit");
  console.log(`Contas a Receber: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(error){console.error("Falha na concorrência financeira:",error.code??error.name,error instanceof assert.AssertionError?error.message:"");process.exitCode=1;}
finally{
  await Promise.all([first.query("rollback").catch(()=>{}),second.query("rollback").catch(()=>{})]);await setup.query("rollback").catch(()=>{});await setup.query("reset role").catch(()=>{});
  try{if(empresa)await setup.query("delete from public.empresas where id=$1 and dono_id=$2",[empresa,user]);if(userCreated)await setup.query("delete from auth.users where id=$1",[user]);}finally{await Promise.all([setup.end(),first.end(),second.end()]);}
}
