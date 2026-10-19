"use server";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";

const recursos=["open_finance","boleto_pix","conta_pagamento","painel_contador","assistente_ia"] as const;
const schema=z.object({recurso:z.enum(recursos),origem:z.string().min(1).max(60)});

export async function registrarInteresse(empresaId:string,recurso:string,origem:string):Promise<{ok?:true;error?:string}> {
  const parsed=schema.safeParse({recurso,origem});
  if(!parsed.success) return {error:"Recurso inválido."};
  const {empresa,supabase}=await requireEmpresa(empresaId);
  const {error}=await supabase.rpc("registrar_interesse_demanda",{p_empresa:empresa.id,p_recurso:parsed.data.recurso,p_origem:parsed.data.origem});
  return error?{error:"Não foi possível registrar seu interesse. Tente novamente."}:{ok:true};
}
