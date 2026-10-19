import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
import {fixtureRpc} from "./fluxo-fixture.mjs";
import {dashboardFixture} from "./dashboard-fixture.mjs";
const db=databaseClient();let checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
async function denied(args,expected="22023") {await db.query("savepoint denial");let code;try{await fixtureRpc(db,"resumo_dashboard",args);}catch(error){code=error.code;}await db.query("rollback to savepoint denial");equal(code,expected);}
try {
 await db.connect();await db.query("begin");
 if(!(await db.query("select to_regprocedure('public.resumo_dashboard(uuid,date)') as name")).rows[0].name)await db.query(readFileSync("supabase/migrations/20261013221251_dashboard.sql","utf8"));
 const owner=randomUUID(),outsider=randomUUID(),roles=Object.fromEntries(["administrador","operador","contador_completo","leitura","contador_leitura"].map(role=>[role,randomUUID()]));
 for(const id of [owner,outsider,...Object.values(roles)])await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,`${id}@test.invalid`]);
 const fixture=await dashboardFixture(db,owner),{empresa,conta}=fixture;
 await db.query("reset role");for(const [papel,id] of Object.entries(roles))await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,$3)",[empresa,id,papel]);await as(owner);
 const dashboard=(mes="2026-01-01",emp=empresa)=>fixtureRpc(db,"resumo_dashboard",[emp,mes]);
 let data=await dashboard();equal(data.fluxo.dias.at(-1).saldo_realizado,"107900");equal(data.fluxo.dias.at(-1).saldo_projetado,"105600");equal(data.pagar_aberto,"3200");equal(data.receber_aberto,"900");equal(data.pagar_quantidade,2);equal(data.receber_quantidade,1);
 equal(data.custos_fixos,"12500");equal(data.fixos[0].valor,"12500");equal(data.categorias_fixos,1);equal(data.projecao_fixos.map(p=>p.valor),["1200","2300","3400"]);
 equal(data.pendentes,0);equal(data.movimentos_pendentes,[]);equal(data.contas.find(c=>c.id===conta).saldo,"109500");equal(data.contas.find(c=>c.id===fixture.segunda).ativo,false);
 equal(data.titulos.some(t=>t.descricao.includes("Cancelado")),false);equal(data.titulos.length,3);
 equal(data.fluxo,await fixtureRpc(db,"fluxo_caixa",[empresa,"2026-01-01","2026-01-31",null,false,1]));
 data=await dashboard("2026-02-01");equal(data.pagar_aberto,"8200");equal(data.receber_aberto,"8000");equal(data.custos_fixos,"1800");equal(data.projecao_fixos.map(p=>p.valor),["2300","3400","4500"]);
 equal((await dashboard("2028-02-01")).fluxo.dias.length,29);
 for(const id of [owner,...Object.values(roles)]){await as(id);equal((await dashboard()).custos_fixos,"12500");}
 await as(outsider);equal(await dashboard(),null);await as(owner);equal(await dashboard("2026-01-01",randomUUID()),null);
 for(const mes of [null,"1999-12-01","2101-01-01","2026-01-02"])await denied([empresa,mes]);
 await db.query("reset role");await db.query("set local role anon");await denied([empresa,"2026-01-01"],"42501");await as(owner);
 equal((await fixtureRpc(db,"desfazer_conciliacao",[empresa,fixture.conciliacao,"Teste de indicador pendente"])).codigo,"ok");data=await dashboard();equal(data.pendentes,1);equal(data.movimentos_pendentes[0].id,fixture.debito);equal(data.fluxo.dias.at(-1).saldo_realizado,"97400");
 // Mais de 1.000 origens não trunca os indicadores ou os saldos bancários.
 const lot=await fixtureRpc(db,"previa_importacao",[empresa,conta,"dashboard.csv","csv","d".repeat(64),Array.from({length:1000},(_,i)=>({chave:`id:dash-${i}`,data_movimento:"2026-01-31",descricao:`Movimento ${i}`,valor_centavos:1000000000000}))]);await fixtureRpc(db,"confirmar_importacao",[empresa,lot.id]);
 data=await dashboard();equal(data.pendentes,1001);equal(data.movimentos_pendentes.length,5);equal(data.contas.find(c=>c.id===conta).saldo,"1000000000109500");equal(data.fluxo.dias.at(-1).saldo_realizado,"1000000000097400");
 for(let i=0;i<11;i++)await fixture.title("receber",`Título ${i}`,1,"2026-01-31");data=await dashboard();equal(data.receber_aberto,"911");equal(data.receber_quantidade,12);equal(data.titulos.length,10);
 // Vencimento de hoje não é vencido; a referência usa America/Bahia.
 const today=data.hoje;await fixture.title("receber","Recebimento de hoje",11,today);
 data=await dashboard();const before=BigInt(data.receber_vencido);
 await db.query("reset role");await db.query("update public.lancamentos_receber set vencimento=$1::date-1 where empresa_id=$2 and descricao='Recebimento de hoje'",[today,empresa]);await as(owner);
 equal(BigInt((await dashboard()).receber_vencido),before+11n);
 await db.query("reset role");await db.query("delete from public.usuarios_empresas where empresa_id=$1 and usuario_id=$2",[empresa,roles.leitura]);await as(roles.leitura);equal(await dashboard(),null);
 await db.query("rollback");console.log(`Dashboard: ${checks} verificações passaram (fixtures revertidas).`);
}catch(error){await db.query("rollback").catch(()=>{});console.error(`Falha no Dashboard: ${error.message}`);process.exitCode=1;}finally{await db.end();}
