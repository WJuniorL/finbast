import {test} from "node:test";
import assert from "node:assert/strict";
import {cashChart,dashboardMonthSchema} from "../src/lib/dashboard.ts";
import type {CashDay} from "../src/lib/fluxo-caixa.ts";
const day=(saldo:string):CashDay=>({data:"2026-01-01",abertura:"0",entradas:"0",saidas:"0",previstas_entradas:"0",previstas_saidas:"0",saldo_realizado:saldo,saldo_projetado:saldo});
test("Dashboard valida meses e recusa filtros ambíguos ou fora do intervalo",()=>{
 for(const month of ["2000-01","2026-02","2100-12"])assert.equal(dashboardMonthSchema.safeParse(month).success,true);
 for(const month of ["1999-12","2101-01","2026-00","2026-13","2026-2","2026-01-01",["2026-01","2026-02"]])assert.equal(dashboardMonthSchema.safeParse(month).success,false);
});
test("gráfico normaliza valores negativos e acima da precisão de Number em coordenadas limitadas",()=>{
 const chart=cashChart([day("-9007199254740993"),day("0"),day("9007199254740993")]);
 assert.deepEqual(chart.points.map(p=>p.realizado),[176,100,24]);assert.deepEqual(chart.points.map(p=>p.x),[32,320,608]);assert.equal(chart.zero,100);
});
test("gráfico com zeros, apenas um dia ou nenhuma ocorrência não divide por zero",()=>{
 assert.deepEqual(cashChart([day("0")]).points,[{x:32,realizado:176,projetado:176}]);assert.deepEqual(cashChart([]).points,[]);
});
