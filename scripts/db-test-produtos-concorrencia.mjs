import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
import {fixtureRpc} from "./fluxo-fixture.mjs";
const setup=databaseClient(),a=databaseClient(),b=databaseClient(),owner=randomUUID();let empresa,checks=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++;};
async function begin(db){await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await db.query("set local role authenticated");return (await db.query("select pg_backend_pid() pid")).rows[0].pid;}
async function run(db,name,args){await begin(db);try{const r=await fixtureRpc(db,name,args);await db.query("commit");return r;}catch(e){await db.query("rollback");throw e;}}
async function waiting(pid){for(let i=0;i<40;i++){const r=await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid]);if(r.rows[0]?.wait_event_type==="Lock"){checks++;return;}await new Promise(resolve=>setTimeout(resolve,25));}throw new Error("Espera pelo lock não observada.");}
try{
 await Promise.all([setup.connect(),a.connect(),b.connect()]);await setup.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[owner,`${owner}@test.invalid`]);
 await begin(setup);empresa=await fixtureRpc(setup,"criar_empresa",["Concorrência produtos","CPF","52998224725"]);await setup.query("commit");await setup.query("reset role");
 const version=async()=>(await setup.query("select versao from public.config_custeio where empresa_id=$1",[empresa])).rows[0]?.versao??0;
 const product={nome:"Produto A",custo_unitario_centavos:101,custo_projeto_centavos:500,preco_centavos:500,volume:3,margem_bps:2000},req=randomUUID(),args=[empresa,0,"produto",product,req];
 const duplicate=await Promise.all([run(a,"operar_produtos",args),run(b,"operar_produtos",args)]);eq(duplicate.map(r=>r.codigo),["ok","ok"]);eq(duplicate[0].id,duplicate[1].id);eq((await setup.query("select count(*)::int n from public.produtos where empresa_id=$1",[empresa])).rows[0].n,1);const p=duplicate[0].id;
 const q=(await run(a,"operar_produtos",[empresa,await version(),"produto",{...product,nome:"Produto B"},randomUUID()])).id;
 const old=await version(),edits=await Promise.all([run(a,"operar_produtos",[empresa,old,"produto",{...product,id:p,nome:"Edição A"},randomUUID()]),run(b,"operar_produtos",[empresa,old,"produto",{...product,id:p,nome:"Edição B"},randomUUID()])]);eq(edits.map(r=>r.codigo).sort(),["desatualizado","ok"]);eq(await version(),old+1);
 const expense=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Custos','despesa') returning id",[empresa])).rows[0].id,revenue=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Vendas','receita') returning id",[empresa])).rows[0].id,supplier=(await setup.query("insert into public.fornecedores(empresa_id,nome) values($1,'Fornecedor') returning id",[empresa])).rows[0].id;
 await run(a,"criar_pagar",[empresa,randomUUID(),{descricao:"Despesa compartilhada",documento:null,centro_custo_id:null,fornecedor_id:supplier,categoria_id:expense,valor_centavos:101,vencimento:"2026-01-10",modo:"unica",parcelas:1,custo_fixo_override:null}]);
 const rule={nome:"Equipe",categoria_id:expense,fornecedor_id:null,itens:[{produto_id:p,peso_bps:5000},{produto_id:q,peso_bps:5000}]};const r=(await run(a,"operar_produtos",[empresa,await version(),"regra",rule,randomUUID()])).id;
 await begin(a);eq((await fixtureRpc(a,"operar_produtos",[empresa,await version(),"regra",{...rule,id:r,itens:[{produto_id:p,peso_bps:2500},{produto_id:q,peso_bps:7500}]},randomUUID()])).codigo,"ok");
 const amounts=async()=>{await begin(b);const rows=(await b.query("select valor::text from public.movimentos_produtos($1,'2026-01-01','2026-01-31','registrado') order by valor",[empresa])).rows;await b.query("commit");return rows.map(r=>r.valor);};eq(await amounts(),["50","51"]);await a.query("commit");eq(await amounts(),["25","76"]);
 const scenario=(await run(a,"operar_planejamento",[empresa,null,null,"criar",{nome:"Cenário",ano:2026,request_id:randomUUID()}])).id;
 const cv=async()=>(await setup.query("select versao from public.cenarios_planejamento where id=$1",[scenario])).rows[0].versao;
 const projectArgs=async()=>[empresa,p,await version(),scenario,await cv(),"2026-01-01",revenue,expense,null,randomUUID()];
 const pv=await projectArgs();await begin(a);eq((await fixtureRpc(a,"operar_planejamento",[empresa,scenario,await cv(),"fechar",{mes:"2026-01-01"}])).codigo,"ok");const pid=await begin(b),projecting=fixtureRpc(b,"projetar_produto",pv);await waiting(pid);await a.query("commit");eq((await projecting).codigo,"desatualizado");await b.query("commit");eq((await setup.query("select count(*)::int n from public.plano_linhas where cenario_id=$1",[scenario])).rows[0].n,0);
 eq((await run(a,"operar_planejamento",[empresa,scenario,await cv(),"reabrir",{mes:"2026-01-01",motivo:"Inverter ordem das operações"}])).codigo,"ok");
 const oldCv=await cv();await begin(a);eq((await fixtureRpc(a,"projetar_produto",await projectArgs())).codigo,"ok");const closingPid=await begin(b),closing=fixtureRpc(b,"operar_planejamento",[empresa,scenario,oldCv,"fechar",{mes:"2026-01-01"}]);await waiting(closingPid);await a.query("commit");eq((await closing).codigo,"desatualizado");await b.query("commit");eq((await setup.query("select count(*)::int n from public.plano_linhas where cenario_id=$1",[scenario])).rows[0].n,3);
 const archiveVersion=await version();await begin(a);eq((await fixtureRpc(a,"operar_produtos",[empresa,archiveVersion,"status_produto",{id:q,ativo:false},randomUUID()])).codigo,"ok");const rulePid=await begin(b),updating=fixtureRpc(b,"operar_produtos",[empresa,archiveVersion,"regra",{...rule,id:r},randomUUID()]);await waiting(rulePid);await a.query("commit");eq((await updating).codigo,"desatualizado");await b.query("commit");eq((await run(b,"operar_produtos",[empresa,await version(),"regra",{...rule,id:r},randomUUID()])).codigo,"rateio_invalido");
 eq((await setup.query("select sum(peso_bps)::int n from public.itens_rateio where regra_id=$1",[r])).rows[0].n,10000);
 console.log(`Produtos: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(e){console.error(`Falha na concorrência de produtos após ${checks} verificações: ${e.message}`);process.exitCode=1;}finally{
 await Promise.all([a.query("rollback").catch(()=>{}),b.query("rollback").catch(()=>{}),setup.query("rollback").catch(()=>{})]);await setup.query("reset role").catch(()=>{});
 try{if(empresa)await setup.query("delete from public.empresas where id=$1",[empresa]);await setup.query("delete from auth.users where id=$1",[owner]);}finally{await Promise.all([a.end(),b.end(),setup.end()]);}
}
