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
  empresa=(await setup.query("select public.criar_empresa('Concorrência Pagar','CPF','52998224725') as id")).rows[0].id;
  const cat=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Serviços','despesa') returning id",[empresa])).rows[0].id;
  const supplier=(await setup.query("insert into public.fornecedores(empresa_id,nome) values($1,'Fornecedor') returning id",[empresa])).rows[0].id;
  equal((await rpc(setup,"configurar_aprovacao",["193750",false])).codigo,"ok");
  await setup.query("commit");await setup.query("reset role");
  const secondPid=(await second.query("select pg_backend_pid() as pid")).rows[0].pid;
  const data={descricao:"Compra concorrente",documento:null,fornecedor_id:supplier,categoria_id:cat,centro_custo_id:null,valor_centavos:10000,vencimento:"2026-01-31",modo:"unica",parcelas:1,custo_fixo_override:null};
  const request=randomUUID();
  await begin(first);const created=await rpc(first,"criar_pagar",[empresa,request,data]);
  await begin(second);const duplicate=rpc(second,"criar_pagar",[empresa,request,data]);await waiting(secondPid);
  await first.query("commit");equal((await duplicate).serie_id,created.serie_id);await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.lancamentos_pagar where serie_id=$1",[created.serie_id])).rows[0].n,1);
  const item=(await setup.query("select id,atualizado_em::text as versao from public.lancamentos_pagar where serie_id=$1",[created.serie_id])).rows[0];
  const payment={juros_centavos:0,multa_centavos:0,desconto_centavos:0,pago_em:"2026-01-31"};
  await begin(first);equal((await rpc(first,"baixar_pagar",[empresa,item.id,item.versao,"193750",payment])).codigo,"ok");
  await begin(second);const twice=rpc(second,"baixar_pagar",[empresa,item.id,item.versao,"193750",payment]);await waiting(secondPid);
  await first.query("commit");equal((await twice).codigo,"estado_invalido");await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.baixas_pagar where lancamento_id=$1",[item.id])).rows[0].n,1);
  await begin(first);const recurring=await rpc(first,"criar_pagar",[empresa,randomUUID(),{...data,modo:"recorrente",vencimento:"2025-01-31"}]);await first.query("commit");
  await begin(first);const expanded=await rpc(first,"expandir_pagar",[empresa]);assert.ok(expanded.gerados>0);checks++;
  await begin(second);const anotherExpansion=rpc(second,"expandir_pagar",[empresa]);await waiting(secondPid);
  await first.query("commit");equal((await anotherExpansion).gerados,0);await second.query("commit");
  const unique=(await setup.query("select count(*)::int as n,count(distinct parcela)::int as u from public.lancamentos_pagar where serie_id=$1",[recurring.serie_id])).rows[0];equal(unique.n,unique.u);
  const occurrence=(await setup.query("select id,atualizado_em::text as versao from public.lancamentos_pagar where serie_id=$1 order by parcela limit 1",[recurring.serie_id])).rows[0];
  await begin(first);await rpc(first,"expandir_pagar",[empresa]);
  await begin(second);const stop=rpc(second,"cancelar_pagar",[empresa,occurrence.id,occurrence.versao,true]);await waiting(secondPid);
  await first.query("commit");equal((await stop).codigo,"ok");await second.query("commit");
  equal((await setup.query("select count(*)::int as n from public.lancamentos_pagar where serie_id=$1 and status='aberto' and vencimento>timezone('America/Bahia',now())::date",[recurring.serie_id])).rows[0].n,0);
  console.log(`Contas a Pagar: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(error){console.error("Falha na concorrência financeira:",error.code??error.name,error instanceof assert.AssertionError?error.message:"");process.exitCode=1;}
finally{
  await Promise.all([first.query("rollback").catch(()=>{}),second.query("rollback").catch(()=>{})]);await setup.query("rollback").catch(()=>{});await setup.query("reset role").catch(()=>{});
  try{if(empresa)await setup.query("delete from public.empresas where id=$1 and dono_id=$2",[empresa,user]);if(userCreated)await setup.query("delete from auth.users where id=$1",[user]);}finally{await Promise.all([setup.end(),first.end(),second.end()]);}
}
