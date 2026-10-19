import {z} from "zod";
import {dateSchema} from "./financeiro.ts";
export const DRE_GROUPS={receita:"Receita bruta",deducoes:"Deduções da receita",custos:"Custos",operacionais:"Despesas operacionais",financeiro:"Resultado financeiro",tributos:"Tributos sobre o resultado"} as const;
export const REPORT_VIEWS={dre:"DRE gerencial",categoria:"Por categoria e subcategoria",centro:"Por centro de custo",fornecedor:"Gasto por fornecedor / funcionário",produto:"Custo por produto",encargos:"Juros, multas e descontos",comparativo:"Planejado × realizado"} as const;
const nullable=z.union([z.string().uuid(),z.literal("")]).transform(v=>v||null),dimension=z.union([z.string().uuid(),z.literal("sem"),z.literal("")]).transform(v=>v||null);
export const reportSchema=z.object({inicio:dateSchema,fim:dateSchema,base:z.enum(["registrado","realizado"]),vista:z.enum(["dre","categoria","centro","fornecedor","produto","encargos","comparativo"]),categoria:nullable,subcategorias:z.boolean(),centro:dimension,produto:dimension,fornecedor:dimension,grupo:z.union([z.enum(["receita","deducoes","custos","operacionais","financeiro","tributos"]),z.literal("")]).transform(v=>v||null),componente:z.union([z.enum(["principal","juros","multa","desconto"]),z.literal("")]).transform(v=>v||null),cenario:nullable}).superRefine((d,ctx)=>{
 const days=(Date.parse(d.fim)-Date.parse(d.inicio))/86400000;if(days<0||days>365)ctx.addIssue({code:"custom",message:"Use um período inclusivo de até 366 dias."});
 if(d.vista==="encargos"&&d.base!=="realizado")ctx.addIssue({code:"custom",message:"Juros e encargos exigem a base Realizado."});
 if(d.vista==="comparativo"){
  if(!d.cenario)ctx.addIssue({code:"custom",message:"Selecione um cenário para comparar."});
  if(d.produto||d.fornecedor||d.grupo||d.componente)ctx.addIssue({code:"custom",message:"O comparativo aceita filtros de categoria e centro. Limpe os demais filtros."});
  const last=new Date(Date.UTC(Number(d.fim.slice(0,4)),Number(d.fim.slice(5,7)),0)).getUTCDate();if(d.inicio.slice(8)!=="01"||Number(d.fim.slice(8))!==last)ctx.addIssue({code:"custom",message:"O comparativo exige meses completos do ano do cenário."});
 }
});
export type ReportFilters=z.infer<typeof reportSchema>;
export type ReportQuery=Record<string,string|string[]|undefined>;
export function parseReportQuery(q:ReportQuery,today:string){
 const keys=["inicio","fim","base","vista","categoria","subcategorias","centro","produto","fornecedor","grupo","componente","cenario"];
 if(keys.some(k=>Array.isArray(q[k])))return {success:false as const,error:"Não repita parâmetros de filtro."};
 const raw={inicio:q.inicio??`${today.slice(0,4)}-01-01`,fim:q.fim??`${today.slice(0,4)}-12-31`,base:q.base??"registrado",vista:q.vista??"dre",categoria:q.categoria??"",subcategorias:q.subcategorias!=="0",centro:q.centro??"",produto:q.produto??"",fornecedor:q.fornecedor??"",grupo:q.grupo??"",componente:q.componente??"",cenario:q.cenario??""};
 if(q.subcategorias!==undefined&&!['0','1'].includes(String(q.subcategorias)))return {success:false as const,error:"Filtro de subcategorias inválido."};
 const parsed=reportSchema.safeParse(raw);return parsed.success?{success:true as const,data:parsed.data}:{success:false as const,error:parsed.error.issues[0]?.message??"Filtros inválidos."};
}
export function reportParams(f:ReportFilters){const q=new URLSearchParams();for(const [k,v] of Object.entries(f))if(v!==null)q.set(k,typeof v==="boolean"?(v?"1":"0"):v);return q;}
export type DreLine={chave:string;nome:string;valor:string};
export type ReportGroup={chave:string;nome:string;receita:string;despesa:string;resultado:string;diretos:string;compartilhados:string;gerais:string;margem:string};
export type ComparisonRow={tipo:string;categoria_id:string;centro_custo_id:string|null;mes:string;categoria:string;centro:string;base:string;plano:string;realizado:string;planejado:string;desvio:string;fechado:boolean};
export type ReportItem={id:string;fonte:string;produto_id?:string|null;natureza:string;componente?:string;grupo?:string;descricao:string;dia:string;valor:string;tipo_custo?:string;categoria:string;centro:string;fornecedor:string;produto:string;documento:string|null;status:string;principal_origem:string;juros_origem:string;multa_origem:string;desconto_origem:string;total_origem:string};
export type ReportData={vista:ReportFilters["vista"];total_grupos:number;total_itens:number;receita?:string;despesa?:string;resultado?:string;dre:DreLine[];grupos:(ReportGroup|ComparisonRow)[];itens:ReportItem[]};
export const reportPage=(v:unknown)=>typeof v==="string"&&/^\d+$/.test(v)?Math.max(1,Math.min(1000000,Number(v))):1;
export function decimalCents(input:string){const n=BigInt(input),abs=n<0n?-n:n;return `${n<0n?"-":""}${abs/100n},${String(abs%100n).padStart(2,"0")}`;}
// CSV é texto não confiável quando aberto por planilhas. Protege também fórmulas após espaços/controles.
export function csvCell(value:string){const clean=value.replaceAll("\0","");const numericNegative=/^-\d+(?:,\d+)?$/.test(clean);const safe=!numericNegative&&/^[\s\u0001-\u001f]*[=+@-]/u.test(clean)?`'${clean}`:clean;return `"${safe.replaceAll('"','""')}"`;}
export function makeCsv(columns:string[],rows:string[][]){return "\uFEFF"+[columns,...rows].map(row=>row.map(csvCell).join(";")).join("\r\n")+"\r\n";}
