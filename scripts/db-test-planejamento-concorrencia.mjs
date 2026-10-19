import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
import {fixtureRpc} from "./fluxo-fixture.mjs";
const setup=databaseClient(),a=databaseClient(),b=databaseClient();let owner,leader,empresa,checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function begin(db,id,otp=false){
 await db.query("begin");const timestamp=Number((await db.query("select extract(epoch from now())::bigint n")).rows[0].n);
 await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,session_id:randomUUID(),amr:[{method:otp?"otp":"password",timestamp}]})]);await db.query("set local role authenticated");
 return (await db.query("select pg_backend_pid() id")).rows[0].id;
}
async function run(db,id,name,args,otp=false){await begin(db,id,otp);try{const result=await fixtureRpc(db,name,args);await db.query("commit");return result;}catch(error){await db.query("rollback");throw error;}}
async function waiting(pid){for(let i=0;i<60;i++){if((await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0]?.wait_event_type==="Lock"){checks++;return;}await new Promise(resolve=>setTimeout(resolve,30));}throw new Error("Espera pelo lock não observada.");}
try{
 await Promise.all([setup.connect(),a.connect(),b.connect()]);
 owner=randomUUID();leader=randomUUID();for(const id of [owner,leader])await setup.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,`${id}@test.invalid`]);
 empresa=await run(setup,owner,"criar_empresa",["Plano concorrente","CPF","52998224725"]);
 const cat=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Custos','despesa') returning id",[empresa])).rows[0].id;
 const centro=(await setup.query("insert into public.centros_custo(empresa_id,nome) values($1,'Setor') returning id",[empresa])).rows[0].id;
 const creation={nome:"Concorrência",ano:2026,request_id:randomUUID()},created=await Promise.all([run(a,owner,"operar_planejamento",[empresa,null,null,"criar",creation]),run(b,owner,"operar_planejamento",[empresa,null,null,"criar",creation])]);eq(created.map(r=>r.codigo),["ok","ok"]);eq(created[0].id,created[1].id);
 const c=created[0].id,line={descricao:"Simultâneo",tipo:"despesa",categoria_id:cat,centro_custo_id:centro,mes:"2026-01-01",valor_unitario_centavos:100,quantidade:1};
 const results=await Promise.all([run(a,owner,"operar_planejamento",[empresa,c,1,"linha",line]),run(b,owner,"operar_planejamento",[empresa,c,1,"linha",{...line,descricao:"Outro"}])]);eq(results.map(r=>r.codigo).sort(),["desatualizado","ok"]);eq((await setup.query("select count(*)::int n from public.plano_linhas where cenario_id=$1",[c])).rows[0].n,1);
 const v=async()=>(await setup.query("select versao from public.cenarios_planejamento where id=$1",[c])).rows[0].versao;
 const copyData={nome:"Cópia concorrente",ano:2026,request_id:randomUUID()},version=await v();
 const copies=await Promise.all([run(a,owner,"operar_planejamento",[empresa,c,version,"duplicar",copyData]),run(b,owner,"operar_planejamento",[empresa,c,version,"duplicar",copyData])]);eq(copies.map(r=>r.codigo),["ok","ok"]);eq(copies[0].id,copies[1].id);
 async function invite(){const hash=createHash("sha256").update(randomUUID()).digest("hex");eq((await run(a,owner,"operar_planejamento",[empresa,c,await v(),"convite",{centro_custo_id:centro,email:`${leader}@test.invalid`,token_hash:hash,expira_em:new Date(Date.now()+86400000).toISOString()}])).codigo,"ok");return {hash,id:(await setup.query("select id from public.convites_planejamento where token_hash=$1",[hash])).rows[0].id};}
 const first=await invite(),firstVersion=await v();
 await begin(a,owner);eq((await fixtureRpc(a,"operar_planejamento",[empresa,c,firstVersion,"revogar",{convite_id:first.id}])).codigo,"ok");
 const bPid=await begin(b,leader,true),sending=fixtureRpc(b,"salvar_contribuicao",[first.hash,1,[{descricao:"Líder",categoria_id:cat,mes:"2026-02-01",valor_centavos:100}]]);
 await waiting(bPid);await a.query("commit");eq((await sending).codigo,"sem_acesso");await b.query("commit");eq((await setup.query("select revisao from public.convites_planejamento where id=$1",[first.id])).rows[0].revisao,0);
 const second=await invite();await begin(b,leader,true);eq((await fixtureRpc(b,"salvar_contribuicao",[second.hash,1,[{descricao:"Primeiro envio",categoria_id:cat,mes:"2026-02-01",valor_centavos:101}]])).codigo,"ok");
 const secondVersion=await v(),aPid=await begin(a,owner),revoking=fixtureRpc(a,"operar_planejamento",[empresa,c,secondVersion,"revogar",{convite_id:second.id}]);await waiting(aPid);await b.query("commit");eq((await revoking).codigo,"ok");await a.query("commit");eq((await setup.query("select revisao from public.convites_planejamento where id=$1",[second.id])).rows[0].revisao,1);eq(await run(b,leader,"consultar_contribuicao",[second.hash],true),null);
 const before=await v();await begin(a,owner);eq((await fixtureRpc(a,"operar_planejamento",[empresa,c,before,"fechar",{mes:"2026-01-01"}])).codigo,"ok");
 const editPid=await begin(b,owner),editing=fixtureRpc(b,"operar_planejamento",[empresa,c,before,"linha",line]);await waiting(editPid);await a.query("commit");eq((await editing).codigo,"desatualizado");await b.query("commit");
 eq((await setup.query("select count(*)::int n from public.plano_linhas where cenario_id=$1",[c])).rows[0].n,1);
 eq((await run(a,owner,"operar_planejamento",[empresa,c,await v(),"reabrir",{mes:"2026-01-01",motivo:"Inverter ordem da concorrência"}])).codigo,"ok");
 const editVersion=await v();await begin(b,owner);eq((await fixtureRpc(b,"operar_planejamento",[empresa,c,editVersion,"linha",line])).codigo,"ok");
 const closePid=await begin(a,owner),closing=fixtureRpc(a,"operar_planejamento",[empresa,c,editVersion,"fechar",{mes:"2026-01-01"}]);await waiting(closePid);await b.query("commit");eq((await closing).codigo,"desatualizado");await a.query("commit");eq((await setup.query("select count(*)::int n from public.plano_linhas where cenario_id=$1",[c])).rows[0].n,2);
 console.log(`Planejamento: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(e){await a.query("rollback").catch(()=>{});await b.query("rollback").catch(()=>{});console.error(`Falha na concorrência após ${checks} verificações: ${e.message}`);process.exitCode=1;}finally{
 if(empresa)await setup.query("delete from public.empresas where id=$1",[empresa]);if(owner&&leader)await setup.query("delete from auth.users where id=any($1::uuid[])",[[owner,leader]]);await Promise.all([setup.end(),a.end(),b.end()]);
}
