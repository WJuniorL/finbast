import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCentavos, splitCentavos, monthlyDate, strongPin, formatCentavos, pagarSchema, canSettlePagar } from "../src/lib/pagar.ts";

test("valores brasileiros usam centavos exatos e rejeitam formatos ambíguos",()=>{
  assert.equal(parseCentavos("1.234,56"),123456);
  assert.equal(parseCentavos("0,01"),1);
  assert.equal(parseCentavos("10000000000,00"),1_000_000_000_000);
  for(const value of ["1.23","-1","1,234","NaN","10000000000,01"]) assert.throws(()=>parseCentavos(value));
  assert.equal(formatCentavos(10001),"R$ 100,01");
});
test("parcelamento preserva o total e distribui os centavos nas primeiras parcelas",()=>{
  assert.deepEqual(splitCentavos(10000,3),[3334,3333,3333]);
  for(const count of [2,3,12,120]) for(const total of [121,10000,1_000_000_000_000]) {
    const values=splitCentavos(total,count);
    assert.equal(values.reduce((sum,value)=>sum+BigInt(value),0n),BigInt(total));
    assert.ok(Math.max(...values)-Math.min(...values)<=1);
  }
  assert.throws(()=>splitCentavos(2,3));
});
test("vencimento mensal mantém o dia original após fevereiro",()=>{
  assert.equal(monthlyDate("2026-01-31",1),"2026-02-28");
  assert.equal(monthlyDate("2026-01-31",2),"2026-03-31");
  assert.equal(monthlyDate("2028-01-31",1),"2028-02-29");
});
test("aprovação exige seis dígitos distintos fora de sequências",()=>{
  assert.ok(strongPin("193750"));
  for(const value of ["123456","654321","789012","210987","193751","12345","abcdef"]) assert.equal(strongPin(value),false,value);
  assert.equal(canSettlePagar("contador_completo"),false);
  assert.equal(canSettlePagar("operador"),true);
});
test("lançamento valida pelo menos um centavo por parcela",()=>{
  const ref="00000000-0000-4000-8000-000000000001";
  const data={descricao:"Compra",documento:"",fornecedor_id:ref,categoria_id:ref,centro_custo_id:"",valor_centavos:"0,02",vencimento:"2026-01-31",modo:"parcelado",parcelas:3,custo_fixo_override:"categoria"};
  assert.equal(pagarSchema.safeParse(data).success,false);
  assert.equal(pagarSchema.safeParse({...data,valor_centavos:"100,00"}).success,true);
});
