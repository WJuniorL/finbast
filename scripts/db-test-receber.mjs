import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const client=databaseClient();let checks=0,context="schema";
const equal=(actual,expected)=>{assert.deepEqual(actual,expected,context);checks++;};
async function asUser(id){await client.query("reset role");await client.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await client.query("set local role authenticated");}
async function rpc(name,args=[]){return(await client.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args)).rows[0].result;}
async function record(serie){return(await client.query("select *,atualizado_em::text as versao from public.lancamentos_receber where serie_id=$1 order by parcela limit 1",[serie])).rows[0];}
async function denied(sql,args=[],codes=["42501"]){await client.query("savepoint denial");let code;try{await client.query(sql,args);}catch(error){code=error.code;}await client.query("rollback to savepoint denial");assert.ok(codes.includes(code),`${context}: esperava recusa, recebeu ${code}`);checks++;}
try{
  await client.connect();await client.query("begin");
  if(!(await client.query("select to_regclass('public.lancamentos_receber') as name")).rows[0].name)await client.query(readFileSync("supabase/migrations/20261013182723_contas_receber.sql","utf8"));
  const owner=randomUUID(),outsider=randomUUID(),members=Object.fromEntries(["administrador","operador","contador_completo","leitura","contador_leitura"].map(role=>[role,randomUUID()]));
  for(const id of [owner,outsider,...Object.values(members)])await client.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);
  await asUser(owner);const empresa=(await client.query("select public.criar_empresa('Receber teste','CPF','52998224725') as id")).rows[0].id;
  for(const [role,id] of Object.entries(members))await client.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,$3)",[empresa,id,role]);
  const cat=(await client.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Vendas','receita') returning id",[empresa])).rows[0].id;
  const expense=(await client.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Compras','despesa') returning id",[empresa])).rows[0].id;
  const customer=(await client.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente') returning id",[empresa])).rows[0].id;
  const center=(await client.query("insert into public.centros_custo(empresa_id,nome) values($1,'Vendas') returning id",[empresa])).rows[0].id;
  const data={descricao:"Venda parcelada",documento:"NF 123",cliente_id:customer,categoria_id:cat,centro_custo_id:center,valor_centavos:10000,vencimento:"2026-01-31",modo:"parcelado",parcelas:3};
  const request=randomUUID(),created=await rpc("criar_receber",[empresa,request,data]);equal(created.codigo,"ok");equal(created.gerados,3);
  equal((await rpc("criar_receber",[empresa,request,data])).serie_id,created.serie_id);
  equal((await rpc("criar_receber",[empresa,request,{...data,valor_centavos:20000}])).codigo,"pedido_alterado");
  equal((await client.query("select valor_centavos::text as valor,vencimento::text as data from public.lancamentos_receber where serie_id=$1 order by parcela",[created.serie_id])).rows,[{valor:"3334",data:"2026-01-31"},{valor:"3333",data:"2026-02-28"},{valor:"3333",data:"2026-03-31"}]);
  const settlement={recebido_em:"2026-01-31",juros_centavos:100,multa_centavos:50,desconto_centavos:25,observacao:"Recebido fora do sistema"};
  let visible=3;
  for(const [role,id] of [["proprietario",owner],...Object.entries(members),["externo",outsider]]){
    context=`acesso ${role}`;await asUser(id);const write=["proprietario","administrador","operador","contador_completo"].includes(role);
    equal((await client.query("select id from public.lancamentos_receber where empresa_id=$1",[empresa])).rows.length,role==="externo"?0:visible);
    const launch=await rpc("criar_receber",[empresa,randomUUID(),{...data,modo:"unica"}]);equal(launch.codigo,write?"ok":"sem_acesso");
    const item=await record(write?launch.serie_id:created.serie_id);
    await denied("update public.lancamentos_receber set status='recebido' where empresa_id=$1",[empresa]);
    await denied("delete from public.series_receber where empresa_id=$1",[empresa]);
    await denied("insert into public.baixas_receber(empresa_id,tipo) values($1,'baixa')",[empresa]);
    await denied("select private.gerar_serie_receber($1,12)",[created.serie_id]);
    const receipt=await rpc("baixar_receber",[empresa,item?.id??randomUUID(),item?.versao??null,settlement]);equal(receipt.codigo,write?"ok":"sem_acesso");
    if(write){visible++;const paid=await record(launch.serie_id);equal(paid.status,"recebido");equal(paid.valor_recebido_centavos,"10125");equal((await rpc("estornar_receber",[empresa,paid.id,paid.versao,"Data de recebimento incorreta"])).codigo,"ok");}
    else {equal((await rpc("editar_receber",[empresa,randomUUID(),null,data])).codigo,"sem_acesso");equal((await rpc("cancelar_receber",[empresa,randomUUID(),null,false])).codigo,"sem_acesso");equal((await rpc("expandir_receber",[empresa])).codigo,"sem_acesso");}
  }
  await asUser(owner);context="valores, versão e histórico";let item=await record(created.serie_id);
  for(const payload of [{...settlement,desconto_centavos:100000},{...settlement,juros_centavos:-1},{...settlement,recebido_em:"2100-01-01"},{...settlement,juros_centavos:1000000000001,desconto_centavos:1000000000000}])equal((await rpc("baixar_receber",[empresa,item.id,item.versao,payload])).codigo,"valor_invalido");
  equal((await rpc("baixar_receber",[empresa,item.id,null,settlement])).codigo,"desatualizado");
  equal((await rpc("baixar_receber",[empresa,item.id,item.versao,settlement])).codigo,"ok");
  equal((await rpc("baixar_receber",[empresa,item.id,item.versao,settlement])).codigo,"estado_invalido");
  let paid=await record(created.serie_id);equal(paid.valor_recebido_centavos,"3459");
  equal((await rpc("editar_receber",[empresa,paid.id,paid.versao,data])).codigo,"estado_invalido");
  equal((await rpc("estornar_receber",[empresa,paid.id,paid.versao,"x"])).codigo,"motivo_invalido");
  equal((await rpc("estornar_receber",[empresa,paid.id,paid.versao,"Lançamento equivocado"])).codigo,"ok");
  equal((await client.query("select tipo,valor_centavos::text as valor,juros_centavos::text as juros from public.baixas_receber where lancamento_id=$1 order by criado_em",[paid.id])).rows,[{tipo:"baixa",valor:"3459",juros:"100"},{tipo:"estorno",valor:"3459",juros:"100"}]);
  item=await record(created.serie_id);equal(item.status,"aberto");equal(item.valor_recebido_centavos,null);equal(item.juros_centavos,"0");
  equal((await rpc("editar_receber",[empresa,item.id,item.versao,{...data,descricao:"Venda corrigida",valor_centavos:3500}])).codigo,"ok");
  equal((await rpc("editar_receber",[empresa,item.id,item.versao,data])).codigo,"desatualizado");
  await denied("update public.categorias set tipo='despesa' where id=$1",[cat],["23503"]);
  equal((await rpc("criar_receber",[empresa,randomUUID(),{...data,categoria_id:expense}])).codigo,"cadastro_invalido");
  context="recorrência e arquivos";
  const recurring=await rpc("criar_receber",[empresa,randomUUID(),{...data,modo:"recorrente",vencimento:"2026-10-31"}]);equal(recurring.gerados,12);equal((await rpc("expandir_receber",[empresa])).gerados,0);
  await client.query("update public.clientes set ativo=false where id=$1",[customer]);equal((await rpc("expandir_receber",[empresa])).bloqueadas,1);
  equal((await rpc("criar_receber",[empresa,randomUUID(),data])).codigo,"cadastro_invalido");
  const original=await record(recurring.serie_id);equal((await rpc("editar_receber",[empresa,original.id,original.versao,{...data,descricao:"Mantendo referência arquivada"}])).codigo,"ok");
  const occurrence=await record(recurring.serie_id);equal((await rpc("cancelar_receber",[empresa,occurrence.id,occurrence.versao,true])).codigo,"ok");
  equal((await client.query("select ativo from public.series_receber where id=$1",[recurring.serie_id])).rows[0].ativo,false);
  equal((await record(recurring.serie_id)).status,"aberto"); // A edição antecipou o vencimento: interromper preserva vencidos.
  const summary=await rpc("resumo_receber",[empresa]);equal(summary.aberto,"60166");equal(summary.recebido,"0");equal(summary.previsto_mes,"0");
  await client.query("update public.clientes set ativo=true where id=$1",[customer]);
  await client.query("update public.usuarios_empresas set papel='leitura' where empresa_id=$1 and usuario_id=$2",[empresa,members.operador]);
  await asUser(members.operador);equal((await rpc("criar_receber",[empresa,randomUUID(),data])).codigo,"sem_acesso");
  context="isolamento";await asUser(outsider);const other=(await client.query("select public.criar_empresa('Outra','CPF','52998224725') as id")).rows[0].id;
  equal((await rpc("criar_receber",[other,randomUUID(),data])).codigo,"cadastro_invalido");
  equal((await rpc("resumo_receber",[empresa])).aberto,"0");
  equal((await client.query("select id from public.baixas_receber where empresa_id=$1",[empresa])).rows.length,0);
  await client.query("reset role");await client.query("set local role anon");await denied("select public.resumo_receber($1)",[empresa]);await denied("select public.baixar_receber($1,$2,now(),'{}'::jsonb)",[empresa,paid.id]);
  await client.query("rollback");console.log(`Contas a Receber: ${checks} verificações passaram (fixtures revertidas).`);
}catch(error){try{await client.query("rollback");}catch{}console.error(`Falha em ${context}: ${error.message}`);process.exitCode=1;}
finally{await client.end();}
