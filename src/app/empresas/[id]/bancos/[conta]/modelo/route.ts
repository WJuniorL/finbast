import {requireEmpresa} from "@/lib/empresa";
import {z} from "zod";
import ExcelJS from "exceljs";
import {formatDate} from "@/lib/financeiro";
export async function GET(request:Request,{params}:{params:Promise<{id:string;conta:string}>}){
 const {id,conta}=await params;const {supabase,empresa}=await requireEmpresa(id);
 if(!z.string().uuid().safeParse(conta).success)return new Response("Conta inválida",{status:404});
 const {data,error}=await supabase.from("contas_bancarias").select("id,data_saldo_inicial").eq("empresa_id",empresa.id).eq("id",conta).maybeSingle();if(error)return new Response("Falha ao carregar conta",{status:500});if(!data)return new Response("Conta indisponível",{status:404});
 const exampleDate=formatDate(data.data_saldo_inicial);
 const format=new URL(request.url).searchParams.get("formato");
 const headers={"Cache-Control":"private, no-store","Content-Disposition":`attachment; filename="modelo-extrato.${format==="xlsx"?"xlsx":"csv"}"`};
 if(format==="xlsx"){
  const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Extrato");sheet.addRow(["data","descricao","valor","identificador"]);sheet.addRow([exampleDate,"Recebimento teste","200,00","exemplo-entrada"]);sheet.addRow([exampleDate,"Pagamento teste","-100,00","exemplo-saida"]);sheet.columns.forEach(col=>{col.width=25;});
  return new Response(new Uint8Array(await workbook.xlsx.writeBuffer()),{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});
 }
 return new Response(`\uFEFFdata;descricao;valor;identificador\r\n${exampleDate};Recebimento teste;200,00;exemplo-entrada\r\n${exampleDate};Pagamento teste;-100,00;exemplo-saida\r\n`,{headers:{...headers,"Content-Type":"text/csv; charset=utf-8"}});
}
