"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEmpresa } from "@/lib/empresa";
import { recebimentoSchema, receberSchema } from "@/lib/receber";
import type { FormState } from "@/lib/form-state";

const versionSchema=z.object({id:z.string().uuid(),atualizado_em:z.iso.datetime({offset:true})});
const messages:Record<string,string>={sem_acesso:"Seu acesso não permite esta operação.",indisponivel:"Lançamento indisponível.",desatualizado:"Este lançamento mudou. Atualize a página e abra novamente.",estado_invalido:"A situação do lançamento não permite esta operação.",cadastro_invalido:"Escolha cliente, categoria de receita e centro de custo ativos desta empresa.",pedido_alterado:"Este pedido já foi enviado com outros dados. Atualize a página.",valor_invalido:"Confira os valores e a data do recebimento.",motivo_invalido:"Informe um motivo com pelo menos cinco caracteres."};
function result(data:{codigo?:string}|null,error:unknown,success:string):FormState {
  if(error && typeof error==="object" && "code" in error && error.code==="23514") return {error:"Desfaça a conciliação bancária antes de alterar este recebimento."};
  if(error || !data) return {error:"Não foi possível concluir agora. Confira os dados e tente novamente."};
  return data.codigo==="ok" ? {success} : {error:messages[data.codigo??""]??"Operação não concluída."};
}
function refresh(id:string,state:FormState) { if(state.success) revalidatePath(`/empresas/${id}/receber`); return state; }

export async function saveReceber(empresaId:string,_:FormState,form:FormData):Promise<FormState> {
  const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit) return {error:messages.sem_acesso};
  const parsed=receberSchema.safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:parsed.error.issues[0]?.message};
  if(form.get("id")) {
    const version=versionSchema.safeParse(Object.fromEntries(form));
    if(!version.success) return {error:messages.desatualizado};
    const {data,error}=await supabase.rpc("editar_receber",{p_empresa:empresa.id,p_id:version.data.id,p_versao:version.data.atualizado_em,p_dados:parsed.data});
    return refresh(empresa.id,result(data,error,"Lançamento atualizado. A alteração vale somente para esta ocorrência."));
  }
  const request=z.string().uuid().safeParse(form.get("request_id"));
  if(!request.success) return {error:"Atualize a página antes de criar o lançamento."};
  const {data,error}=await supabase.rpc("criar_receber",{p_empresa:empresa.id,p_request:request.data,p_dados:parsed.data});
  return refresh(empresa.id,result(data,error,"Lançamento criado."));
}
export async function changeReceber(empresaId:string,operation:"cancelar"|"interromper"|"baixar"|"estornar",_:FormState,form:FormData):Promise<FormState> {
  const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit || !["cancelar","interromper","baixar","estornar"].includes(operation)) return {error:messages.sem_acesso};
  const version=versionSchema.safeParse(Object.fromEntries(form));
  if(!version.success) return {error:messages.desatualizado};
  const common={p_empresa:empresa.id,p_id:version.data.id,p_versao:version.data.atualizado_em};
  if(operation==="cancelar" || operation==="interromper") {
    const {data,error}=await supabase.rpc("cancelar_receber",{...common,p_serie:operation==="interromper"});
    return refresh(empresa.id,result(data,error,operation==="interromper"?"Recorrência interrompida. Ocorrências futuras em aberto foram canceladas.":"Lançamento cancelado."));
  }
  if(operation==="baixar") {
    const parsed=recebimentoSchema.safeParse(Object.fromEntries(form));
    if(!parsed.success) return {error:parsed.error.issues[0]?.message};
    const {id:unusedId,atualizado_em:unusedVersion,...dados}=parsed.data;
    void unusedId;void unusedVersion;
    const {data,error}=await supabase.rpc("baixar_receber",{...common,p_dados:dados});
    return refresh(empresa.id,result(data,error,"Recebimento manual registrado."));
  }
  const parsed=z.object({motivo:z.string().trim().min(5).max(500)}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Informe um motivo com pelo menos cinco caracteres."};
  const {data,error}=await supabase.rpc("estornar_receber",{...common,p_motivo:parsed.data.motivo});
  return refresh(empresa.id,result(data,error,"Recebimento desfeito. O lançamento voltou a ficar em aberto."));
}
export async function expandReceber(empresaId:string,_:FormState):Promise<FormState> {
  void _;
  const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit) return {error:messages.sem_acesso};
  const {data,error}=await supabase.rpc("expandir_receber",{p_empresa:empresa.id});
  return refresh(empresa.id,result(data,error,`${data?.gerados??0} ocorrência(s) gerada(s). ${data?.bloqueadas??0} recorrência(s) com cadastro arquivado precisam de revisão.`));
}
