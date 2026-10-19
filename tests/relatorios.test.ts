import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import {parseReportQuery,reportParams,decimalCents,csvCell,makeCsv,type ReportData} from "../src/lib/relatorios.ts";
import {reportWorkbook,summaryTable} from "../src/lib/report-export.ts";
const parse=(q:Record<string,string|string[]|undefined>)=>parseReportQuery(q,"2026-10-15");
test("relatórios validam período, filtros repetidos e dimensões",()=>{
 const result=parse({inicio:"2024-01-01",fim:"2024-12-31",centro:"sem"});assert.equal(result.success,true);
 for(const q of [{inicio:"2026-02-30"},{inicio:"2026-01-01",fim:"2027-01-02"},{base:"competencia"},{produto:"injetado"},{inicio:["2026-01-01","2025-01-01"]},{subcategorias:"false"}])assert.equal(parse(q).success,false);
 if(result.success){const repeated=parse(Object.fromEntries(reportParams(result.data)));assert.equal(repeated.success,true);if(repeated.success)assert.deepEqual(repeated.data,result.data);}
});
test("comparativo exige cenário e meses completos; encargos exigem realizado",()=>{
 const cenario="00000000-0000-4000-8000-000000000001",f={vista:"comparativo",cenario,inicio:"2026-01-01",fim:"2026-01-31"};
 assert.equal(parse(f).success,true);for(const q of [{...f,inicio:"2026-01-02"},{...f,fim:"2026-01-30"},{...f,cenario:""},{...f,produto:"sem"}])assert.equal(parse(q).success,false);
 assert.equal(parse({vista:"encargos",base:"registrado"}).success,false);assert.equal(parse({vista:"encargos",base:"realizado"}).success,true);
});
test("CSV preserva campos com delimitadores e neutraliza fórmulas após controles",()=>{
 const values=['=HYPERLINK("https://invalid")',' \t+1','\r\n@SUM(1)','-1+1','Nome; "Teste"\nOutra linha','Seguro'];
 const csv=makeCsv(["Campo"],values.map(v=>[v]));assert.equal(csv.startsWith("\uFEFF"),true);const rows=Papa.parse<string[]>(csv,{delimiter:";",skipEmptyLines:true}).data;
 assert.deepEqual(rows.slice(1).map(r=>r[0]),values.map((v,i)=>i<4?`'${v}`:v));assert.equal(csvCell("=1\0"),'"\'=1"');assert.equal(csvCell("-101"),'"-101"');assert.equal(csvCell("-1,01"),'"-1,01"');
});
test("valores exportados mantêm centavos negativos e acima da precisão de Number",()=>{
 assert.equal(decimalCents("10001000000000001"),"100010000000000,01");assert.equal(decimalCents("-101"),"-1,01");assert.equal(decimalCents("0"),"0,00");
 const data={vista:"dre",dre:[{chave:"resultado",nome:"Resultado gerencial",valor:"10001000000000001"}],grupos:[],itens:[],total_grupos:0,total_itens:0} satisfies ReportData;
 assert.deepEqual(summaryTable(data).rows,[["Resultado gerencial","10001000000000001","100010000000000,01"]]);
});
test("XLSX guarda texto exato e não transforma nomes em fórmulas ou hyperlinks",async()=>{
 const f=parse({});assert.equal(f.success,true);if(!f.success)return;
 const data={vista:"dre",dre:[{chave:"resultado",nome:"=1+1",valor:"-10001000000000001"}],grupos:[],itens:[],total_grupos:0,total_itens:0} satisfies ReportData;
 const bytes=await reportWorkbook(data,f.data,"=HYPERLINK(\"https://invalid\")",false),book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(bytes) as never);
 assert.equal(book.getWorksheet("DRE")!.getCell("A2").type,ExcelJS.ValueType.String);assert.equal(book.getWorksheet("DRE")!.getCell("A2").value,"=1+1");assert.equal(book.getWorksheet("DRE")!.getCell("B2").value,"-10001000000000001");assert.equal(book.getWorksheet("DRE")!.getCell("C2").value,"-100010000000000,01");assert.equal(book.getWorksheet("Parâmetros")!.getCell("B2").type,ExcelJS.ValueType.String);assert.equal(book.getWorksheet("Origens")!.rowCount,1);
});
