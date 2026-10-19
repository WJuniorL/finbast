import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { databaseClient } from "./db-client.mjs";

const client=databaseClient(); let checks=0; let context="schema";
const equal=(actual,expected)=>{assert.deepEqual(actual,expected,context);checks++;};
async function asUser(id,claims={}) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[id,JSON.stringify({sub:id,...claims})]);
  await client.query("set local role authenticated");
}
async function denied(sql,args=[],codes=["42501"]) {
  await client.query("savepoint denial"); let code;
  try { await client.query(sql,args); } catch(error) { code=error.code; }
  await client.query("rollback to savepoint denial");
  assert.ok(codes.includes(code),`${context}: esperava recusa, recebeu ${code}`);checks++;
}
async function rpc(name,args=[]) {
  return (await client.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args)).rows[0].result;
}
async function record(serie) { return (await client.query("select *,atualizado_em::text as versao from public.lancamentos_pagar where serie_id=$1 order by parcela limit 1",[serie])).rows[0]; }
try {
  await client.connect(); await client.query("begin");
  if(!(await client.query("select to_regclass('public.lancamentos_pagar') as name")).rows[0].name) await client.query(readFileSync("supabase/migrations/20261013173410_contas_pagar.sql","utf8"));
  const owner=randomUUID(),outsider=randomUUID();
  const members=Object.fromEntries(["administrador","operador","leitura","contador_completo","contador_leitura"].map(role=>[role,randomUUID()]));
  for(const id of [owner,outsider,...Object.values(members)]) await client.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[id,`${id}@test.invalid`]);
  await asUser(owner);
  const empresa=(await client.query("select public.criar_empresa('Pagar teste','CPF','52998224725') as id")).rows[0].id;
  for(const [role,id] of Object.entries(members)) await client.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,$3)",[empresa,id,role]);
  const categoria=(await client.query("insert into public.categorias(empresa_id,nome,tipo,custo_fixo) values($1,'Aluguel','despesa',true) returning id",[empresa])).rows[0].id;
  const fornecedor=(await client.query("insert into public.fornecedores(empresa_id,nome) values($1,'Locador') returning id",[empresa])).rows[0].id;
  const data={descricao:"Parcela",documento:null,fornecedor_id:fornecedor,categoria_id:categoria,centro_custo_id:null,valor_centavos:10000,vencimento:"2026-01-31",modo:"parcelado",parcelas:3,custo_fixo_override:null};
  const request=randomUUID(); const created=await rpc("criar_pagar",[empresa,request,data]);equal(created.codigo,"ok");equal(created.gerados,3);
  equal((await rpc("criar_pagar",[empresa,request,data])).codigo,"ok");
  equal((await rpc("criar_pagar",[empresa,request,{...data,descricao:"Alterado"}])).codigo,"pedido_alterado");
  equal((await client.query("select valor_centavos::text as valor,vencimento::text as data,custo_fixo from public.lancamentos_pagar where serie_id=$1 order by parcela",[created.serie_id])).rows,[{valor:"3334",data:"2026-01-31",custo_fixo:true},{valor:"3333",data:"2026-02-28",custo_fixo:true},{valor:"3333",data:"2026-03-31",custo_fixo:true}]);
  let item=await record(created.serie_id);
  const settlement={juros_centavos:100,multa_centavos:50,desconto_centavos:25,pago_em:"2026-01-31",observacao:"Registro manual"};
  let visible=3;
  for(const [role,id] of [["proprietario",owner],...Object.entries(members),["externo",outsider]]) {
    context=`acesso ${role}`;await asUser(id);
    const reader=role!=="externo",writer=["proprietario","administrador","operador","contador_completo"].includes(role);
    equal((await client.query("select id from public.lancamentos_pagar where empresa_id=$1",[empresa])).rows.length,reader?visible:0);
    const result=await rpc("criar_pagar",[empresa,randomUUID(),{...data,modo:"unica"}]);equal(result.codigo,writer?"ok":"sem_acesso");
    if(writer) visible++;
    await denied("update public.lancamentos_pagar set status='pago' where id=$1",[item.id]);
    await denied("delete from public.lancamentos_pagar where id=$1",[item.id]);
    await denied("insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values($1,$2,'falso','falso')",[empresa,id]);
    await denied("select hash from private.senhas_aprovacao");
    await denied("select private.verificar_aprovacao('193750')");
    if(!["proprietario","administrador","operador"].includes(role)) equal((await rpc("baixar_pagar",[empresa,item.id,item.versao,"193750",settlement])).codigo,"sem_acesso");
  }
  context="aprovação e bloqueio"; await asUser(owner);
  equal((await rpc("configurar_aprovacao",["123456",false])).codigo,"pin_fraco");
  equal((await rpc("configurar_aprovacao",["193750",false])).codigo,"ok");
  equal((await rpc("configurar_aprovacao",["193750",false])).codigo,"ja_configurada");
  equal((await rpc("configurar_aprovacao",["284061",true])).codigo,"confirmar_email");
  for(let i=0;i<5;i++) equal((await rpc("baixar_pagar",[empresa,item.id,item.versao,"000000",settlement])).codigo,i===4?"bloqueada":"senha_invalida");
  equal((await rpc("baixar_pagar",[empresa,item.id,item.versao,"193750",settlement])).codigo,"bloqueada");
  await client.query("reset role");
  const secret=(await client.query("select hash,tentativas from private.senhas_aprovacao where usuario_id=$1",[owner])).rows[0];
  equal(secret.tentativas,5);equal(secret.hash.startsWith("$2a$12$"),true);equal(secret.hash.includes("193750"),false);
  await client.query("update private.senhas_aprovacao set bloqueada_ate=now()-interval '1 second' where usuario_id=$1",[owner]);
  await asUser(owner);
  equal((await rpc("baixar_pagar",[empresa,item.id,null,"193750",settlement])).codigo,"desatualizado");
  equal((await rpc("baixar_pagar",[empresa,item.id,item.versao,"193750",settlement])).codigo,"ok");
  equal((await rpc("baixar_pagar",[empresa,item.id,item.versao,"193750",settlement])).codigo,"estado_invalido");
  item=await record(created.serie_id);equal(item.valor_pago_centavos,"3459");
  equal((await rpc("estornar_pagar",[empresa,item.id,item.versao,"193750","Pagamento errado"])).codigo,"ok");
  equal((await client.query("select tipo from public.baixas_pagar where lancamento_id=$1 order by tipo",[item.id])).rows.map(x=>x.tipo),["baixa","estorno"]);
  item=await record(created.serie_id);
  equal((await rpc("editar_pagar",[empresa,item.id,item.versao,{...data,descricao:"Corrigido",valor_centavos:3500}])).codigo,"ok");
  equal((await rpc("editar_pagar",[empresa,item.id,item.versao,data])).codigo,"desatualizado");
  await denied("update public.categorias set tipo='receita',custo_fixo=false where id=$1",[categoria],["23503"]);
  context="prova OTP de uso único";
  const amr=[{method:"otp",timestamp:Math.floor(Date.now()/1000)}],session_id=randomUUID();
  await asUser(owner,{session_id,amr});equal((await rpc("configurar_aprovacao",["284061",true])).codigo,"ok");
  equal((await rpc("configurar_aprovacao",["193750",true])).codigo,"confirmar_email");
  await asUser(owner,{session_id,amr:[{method:"otp",timestamp:Math.floor(Date.now()/1000)-600}]});equal((await rpc("configurar_aprovacao",["193750",true])).codigo,"confirmar_email");
  await asUser(owner,{user_metadata:{amr}});equal((await rpc("configurar_aprovacao",["193750",true])).codigo,"confirmar_email");
  context="recorrência, arquivo e isolamento";
  const recurring=await rpc("criar_pagar",[empresa,randomUUID(),{...data,modo:"recorrente",vencimento:"2026-10-31"}]);equal(recurring.gerados,12);
  equal((await rpc("expandir_pagar",[empresa])).gerados,0);
  const occurrence=await record(recurring.serie_id);
  equal((await rpc("cancelar_pagar",[empresa,occurrence.id,occurrence.versao,true])).codigo,"ok");
  equal((await rpc("expandir_pagar",[empresa])).gerados,0);
  equal((await client.query("select ativo from public.series_pagar where id=$1",[recurring.serie_id])).rows[0].ativo,false);
  await client.query("update public.fornecedores set ativo=false where id=$1",[fornecedor]);
  equal((await rpc("criar_pagar",[empresa,randomUUID(),data])).codigo,"cadastro_invalido");
  await asUser(outsider);
  const other=(await client.query("select public.criar_empresa('Outra','CPF','52998224725') as id")).rows[0].id;
  equal((await rpc("criar_pagar",[other,randomUUID(),data])).codigo,"cadastro_invalido");
  equal((await rpc("resumo_pagar",[empresa])).aberto,"0");
  await client.query("reset role"); await client.query("set local role anon");
  await denied("select public.status_aprovacao()");
  await client.query("rollback"); console.log(`Contas a Pagar: ${checks} verificações passaram (fixtures revertidas).`);
} catch(error) { try{await client.query("rollback");}catch{} console.error(`Falha em ${context}: ${error.message}`);process.exitCode=1; }
finally {await client.end();}
