import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const db=databaseClient();let checks=0,context="schema";
const equal=(a,b)=>{assert.deepEqual(a,b,context);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
async function rpc(name,args){return(await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args.map(value=>Array.isArray(value)?JSON.stringify(value):value))).rows[0].result;}
async function denied(sql,args=[],codes=["42501"]){await db.query("savepoint denial");let code;try{await db.query(sql,args);}catch(error){code=error.code;}await db.query("rollback to savepoint denial");assert.ok(codes.includes(code),`${context}: esperava recusa, recebeu ${code}`);checks++;}
try{
 await db.connect();await db.query("begin");
 if(!(await db.query("select to_regclass('public.contas_bancarias') as name")).rows[0].name)await db.query(readFileSync("supabase/migrations/20261013190759_contas_bancarias_conciliacao.sql","utf8"));
 const owner=randomUUID(),outsider=randomUUID(),roles=Object.fromEntries(["administrador","operador","contador_completo","leitura","contador_leitura"].map(role=>[role,randomUUID()]));
 for(const id of [owner,outsider,...Object.values(roles)])await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,`${id}@test.invalid`]);
 await as(owner);const empresa=(await db.query("select public.criar_empresa('Bancos teste','CPF','52998224725') as id")).rows[0].id;
 for(const [role,id] of Object.entries(roles))await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,$3)",[empresa,id,role]);
 const account={nome:"Conta Teste",banco:"Banco Teste",codigo_banco:"001",agencia:"1234",numero:"12345-6",saldo_inicial_centavos:100000,data_saldo_inicial:"2026-01-01"};
 const conta=(await rpc("salvar_conta_bancaria",[empresa,null,null,account])).id;
 const rows=[{chave:"id:saida",data_movimento:"2026-01-31",descricao:"Saída",valor_centavos:-10000},{chave:"id:entrada",data_movimento:"2026-01-31",descricao:"Entrada",valor_centavos:20000}];
 const preview=await rpc("previa_importacao",[empresa,conta,"extrato.csv","csv","a".repeat(64),rows]);equal(preview.codigo,"ok");
 equal((await db.query("select id from public.lancamentos_importados where conta_id=$1",[conta])).rows.length,0);
 equal((await rpc("confirmar_importacao",[empresa,preview.id])).importados,2);equal((await rpc("confirmar_importacao",[empresa,preview.id])).reenvio,true);
 const overlap=await rpc("previa_importacao",[empresa,conta,"outro.csv","csv","b".repeat(64),rows]);equal((await rpc("confirmar_importacao",[empresa,overlap.id])).importados,0);
 const conflict=await rpc("previa_importacao",[empresa,conta,"conflito.csv","csv","c".repeat(64),[{...rows[0],valor_centavos:-1},{...rows[1],chave:"id:nova"}]]);equal((await rpc("confirmar_importacao",[empresa,conflict.id])).codigo,"identificador_conflitante");
 equal((await rpc("resumo_conta_bancaria",[empresa,conta])).saldo,"110000");
 for(const [role,id] of [["proprietario",owner],...Object.entries(roles),["externo",outsider]]){
  context=role;await as(id);const write=["proprietario","administrador","operador","contador_completo"].includes(role);
  equal((await db.query("select id from public.contas_bancarias where id=$1",[conta])).rows.length,role==="externo"?0:1);
  equal((await rpc("salvar_conta_bancaria",[empresa,null,null,{...account,nome:role}])).codigo,write?"ok":"sem_acesso");
  equal((await rpc("previa_importacao",[empresa,conta,"teste.csv","csv","a".repeat(64),rows])).codigo,write?"ok":"sem_acesso");
  equal((await rpc("confirmar_importacao",[empresa,preview.id])).codigo,write?"ok":"sem_acesso");
  for(const table of ["contas_bancarias","importacoes_bancarias","lancamentos_importados","conciliacoes","historico_conciliacoes"])await denied(`delete from public.${table} where empresa_id=$1`,[empresa]);
  if(!write)equal((await rpc("conciliar_movimento",[empresa,randomUUID(),"pagar",randomUUID()])).codigo,"sem_acesso");
 }
 context="conciliação";await as(owner);
 const expense=(await db.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Despesa','despesa') returning id",[empresa])).rows[0].id;
 const revenue=(await db.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Receita','receita') returning id",[empresa])).rows[0].id;
 const supplier=(await db.query("insert into public.fornecedores(empresa_id,nome) values($1,'Fornecedor') returning id",[empresa])).rows[0].id;
 const customer=(await db.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente') returning id",[empresa])).rows[0].id;
 const data={descricao:"Liquidação",documento:null,centro_custo_id:null,valor_centavos:10000,vencimento:"2026-01-31",modo:"unica",parcelas:1,custo_fixo_override:null};
 const pay=await rpc("criar_pagar",[empresa,randomUUID(),{...data,fornecedor_id:supplier,categoria_id:expense}]),receive=await rpc("criar_receber",[empresa,randomUUID(),{...data,cliente_id:customer,categoria_id:revenue,valor_centavos:20000}]);
 const p=(await db.query("select id,atualizado_em::text as version from public.lancamentos_pagar where serie_id=$1",[pay.serie_id])).rows[0];
 const r=(await db.query("select id,atualizado_em::text as version from public.lancamentos_receber where serie_id=$1",[receive.serie_id])).rows[0];
 const debit=(await db.query("select id from public.lancamentos_importados where conta_id=$1 and valor_centavos<0",[conta])).rows[0].id,credit=(await db.query("select id from public.lancamentos_importados where conta_id=$1 and valor_centavos>0",[conta])).rows[0].id;
 equal((await rpc("conciliar_movimento",[empresa,debit,"pagar",p.id])).codigo,"liquidacao_invalida");
 await rpc("configurar_aprovacao",["193750",false]);await rpc("baixar_pagar",[empresa,p.id,p.version,"193750",{pago_em:"2026-01-31",juros_centavos:0,multa_centavos:0,desconto_centavos:0}]);
 await rpc("baixar_receber",[empresa,r.id,r.version,{recebido_em:"2026-01-31",juros_centavos:0,multa_centavos:0,desconto_centavos:0}]);
 equal((await rpc("conciliar_movimento",[empresa,credit,"pagar",p.id])).codigo,"valor_incompativel");
 const cp=await rpc("conciliar_movimento",[empresa,debit,"pagar",p.id]);equal(cp.codigo,"ok");
 equal((await rpc("conciliar_movimento",[empresa,debit,"pagar",p.id])).codigo,"ja_conciliado");
 await as(roles.contador_completo);const cr=await rpc("conciliar_movimento",[empresa,credit,"receber",r.id]);equal(cr.codigo,"ok");
 equal((await rpc("resumo_conta_bancaria",[empresa,conta])).saldo,"110000");equal((await rpc("resumo_conta_bancaria",[empresa,conta])).conciliados,2);
 await as(owner);const current=(await db.query("select atualizado_em::text as version from public.lancamentos_pagar where id=$1",[p.id])).rows[0].version;
 await denied("select public.estornar_pagar($1,$2,$3,'193750','Pagamento equivocado')",[empresa,p.id,current],["23514"]);
 equal((await rpc("desfazer_conciliacao",[empresa,cp.id,"x"])).codigo,"motivo_invalido");equal((await rpc("desfazer_conciliacao",[empresa,cp.id,"Vínculo equivocado"])).codigo,"ok");
 equal((await rpc("estornar_pagar",[empresa,p.id,current,"193750","Pagamento equivocado"])).codigo,"ok");
 equal((await db.query("select evento from public.historico_conciliacoes where conciliacao_id=$1 order by criado_em",[cp.id])).rows.map(x=>x.evento),["conciliar","desfazer"]);
 const version=(await db.query("select atualizado_em::text as v from public.contas_bancarias where id=$1",[conta])).rows[0].v;
 equal((await rpc("salvar_conta_bancaria",[empresa,conta,version,{...account,saldo_inicial_centavos:0}])).codigo,"conta_com_extrato");
 equal((await rpc("status_conta_bancaria",[empresa,conta,null,false])).codigo,"desatualizado");equal((await rpc("status_conta_bancaria",[empresa,conta,version,false])).codigo,"ok");
 equal((await rpc("previa_importacao",[empresa,conta,"novo.csv","csv","d".repeat(64),rows])).codigo,"conta_inativa");
 await as(outsider);equal(await rpc("resumo_conta_bancaria",[empresa,conta]),null);equal((await rpc("desfazer_conciliacao",[empresa,cr.id,"Tentativa externa"])).codigo,"sem_acesso");
 await db.query("reset role");await db.query("set local role anon");await denied("select public.resumo_conta_bancaria($1,$2)",[empresa,conta]);
 await db.query("rollback");console.log(`Bancos: ${checks} verificações passaram (fixtures revertidas).`);
}catch(error){await db.query("rollback").catch(()=>{});console.error(`Falha em ${context}: ${error.message}`);process.exitCode=1;}finally{await db.end();}
