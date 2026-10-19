import {test} from "node:test";
import assert from "node:assert/strict";
import {parseBps,productSchema,allocationSchema,productPeriodSchema,simulateProduct} from "../src/lib/produtos.ts";
const p={id:"",nome:"Mentoria",custo_unitario_centavos:"1,01",custo_projeto_centavos:"5,00",preco_centavos:"5,00",volume:"3",margem_bps:"20"};
test("produto valida centavos, volume, margem e limite do projeto",()=>{
 const d=productSchema.parse(p);assert.equal(d.custo_unitario_centavos,101);assert.equal(d.margem_bps,2000);
 for(const data of [{...p,volume:0},{...p,margem_bps:"100"},{...p,preco_centavos:"-1"},{...p,custo_unitario_centavos:"10.000.000.000,00",volume:2}])assert.equal(productSchema.safeParse(data).success,false);
});
test("rateio exige exatamente 100%, sem duplicação ou critérios ambíguos",()=>{
 const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002",r={id:"",nome:"Equipe",categoria_id:a,fornecedor_id:"",itens:[{produto_id:a,peso_bps:4000},{produto_id:b,peso_bps:6000}]};
 assert.equal(parseBps("40,25"),4025);assert.equal(allocationSchema.safeParse(r).success,true);
 for(const value of ["100,01","1.5","-1","1,001"])assert.throws(()=>parseBps(value));
 for(const data of [{...r,fornecedor_id:b},{...r,itens:[r.itens[0]]},{...r,itens:[{produto_id:a,peso_bps:5000},{produto_id:a,peso_bps:5000}]}])assert.equal(allocationSchema.safeParse(data).success,false);
});
test("preço alvo e equilíbrio arredondam para cima e preservam centavos",()=>{
 const s=simulateProduct(productSchema.parse(p));assert.deepEqual(s,{receitas:1500n,custos:803n,contribuicao:697n,precoAlvo:335n,equilibrio:2n});
 assert.equal(simulateProduct({...productSchema.parse(p),preco_centavos:101}).equilibrio,null);
 assert.equal(simulateProduct({...productSchema.parse(p),custo_projeto_centavos:0,preco_centavos:101}).equilibrio,0n);
 assert.equal(simulateProduct({...productSchema.parse(p),preco_centavos:0}).contribuicao,-803n);
 assert.throws(()=>simulateProduct({...productSchema.parse(p),margem_bps:10000}));
});
test("simulação usa BigInt acima da precisão de Number e período não excede 366 dias",()=>{
 assert.equal(simulateProduct({custo_unitario_centavos:"9007199254740993",custo_projeto_centavos:1,preco_centavos:"9007199254740994",volume:3,margem_bps:0}).contribuicao,2n);
 assert.equal(productPeriodSchema.safeParse({inicio:"2024-01-01",fim:"2024-12-31",base:"registrado"}).success,true);
 assert.equal(productPeriodSchema.safeParse({inicio:"2026-02-30",fim:"2026-03-01",base:"realizado"}).success,false);
 assert.equal(productPeriodSchema.safeParse({inicio:"2026-01-01",fim:"2027-01-02",base:"registrado"}).success,false);
});
