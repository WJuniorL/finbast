"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEmpresa } from "@/lib/empresa";
import { baixaSchema, canSettlePagar, pagarSchema, pinSchema } from "@/lib/pagar";
import type { FormState } from "@/lib/form-state";

const versionSchema=z.object({id:z.string().uuid(),atualizado_em:z.iso.datetime({offset:true})});
const messages:Record<string,string>={sem_acesso:"Seu acesso não permite esta operação.",indisponivel:"Lançamento indisponível.",desatualizado:"Este lançamento mudou. Atualize a página e abra novamente.",estado_invalido:"A situação do lançamento não permite esta operação.",cadastro_invalido:"Escolha fornecedor, categoria de despesa e centro de custo ativos desta empresa.",pedido_alterado:"Este pedido já foi enviado com outros dados. Atualize a página.",nao_configurada:"Configure sua senha de aprovação antes da baixa.",ja_configurada:"Sua senha já está configurada.",senha_invalida:"Senha de aprovação incorreta.",bloqueada:"Senha bloqueada por 15 minutos após cinco tentativas incorretas.",confirmar_email:"Confirme um novo código enviado ao seu e-mail para trocar a senha.",pin_fraco:"Use seis dígitos diferentes, sem sequência.",valor_invalido:"Confira os valores e a data do pagamento.",motivo_invalido:"Informe um motivo com pelo menos cinco caracteres."};
function result(data:{codigo?:string}|null,error:unknown,success:string):FormState {
  if(error && typeof error==="object" && "code" in error && error.code==="23514") return {error:"Desfaça a conciliação bancária antes de alterar esta baixa."};
  if(error || !data) return {error:"Não foi possível concluir agora. Confira os dados e tente novamente."};
  return data.codigo==="ok" ? {success} : {error:messages[data.codigo??""]??"Operação não concluída."};
}
function refresh(id:string,state:FormState) { if(state.success) revalidatePath(`/empresas/${id}/pagar`); return state; }

export async function savePagar(empresaId:string,_:FormState,form:FormData):Promise<FormState> {
  const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit) return {error:messages.sem_acesso};
  const parsed=pagarSchema.safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:parsed.error.issues[0]?.message};
  if(form.get("id")) {
    const version=versionSchema.safeParse(Object.fromEntries(form));
    if(!version.success) return {error:messages.desatualizado};
    const {data,error}=await supabase.rpc("editar_pagar",{p_empresa:empresa.id,p_id:version.data.id,p_versao:version.data.atualizado_em,p_dados:parsed.data});
    return refresh(empresa.id,result(data,error,"Lançamento atualizado. A alteração vale somente para esta ocorrência."));
  }
  const request=z.string().uuid().safeParse(form.get("request_id"));
  if(!request.success) return {error:"Atualize a página antes de criar o lançamento."};
  const {data,error}=await supabase.rpc("criar_pagar",{p_empresa:empresa.id,p_request:request.data,p_dados:parsed.data});
  return refresh(empresa.id,result(data,error,"Lançamento criado."));
}
export async function changePagar(empresaId:string,operation:"cancelar"|"interromper"|"baixar"|"estornar",_:FormState,form:FormData):Promise<FormState> {
  const {supabase,empresa,canEdit,papel}=await requireEmpresa(empresaId);
  if(!canEdit || !["cancelar","interromper","baixar","estornar"].includes(operation)) return {error:messages.sem_acesso};
  const version=versionSchema.safeParse(Object.fromEntries(form));
  if(!version.success) return {error:messages.desatualizado};
  const common={p_empresa:empresa.id,p_id:version.data.id,p_versao:version.data.atualizado_em};
  if(operation==="cancelar" || operation==="interromper") {
    const {data,error}=await supabase.rpc("cancelar_pagar",{...common,p_serie:operation==="interromper"});
    return refresh(empresa.id,result(data,error,operation==="interromper"?"Recorrência interrompida. Ocorrências futuras em aberto foram canceladas.":"Lançamento cancelado."));
  }
  if(!canSettlePagar(papel)) return {error:messages.sem_acesso};
  if(operation==="baixar") {
    const parsed=baixaSchema.safeParse(Object.fromEntries(form));
    if(!parsed.success) return {error:parsed.error.issues[0]?.message};
    const {senha,id:unusedId,atualizado_em:unusedVersion,...dados}=parsed.data;
    void unusedId;void unusedVersion;
    const {data,error}=await supabase.rpc("baixar_pagar",{...common,p_pin:senha,p_dados:dados});
    return refresh(empresa.id,result(data,error,"Baixa manual registrada."));
  }
  const parsed=z.object({senha:z.string().regex(/^\d{6}$/),motivo:z.string().trim().min(5).max(500)}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Informe a senha de seis dígitos e um motivo com pelo menos cinco caracteres."};
  const {data,error}=await supabase.rpc("estornar_pagar",{...common,p_pin:parsed.data.senha,p_motivo:parsed.data.motivo});
  return refresh(empresa.id,result(data,error,"Baixa desfeita. O lançamento voltou a ficar em aberto."));
}
export async function configureApproval(empresaId:string,trocar:boolean,_:FormState,form:FormData):Promise<FormState> {
  const {supabase,empresa,papel,user}=await requireEmpresa(empresaId);
  if(!canSettlePagar(papel)) return {error:messages.sem_acesso};
  const pin=pinSchema.safeParse(form.get("senha"));
  if(!pin.success) return {error:pin.error.issues[0]?.message};
  if(pin.data!==form.get("confirmacao")) return {error:"As senhas não coincidem."};
  if(trocar) {
    const code=z.string().regex(/^\d{6,10}$/).safeParse(form.get("codigo"));
    if(!code.success || !user.email) return {error:"Informe o código recebido por e-mail."};
    const {data,error}=await supabase.auth.verifyOtp({email:user.email,token:code.data,type:"email"});
    if(error || data.user?.id!==user.id) return {error:"Código inválido ou expirado. Solicite um novo código."};
  }
  const {data,error}=await supabase.rpc("configurar_aprovacao",{p_pin:pin.data,p_trocar:trocar});
  return refresh(empresa.id,result(data,error,trocar?"Senha de aprovação alterada.":"Senha de aprovação configurada."));
}
export async function requestApprovalCode(empresaId:string,_:FormState):Promise<FormState> {
  void _;
  const {supabase,user,papel}=await requireEmpresa(empresaId);
  if(!canSettlePagar(papel) || !user.email) return {error:messages.sem_acesso};
  const {error}=await supabase.auth.signInWithOtp({email:user.email,options:{shouldCreateUser:false}});
  return error ? {error:"Não foi possível enviar o código. Aguarde um minuto e tente novamente."} : {success:"Código enviado ao seu e-mail."};
}
export async function expandPagar(empresaId:string,_:FormState):Promise<FormState> {
  void _;
  const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);
  if(!canEdit) return {error:messages.sem_acesso};
  const {data,error}=await supabase.rpc("expandir_pagar",{p_empresa:empresa.id});
  return refresh(empresa.id,result(data,error,`${data?.gerados??0} ocorrência(s) gerada(s). ${data?.bloqueadas??0} recorrência(s) com cadastro arquivado precisam de revisão.`));
}
