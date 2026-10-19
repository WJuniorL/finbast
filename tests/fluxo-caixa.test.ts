import {test} from "node:test";
import assert from "node:assert/strict";
import {cashTotals,groupCashDays,type CashDay} from "../src/lib/fluxo-caixa.ts";
const day=(data:string,entradas:string,saldo:string):CashDay=>({data,abertura:"0",entradas,saidas:"100",previstas_entradas:"50",previstas_saidas:"0",saldo_realizado:saldo,saldo_projetado:saldo});
test("fluxo mensal soma movimentos mas preserva a última posição de saldo",()=>{
 const days=[day("2026-01-30","200","1000"),day("2026-01-31","300","1200"),day("2026-02-01","400","1500")];
 const groups=groupCashDays(days,true);assert.equal(groups.length,2);assert.equal(groups[0].entradas,"500");assert.equal(groups[0].saidas,"200");assert.equal(groups[0].saldo_realizado,"1200");assert.equal(groups[1].saldo_realizado,"1500");assert.equal(days[0].entradas,"200");
});
test("fluxo agrega centavos acima da precisão de Number sem arredondar",()=>{
 const days=[day("2026-01-30","9007199254740993","-1"),day("2026-01-31","2","1")];
 assert.equal(cashTotals(days).entradas,9007199254740995n);assert.equal(groupCashDays(days,true)[0].entradas,"9007199254740995");
});
test("fluxo diário e período vazio preservam os valores",()=>{
 const days=[day("2026-01-31","1","0")];assert.deepEqual(groupCashDays(days,false),days);assert.deepEqual(groupCashDays([],true),[]);assert.equal(cashTotals([]).saidas,0n);
});
