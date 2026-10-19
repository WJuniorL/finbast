import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const setup=databaseClient(),first=databaseClient(),second=databaseClient(),user=randomUUID();let empresa,created=false,checks=0;
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function begin(client){await client.query("begin");await client.query("set local statement_timeout='10s'");await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);await client.query("set local role authenticated");}
async function rpc(client,name,args){return(await client.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args.map(value=>Array.isArray(value)?JSON.stringify(value):value))).rows[0].result;}
async function waiting(pid){for(let i=0;i<20;i++){if((await setup.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0]?.wait_event_type==="Lock"){checks++;return;}await setup.query("select pg_sleep(0.1)");}throw new Error("Operação concorrente não aguardou o lock.");}
try{
 await Promise.all([setup.connect(),first.connect(),second.connect()]);await setup.query("insert into auth.users(id,email) values($1,$2)",[user,`${user}@test.invalid`]);created=true;
 await begin(setup);empresa=(await setup.query("select public.criar_empresa('Bancos concorrência','CPF','52998224725') as id")).rows[0].id;
 const conta=(await rpc(setup,"salvar_conta_bancaria",[empresa,null,null,{nome:"Conta",banco:"Banco",codigo_banco:null,agencia:null,numero:"123",saldo_inicial_centavos:0,data_saldo_inicial:"2026-01-01"}])).id;
 const rows=[{chave:"id:recebimento",data_movimento:"2026-01-31",descricao:"Receita",valor_centavos:10000}];
 const lote=(await rpc(setup,"previa_importacao",[empresa,conta,"extrato.csv","csv","e".repeat(64),rows])).id;
 const cat=(await setup.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Vendas','receita') returning id",[empresa])).rows[0].id;
 const customer=(await setup.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente') returning id",[empresa])).rows[0].id;
 const series=await rpc(setup,"criar_receber",[empresa,randomUUID(),{descricao:"Venda",cliente_id:customer,categoria_id:cat,valor_centavos:10000,vencimento:"2026-01-31",modo:"unica",parcelas:1}]);
 let receipt=(await setup.query("select id,atualizado_em::text as v from public.lancamentos_receber where serie_id=$1",[series.serie_id])).rows[0];
 const payment={recebido_em:"2026-01-31",juros_centavos:0,multa_centavos:0,desconto_centavos:0};equal((await rpc(setup,"baixar_receber",[empresa,receipt.id,receipt.v,payment])).codigo,"ok");await setup.query("commit");await setup.query("reset role");
 const pid=(await second.query("select pg_backend_pid() as pid")).rows[0].pid;
 await begin(first);equal((await rpc(first,"confirmar_importacao",[empresa,lote])).importados,1);
 await begin(second);const repeat=rpc(second,"confirmar_importacao",[empresa,lote]);await waiting(pid);await first.query("commit");equal((await repeat).reenvio,true);await second.query("commit");
 equal((await setup.query("select count(*)::int as n from public.lancamentos_importados where conta_id=$1",[conta])).rows[0].n,1);
 const movement=(await setup.query("select id from public.lancamentos_importados where conta_id=$1",[conta])).rows[0].id;
 receipt=(await setup.query("select id,atualizado_em::text as v from public.lancamentos_receber where id=$1",[receipt.id])).rows[0];
 await begin(first);const reconciled=await rpc(first,"conciliar_movimento",[empresa,movement,"receber",receipt.id]);equal(reconciled.codigo,"ok");
 await begin(second);const double=rpc(second,"conciliar_movimento",[empresa,movement,"receber",receipt.id]);await waiting(pid);await first.query("commit");equal((await double).codigo,"ja_conciliado");await second.query("commit");
 await begin(first);equal((await rpc(first,"desfazer_conciliacao",[empresa,reconciled.id,"Correção de vínculo"])).codigo,"ok");await first.query("commit");
 // Conciliação primeiro: estorno aguarda a liquidação e é recusado pelo trigger.
 await begin(first);const fresh=await rpc(first,"conciliar_movimento",[empresa,movement,"receber",receipt.id]);equal(fresh.codigo,"ok");
 await begin(second);const undo=rpc(second,"estornar_receber",[empresa,receipt.id,receipt.v,"Recebimento equivocado"]).then(value=>value.codigo,error=>error.code);await waiting(pid);await first.query("commit");equal(await undo,"23514");await second.query("rollback");
 await begin(first);equal((await rpc(first,"desfazer_conciliacao",[empresa,fresh.id,"Novo ajuste de vínculo"])).codigo,"ok");await first.query("commit");
 // Estorno primeiro: a conciliação aguarda e percebe o estado aberto.
 await begin(first);equal((await rpc(first,"estornar_receber",[empresa,receipt.id,receipt.v,"Recebimento equivocado"])).codigo,"ok");
 await begin(second);const afterUndo=rpc(second,"conciliar_movimento",[empresa,movement,"receber",receipt.id]);await waiting(pid);await first.query("commit");equal((await afterUndo).codigo,"liquidacao_invalida");await second.query("commit");
 equal((await setup.query("select count(*)::int as n from public.conciliacoes where empresa_id=$1 and desfeita_em is null",[empresa])).rows[0].n,0);
 equal((await setup.query("select status from public.lancamentos_receber where id=$1",[receipt.id])).rows[0].status,"aberto");
 console.log(`Bancos: ${checks} verificações de concorrência passaram. Fixtures removidas.`);
}catch(error){console.error("Falha na concorrência bancária:",error.code??error.name,error instanceof assert.AssertionError?error.message:"");process.exitCode=1;}
finally{
 await Promise.all([first.query("rollback").catch(()=>{}),second.query("rollback").catch(()=>{})]);await setup.query("rollback").catch(()=>{});await setup.query("reset role").catch(()=>{});
 try{if(empresa)await setup.query("delete from public.empresas where id=$1 and dono_id=$2",[empresa,user]);if(created)await setup.query("delete from auth.users where id=$1",[user]);}finally{await Promise.all([setup.end(),first.end(),second.end()]);}
}
