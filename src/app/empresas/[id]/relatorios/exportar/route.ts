import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import {hojeBahia} from "@/lib/financeiro";
import {parseReportQuery,makeCsv,type ReportData} from "@/lib/relatorios";
import {reportWorkbook,originTable,summaryTable} from "@/lib/report-export";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,{supabase,empresa,user}=await requireEmpresa(id),url=new URL(request.url),q:Record<string,string|string[]>={};
 for(const key of new Set(url.searchParams.keys())){const values=url.searchParams.getAll(key);q[key]=values.length===1?values[0]:values;}
 const parsed=parseReportQuery(q,hojeBahia()),options=z.object({formato:z.enum(["csv","xlsx"]),escopo:z.enum(["relatorio","bruto"]),pedido:z.string().uuid().optional()}).safeParse(q);
 const failure=(message:string,status:number)=>new Response(message,{status,headers:{"Cache-Control":"private, no-store"}});
 if(!parsed.success||!options.success)return failure("Filtros ou formato inválidos.",400);const f=parsed.data,o=options.data,bruto=o.escopo==="bruto";
 if(!bruto&&!o.pedido||bruto&&f.vista==="comparativo")return failure("Pedido inválido para esta exportação.",400);
 const {data,error}=await supabase.rpc("gerar_relatorio",{p_empresa:empresa.id,p_filtros:f,p_pagina:1,p_origens:1,p_exportar:true,p_bruto:bruto});
 if(error)return failure("Não foi possível gerar o arquivo.",500);if(!data)return failure("Recorte indisponível. Confira os filtros.",400);
 const report=data as ReportData;let body:string|Uint8Array;
 if(o.formato==="xlsx")body=await reportWorkbook(report,f,empresa.nome,bruto);else{const table=bruto?originTable(report):summaryTable(report);body=makeCsv(table.columns,table.rows);}
 // Revalida o vínculo após preparar o arquivo; nenhuma credencial administrativa participa.
 const member=await supabase.from("usuarios_empresas").select("usuario_id").eq("empresa_id",empresa.id).eq("usuario_id",user.id).maybeSingle();if(member.error)return failure("Não foi possível confirmar seu acesso.",503);if(!member.data)return failure("Acesso indisponível.",404);
 if(!bruto){const event=await supabase.rpc("registrar_exportacao_relatorio",{p_empresa:empresa.id,p_request:o.pedido,p_formato:o.formato,p_filtros:f});if(event.error||event.data?.codigo!=="ok")return failure("Não foi possível registrar a exportação. Atualize a página.",409);}
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":`attachment; filename="finbast-${bruto?"bruto":f.vista}-${f.inicio}-${f.fim}.${o.formato}"`,"Content-Type":o.formato==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"text/csv; charset=utf-8"};
 return new Response(typeof body==="string"?body:new Uint8Array(body).buffer,{headers});
}
