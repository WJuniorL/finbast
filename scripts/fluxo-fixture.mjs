import {randomUUID} from "node:crypto";
// Dados sintéticos compartilhados por testes de banco e navegador. O chamador
// controla a transação e remove a empresa/usuários ao terminar.
export async function fixtureRpc(db,name,args) {
 if(!/^[a-z_]+$/.test(name))throw new Error("RPC de teste inválida.");
 return (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args.map(v=>Array.isArray(v)?JSON.stringify(v):v))).rows[0].result;
}
export async function cashFixture(db,owner) {
 await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);await db.query("set local role authenticated");
 const empresa=(await db.query("select public.criar_empresa('Fluxo teste','CPF','52998224725') as id")).rows[0].id;
 await db.query("reset role");
 const expense=(await db.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Despesa','despesa') returning id",[empresa])).rows[0].id;
 const revenue=(await db.query("insert into public.categorias(empresa_id,nome,tipo) values($1,'Receita','receita') returning id",[empresa])).rows[0].id;
 const supplier=(await db.query("insert into public.fornecedores(empresa_id,nome) values($1,'Fornecedor') returning id",[empresa])).rows[0].id;
 const customer=(await db.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente') returning id",[empresa])).rows[0].id;
 await db.query("set local role authenticated");
 const rpc=(name,args)=>fixtureRpc(db,name,args);
 const bank=async(nome,saldo,data)=> (await rpc("salvar_conta_bancaria",[empresa,null,null,{nome,banco:"Banco Teste",numero:nome,saldo_inicial_centavos:saldo,data_saldo_inicial:data}])).id;
 const conta=await bank("Banco Principal",100000,"2026-01-01"),segunda=await bank("Banco Arquivado",-5000,"2026-01-20");
 const version=(await db.query("select atualizado_em::text as version from public.contas_bancarias where id=$1",[segunda])).rows[0].version;
 await rpc("status_conta_bancaria",[empresa,segunda,version,false]);
 async function title(tipo,descricao,valor,vencimento,liquidacao=null,juros=0,desconto=0) {
  const data={descricao,documento:null,centro_custo_id:null,valor_centavos:valor,vencimento,modo:"unica",parcelas:1,
   ...(tipo==="pagar"?{fornecedor_id:supplier,categoria_id:expense,custo_fixo_override:null}:{cliente_id:customer,categoria_id:revenue})};
  const serie=await rpc(`criar_${tipo}`,[empresa,randomUUID(),data]);if(serie.codigo!=="ok")throw new Error("Falha no título sintético.");
  const row=(await db.query(`select id,atualizado_em::text as version from public.lancamentos_${tipo} where serie_id=$1`,[serie.serie_id])).rows[0];
  if(liquidacao){
   const args=[empresa,row.id,row.version];if(tipo==="pagar")args.push("193750");
   args.push({[tipo==="pagar"?"pago_em":"recebido_em"]:liquidacao,juros_centavos:juros,multa_centavos:0,desconto_centavos:desconto});
   if((await rpc(`baixar_${tipo}`,args)).codigo!=="ok")throw new Error("Falha na baixa sintética.");
  }
  return row;
 }
 await rpc("configurar_aprovacao",["193750",false]);
 const pagar=await title("pagar","Pagamento conciliado",10000,"2026-01-30","2026-01-30",1000,500);
 const receber=await title("receber","Recebimento conciliado",20000,"2026-01-30","2026-01-30");
 await title("receber","Recebimento sem conciliação",3000,"2026-01-29","2026-01-29");
 await title("receber","Recebimento anterior",400,"2026-01-10","2026-01-10");
 const aberto=await title("pagar","Pagamento previsto",2500,"2026-01-31");
 await title("receber","Recebimento previsto",8000,"2026-02-02");
 await title("pagar","Pagamento vencido anterior",700,"2026-01-15");
 await title("receber","Recebimento vencido anterior",900,"2026-01-15");
 for(const tipo of ["pagar","receber"]){const cancelado=await title(tipo,`Cancelado ${tipo}`,99999,"2026-01-31");await rpc(`cancelar_${tipo}`,[empresa,cancelado.id,cancelado.version,false]);}
 const preview=await rpc("previa_importacao",[empresa,conta,"teste.csv","csv","a".repeat(64),[
  {chave:"id:saida",data_movimento:"2026-01-31",descricao:"Saída no extrato",valor_centavos:-10500},
  {chave:"id:entrada",data_movimento:"2026-01-31",descricao:"Entrada no extrato",valor_centavos:20000},
 ]]);await rpc("confirmar_importacao",[empresa,preview.id]);
 const movimentos=(await db.query("select id,valor_centavos from public.lancamentos_importados where conta_id=$1",[conta])).rows;
 const debito=movimentos.find(m=>Number(m.valor_centavos)<0).id,credito=movimentos.find(m=>Number(m.valor_centavos)>0).id;
 const conciliacao=(await rpc("conciliar_movimento",[empresa,debito,"pagar",pagar.id])).id;
 await rpc("conciliar_movimento",[empresa,credito,"receber",receber.id]);
 return {empresa,conta,segunda,pagar,receber,aberto,debito,credito,conciliacao,title};
}
