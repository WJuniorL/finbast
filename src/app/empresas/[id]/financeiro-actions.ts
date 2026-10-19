"use server";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";

// Captura uma versao atual ao abrir o formulario, antes da confirmacao do usuario.
// As mutacoes ainda comparam essa versao para recusar alteracoes concorrentes.
export async function loadFinanceiro(empresaId:string,tipo:"pagar"|"receber",id:string):Promise<{record?:Record<string,unknown>;error?:string}> {
  if(!z.enum(["pagar","receber"]).safeParse(tipo).success || !z.string().uuid().safeParse(id).success) return {error:"Lançamento inválido."};
  const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit) return {error:"Seu acesso não permite esta operação."};
  const table=tipo==="pagar"?"lancamentos_pagar":"lancamentos_receber";
  const {data,error}=await supabase.from(table).select("*").eq("empresa_id",empresa.id).eq("id",id).maybeSingle();
  if(error || !data) return {error:"Não foi possível abrir o lançamento. Atualize a página e tente novamente."};
  return {record:data};
}
