import {test} from "node:test";
import assert from "node:assert/strict";
import {receberSchema,recebimentoSchema} from "../src/lib/receber.ts";
const id="00000000-0000-4000-8000-000000000001";
const data={descricao:"Venda",documento:"",cliente_id:id,categoria_id:id,centro_custo_id:"",valor_centavos:"100,01",vencimento:"2026-01-31",modo:"parcelado",parcelas:3};
test("receitas exigem cliente e permitem centavos exatos e referências opcionais",()=>{
  const parsed=receberSchema.parse({...data,status:"recebido",empresa_id:id,custo_fixo_override:true});
  assert.equal(parsed.valor_centavos,10001);assert.equal(parsed.documento,null);assert.equal(parsed.centro_custo_id,null);
  assert.equal("status" in parsed,false);assert.equal("empresa_id" in parsed,false);assert.equal("custo_fixo_override" in parsed,false);
  assert.equal(receberSchema.safeParse({...data,cliente_id:""}).success,false);
  assert.equal(receberSchema.safeParse({...data,valor_centavos:"0,02"}).success,false);
});
test("recebimento manual dispensa PIN e valida data e encargos",()=>{
  const receipt={id,atualizado_em:"2026-01-31T12:00:00.000Z",recebido_em:"2026-01-31",juros_centavos:"2,00",multa_centavos:"0,00",desconto_centavos:"1,25",observacao:""};
  const parsed=recebimentoSchema.parse({...receipt,senha:"qualquer",valor_recebido_centavos:99999});
  assert.equal(parsed.juros_centavos,200);assert.equal(parsed.desconto_centavos,125);assert.equal("senha" in parsed,false);assert.equal("valor_recebido_centavos" in parsed,false);
  assert.equal(recebimentoSchema.safeParse({...receipt,recebido_em:"2100-01-01"}).success,false);
  assert.equal(recebimentoSchema.safeParse({...receipt,desconto_centavos:"-1,00"}).success,false);
});
