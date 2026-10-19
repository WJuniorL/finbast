import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
import {cashFixture,fixtureRpc} from "./fluxo-fixture.mjs";
const db=databaseClient();let checks=0;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
async function denied(args,code="22023",name="fluxo_caixa") {
 await db.query("savepoint recusa");let result;try{await fixtureRpc(db,name,args);}catch(error){result=error.code;}
 await db.query("rollback to savepoint recusa");equal(result,code);
}
try {
 await db.connect();await db.query("begin");
 if(!(await db.query("select to_regprocedure('public.fluxo_caixa(uuid,date,date,uuid,boolean,integer)') as name")).rows[0].name)await db.query(readFileSync("supabase/migrations/20261013210457_fluxo_caixa.sql","utf8"));
 const owner=randomUUID(),outsider=randomUUID(),roles=Object.fromEntries(["administrador","operador","contador_completo","leitura","contador_leitura"].map(role=>[role,randomUUID()]));
 for(const id of [owner,outsider,...Object.values(roles)])await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,`${id}@test.invalid`]);
 const fixture=await cashFixture(db,owner),{empresa,conta,segunda}=fixture;
 await db.query("reset role");for(const [papel,usuario] of Object.entries(roles))await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,$3)",[empresa,usuario,papel]);await as(owner);
 const args=[empresa,"2026-01-29","2026-02-02",null,false,1];
 const flow=async(overrides=[])=>fixtureRpc(db,"fluxo_caixa",overrides.length?overrides:args);
 let data=await flow();equal(data.saldo_inicial,"95400");equal(data.vencidos_entradas,"900");equal(data.vencidos_saidas,"700");equal(data.dias.length,5);
 equal(data.dias.at(-1).saldo_realizado,"107900");equal(data.dias.at(-1).saldo_projetado,"113600");
 equal(data.dias[1].entradas,"0");equal(data.dias[1].saidas,"0");equal(data.dias[2].saidas,"10500");equal(data.dias[2].entradas,"20000");
 equal(data.dias[2].previstas_saidas,"2500");equal(data.dias.at(-1).previstas_entradas,"8000");equal(data.movimentos.some(m=>m.descricao.startsWith("Cancelado")),false);
 equal(data.movimentos.some(m=>m.id===fixture.pagar.id||m.id===fixture.receber.id),false);
 data=await flow([empresa,"2026-01-29","2026-02-02",conta,false,1]);equal(data.saldo_inicial,"100000");equal(data.dias.at(-1).saldo_realizado,"109500");equal(data.dias.at(-1).saldo_projetado,"109500");equal(data.total,2);
 data=await flow([empresa,"2026-01-29","2026-02-02",segunda,false,1]);equal(data.saldo_inicial,"-5000");equal(data.dias.at(-1).saldo_realizado,"-5000");
 data=await flow([empresa,"2026-01-29","2026-02-02",null,true,1]);equal(data.saldo_inicial,"400");equal(data.dias.at(-1).saldo_realizado,"3400");equal(data.dias.at(-1).saldo_projetado,"9100");
 data=await flow([empresa,"2026-01-01","2026-01-20",null,false,1]);equal(data.saldo_inicial,"0");equal(data.dias[0].abertura,"100000");equal(data.dias.at(-1).abertura,"-5000");equal(data.dias[0].entradas,"0");equal(data.dias.at(-1).saldo_realizado,"95400");
 // Desfazer vínculo preserva extrato e devolve a baixa à origem sem conta.
 equal((await fixtureRpc(db,"desfazer_conciliacao",[empresa,fixture.conciliacao,"Vínculo sintético desfeito"])).codigo,"ok");
 data=await flow();equal(data.dias[1].saidas,"10500");equal(data.dias.at(-1).saldo_realizado,"97400");
 const version=(await db.query("select atualizado_em::text as version from public.lancamentos_pagar where id=$1",[fixture.pagar.id])).rows[0].version;
 equal((await fixtureRpc(db,"estornar_pagar",[empresa,fixture.pagar.id,version,"193750","Baixa sintética estornada"])).codigo,"ok");
 data=await flow();equal(data.dias[1].previstas_saidas,"10000");equal(data.dias.at(-1).saldo_realizado,"107900");
 for(const usuario of [owner,...Object.values(roles)]){await as(usuario);equal((await flow()).dias.at(-1).saldo_realizado,"107900");}
 await as(outsider);equal(await flow(),null);await as(owner);equal(await flow([empresa,"2026-01-29","2026-02-02",randomUUID(),false,1]),null);
 for(const invalid of [[empresa,null,"2026-02-02",null,false,1],[empresa,"2026-02-03","2026-02-02",null,false,1],[empresa,"2026-01-01","2027-01-02",null,false,1],[empresa,"1999-12-31","2000-01-01",null,false,1],[empresa,"2026-01-29","2026-02-02",conta,true,1],[empresa,"2026-01-29","2026-02-02",null,false,0]])await denied(invalid);
 await db.query("reset role");await db.query("set local role anon");await denied(args,"42501");await as(owner);
 for(let i=0;i<52;i++)await fixture.title("receber",`Página ${i}`,1,"2026-02-02");
 data=await flow();equal(data.movimentos.length,50);equal(data.total,60);equal(data.dias.at(-1).previstas_entradas,"8052");
 const second=await flow([...args.slice(0,5),2]);equal(second.movimentos.length,10);equal(second.dias,data.dias);
 equal(second.movimentos.some(m=>data.movimentos.some(first=>first.id===m.id)),false);equal((await flow([...args.slice(0,5),100])).pagina,2);
 // Mais de 1.000 origens: o total agregado não depende do limite REST nem da página.
 const lot=await fixtureRpc(db,"previa_importacao",[empresa,conta,"mil.csv","csv","b".repeat(64),Array.from({length:1000},(_,i)=>({chave:`id:mil-${i}`,data_movimento:"2026-01-31",descricao:`Mil ${i}`,valor_centavos:1000000000000}))]);
 await fixtureRpc(db,"confirmar_importacao",[empresa,lot.id]);data=await flow();equal(data.total,1060);equal(data.dias.at(-1).saldo_realizado,"1000000000107900");
 await db.query("rollback");console.log(`Fluxo de caixa: ${checks} verificações passaram (fixtures revertidas).`);
}catch(error){await db.query("rollback").catch(()=>{});console.error(`Falha no fluxo de caixa: ${error.message}`);process.exitCode=1;}finally{await db.end();}
