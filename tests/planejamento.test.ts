import {test} from "node:test";
import assert from "node:assert/strict";
import {planLineSchema,scenarioSchema,simulatedMonths,planDeviation,type PlanMonth} from "../src/lib/planejamento.ts";
const id="00000000-0000-4000-8000-000000000001";
test("linha de plano preserva centavos, multiplica quantidade exata e valida categoria/mês",()=>{
 const base={descricao:"Ação",tipo:"despesa",categoria_id:id,centro_custo_id:"",mes:"2026-01",valor_unitario_centavos:"1,01",quantidade:"3"};
 const line=planLineSchema.parse(base);assert.equal(line.valor_unitario_centavos,101);assert.equal(line.quantidade,3);assert.equal(line.mes,"2026-01-01");
 for(const input of [{...base,valor_unitario_centavos:"0,00"},{...base,quantidade:0},{...base,valor_unitario_centavos:"10000000000,00",quantidade:2},{...base,mes:"2026-13"},{...base,categoria_id:""}])assert.equal(planLineSchema.safeParse(input).success,false);
});
test("cenários exigem nome, ano válido e identificador de pedido",()=>{
 assert.equal(scenarioSchema.safeParse({nome:"Base",ano:2026,request_id:id}).success,true);
 assert.equal(scenarioSchema.safeParse({nome:"X",ano:2026,request_id:id}).success,false);
 assert.equal(scenarioSchema.safeParse({nome:"Base",ano:2101,request_id:id}).success,false);
});
test("simulação acumula plano sobre o caixa e pode ser desligada sem alterar os dados",()=>{
 const months:PlanMonth[]=[{mes:"2026-01-01",receitas:"1000",despesas:"303",fixos:"0",caixa:"105600",fechado:false},{mes:"2026-02-01",receitas:"0",despesas:"100",fixos:"0",caixa:"200000",fechado:false}];
 assert.deepEqual(simulatedMonths(months,true).map(m=>m.simulado),["106297","200597"]);
 assert.deepEqual(simulatedMonths(months,false).map(m=>m.simulado),["105600","200000"]);assert.equal(months[0].caixa,"105600");
});
test("simulação e desvio não arredondam valores acima da precisão de Number",()=>{
 const months:PlanMonth[]=[{mes:"2026-01-01",receitas:"9007199254740993",despesas:"1",fixos:"0",caixa:"1",fechado:true}];
 assert.equal(simulatedMonths(months,true)[0].simulado,"9007199254740993");
 assert.equal(planDeviation({mes:"2026-01-01",base:"10000",plano:"303",realizado:"10500",fixos:"10000"}),197n);
});
