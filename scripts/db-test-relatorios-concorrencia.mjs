import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
import {fixtureRpc} from "./fluxo-fixture.mjs";
const setup=databaseClient(),a=databaseClient(),b=databaseClient(),owner=randomUUID();let empresa,checks=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++;};
async function begin(db){await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await db.query("set local role authenticated");return (await db.query("select pg_backend_pid() pid")).rows[0].pid;}
async function run(db,name,args){await begin(db);try{const d=await fixtureRpc(db,name,args);await db.query("commit");return d;}catch(e){await db.query("rollback");throw e;}}
async function waiting(pid){for(let i=0;i<40;i++){const r=await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid]);if(r.rows[0]?.wait_event_type==="Lock"){checks++;return;}await new Promise(resolve=>setTimeout(resolve,25));}throw new Error("Espera por lock não observada.");}
try{
 await Promise.all([setup.connect(),a.connect(),b.connect()]);await setup.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[owner,`${owner}@test.invalid`]);await begin(setup);empresa=await fixtureRpc(setup,"criar_empresa",["Concorrência relatórios","CPF","52998224725"]);await setup.query("commit");await setup.query("reset role");
 const cat=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Custos','despesa') returning id",[empresa])).rows[0].id,cat2=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Tarifas','despesa') returning id",[empresa])).rows[0].id;
 const version=async()=>(await setup.query("select versao from public.classificacoes_dre where categoria_id=$1",[cat])).rows[0]?.versao??0;
 const duplicate=[empresa,cat,0,"custos",randomUUID()],created=await Promise.all([run(a,"configurar_dre",duplicate),run(b,"configurar_dre",duplicate)]);eq(created.map(r=>r.codigo),["ok","ok"]);eq(await version(),1);eq((await setup.query("select count(*)::int n from public.historico_dre where empresa_id=$1",[empresa])).rows[0].n,1);
 const v=await version(),edits=await Promise.all([run(a,"configurar_dre",[empresa,cat,v,"operacionais",randomUUID()]),run(b,"configurar_dre",[empresa,cat,v,"financeiro",randomUUID()])]);eq(edits.map(r=>r.codigo).sort(),["desatualizado","ok"]);eq(await version(),v+1);
 const old=(await setup.query("select grupo from public.classificacoes_dre where categoria_id=$1",[cat])).rows[0].grupo;
 await begin(a);eq((await fixtureRpc(a,"configurar_dre",[empresa,cat,await version(),"tributos",randomUUID()])).codigo,"ok");await begin(b);eq(await fixtureRpc(b,"grupo_categoria_dre",[empresa,cat]),old);await b.query("commit");await a.query("commit");eq(await run(b,"grupo_categoria_dre",[empresa,cat]),"tributos");
 const filters={inicio:"2026-01-01",fim:"2026-01-31",vista:"dre",base:"registrado"},request=randomUUID(),args=[empresa,request,"csv",filters];await begin(a);eq((await fixtureRpc(a,"registrar_exportacao_relatorio",args)).codigo,"ok");const pid=await begin(b),exporting=fixtureRpc(b,"registrar_exportacao_relatorio",args);await waiting(pid);await a.query("commit");eq((await exporting).codigo,"ok");await b.query("commit");eq((await setup.query("select count(*)::int n from public.exportacoes_relatorios where id=$1",[request])).rows[0].n,1);eq((await setup.query("select count(*)::int n from public.eventos_uso where empresa_id=$1 and modulo='relatorios' and evento='exportar_formatado'",[empresa])).rows[0].n,1);
 eq((await run(a,"registrar_exportacao_relatorio",[empresa,request,"xlsx",filters])).codigo,"pedido_conflitante");
 const sharedRequest=randomUUID();const conflict=await Promise.all([run(a,"configurar_dre",[empresa,cat,await version(),"custos",sharedRequest]),run(b,"configurar_dre",[empresa,cat2,0,"custos",sharedRequest])]);eq(conflict.map(r=>r.codigo).sort(),["ok","pedido_conflitante"]);eq((await setup.query("select count(*)::int n from public.historico_dre where id=$1",[sharedRequest])).rows[0].n,1);
 console.log(`Relatórios: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(e){console.error(`Falha na concorrência de relatórios após ${checks} verificações: ${e.message}`);process.exitCode=1;}finally{
 await Promise.all([a.query("rollback").catch(()=>{}),b.query("rollback").catch(()=>{}),setup.query("rollback").catch(()=>{})]);await setup.query("reset role").catch(()=>{});
 try{if(empresa)await setup.query("delete from public.empresas where id=$1",[empresa]);await setup.query("delete from auth.users where id=$1",[owner]);}finally{await Promise.all([a.end(),b.end(),setup.end()]);}
}
