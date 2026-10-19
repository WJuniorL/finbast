import ExcelJS from "exceljs";
import {decimalCents,REPORT_VIEWS,type ReportData,type ReportFilters,type ReportGroup,type ComparisonRow} from "./relatorios.ts";
export type ExportTable={name:string;columns:string[];rows:string[][]};
export function originTable(data:ReportData):ExportTable{
 return {name:"Origens",columns:["Data","Origem","ID","Natureza","Componente","Grupo DRE","Descrição","Categoria","Centro","Fornecedor","Produto","Documento","Status","Valor filtrado (centavos)","Valor filtrado (R$)","Principal integral origem (centavos)","Juros integrais origem (centavos)","Multa integral origem (centavos)","Desconto integral origem (centavos)","Total integral origem (centavos)"],rows:data.itens.map(i=>[i.dia,i.fonte,i.id,i.natureza,i.componente??"consolidado",i.grupo??"",i.descricao,i.categoria,i.centro,i.fornecedor,i.produto,i.documento??"",i.status,i.valor,decimalCents(i.valor),i.principal_origem,i.juros_origem,i.multa_origem,i.desconto_origem,i.total_origem])};
}
export function summaryTable(data:ReportData):ExportTable{
 if(data.vista==="dre")return {name:"DRE",columns:["Linha","Valor (centavos)","Valor (R$)"],rows:data.dre.map(d=>[d.nome,d.valor,decimalCents(d.valor)])};
 if(data.vista==="comparativo")return {name:"Comparativo",columns:["Mês","Tipo","Categoria","Centro","Fechado","Registrado (centavos)","Plano (centavos)","Planejado R+P (centavos)","Executado (centavos)","Desvio (centavos)"],rows:(data.grupos as ComparisonRow[]).map(g=>[g.mes,g.tipo,g.categoria,g.centro,g.fechado?"Sim":"Não",g.base,g.plano,g.planejado,g.realizado,g.desvio])};
 return {name:"Resumo",columns:["Grupo","Receita (centavos)","Despesa (centavos)","Resultado (centavos)","Diretos (centavos)","Compartilhados (centavos)","Gerais (centavos)","Margem de contribuição (centavos)"],rows:(data.grupos as ReportGroup[]).map(g=>[g.nome,g.receita,g.despesa,g.resultado,g.diretos,g.compartilhados,g.gerais,g.margem])};
}
export async function reportWorkbook(data:ReportData,f:ReportFilters,empresa:string,bruto:boolean){
 const book=new ExcelJS.Workbook();book.creator="Finbast";
 const tables=[{name:"Parâmetros",columns:["Parâmetro","Valor"],rows:[["Empresa",empresa],["Relatório",REPORT_VIEWS[f.vista]],["Base",f.base],["Início",f.inicio],["Fim",f.fim],["Escopo",bruto?"Origens consolidadas":"Relatório formatado"],["Valores","Centavos/reais em texto para preservar precisão"],["Critério","Estado atual; comparativo respeita fotografias de fechamento"],...Object.entries(f).map(([k,v])=>[k,String(v??"")])]},...(bruto?[originTable(data)]:[summaryTable(data),...(data.vista==="comparativo"?[]:[originTable(data)])])];
 for(const table of tables){const sheet=book.addWorksheet(table.name);sheet.addRow(table.columns);sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];
  for(const values of table.rows){const row=sheet.addRow(values);row.eachCell(cell=>{cell.numFmt="@";});}sheet.columns.forEach(col=>{col.width=28;});sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:table.columns.length}};
 }return new Uint8Array(await book.xlsx.writeBuffer());
}
