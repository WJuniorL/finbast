"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireEmpresa} from "@/lib/empresa";
import {contaBancariaSchema} from "@/lib/bancos";
import type {FormState} from "@/lib/form-state";
const version=z.object({id:z.string().uuid(),atualizado_em:z.iso.datetime({offset:true})});
const errors:Record<string,string>={sem_acesso:"Seu acesso permite somente consultar.",desatualizado:"A conta mudou. Reabra a edição.",indisponivel:"Registro indisponível.",conta_inativa:"A conta está arquivada ou indisponível.",conta_com_extrato:"Após criar uma prévia, somente o nome da conta pode ser alterado. Saldo, data e identificação ficam preservados.",arquivo_invalido:"Confira datas (a partir do saldo inicial, até hoje), valores e identificadores do arquivo.",identificador_conflitante:"Um identificador já existe com dados diferentes. Corrija o arquivo; nenhum movimento foi importado.",ja_conciliado:"Movimento ou lançamento já conciliado.",liquidacao_invalida:"Selecione lançamento já pago ou recebido nesta empresa.",valor_incompativel:"Sinal ou valor do movimento não corresponde ao valor liquidado.",motivo_invalido:"Informe motivo de 5 a 500 caracteres.",ja_desfeita:"Esta conciliação já foi desfeita.",dados_invalidos:"Confira os dados informados."};
function result(data:{codigo?:string}|null,error:{code?:string}|null,success:string):FormState {
 if(error)return {error:error.code==="23505"?"Já existe conta com esse nome.":"Não foi possível concluir. Confira os dados e tente novamente."};
 return data?.codigo==="ok"?{success}:{error:errors[data?.codigo??""]??"Operação não concluída."};
}
export async function saveBank(empresaId:string,_:FormState,form:FormData):Promise<FormState>{
 const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 const parsed=contaBancariaSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return {error:parsed.error.issues[0]?.message};
 const edit=form.get("id")?version.safeParse(Object.fromEntries(form)):null;if(edit&&!edit.success)return {error:errors.desatualizado};
 const {data,error}=await supabase.rpc("salvar_conta_bancaria",{p_empresa:empresa.id,p_id:edit?.success?edit.data.id:null,p_versao:edit?.success?edit.data.atualizado_em:null,p_dados:parsed.data});
 const state=result(data,error,"Conta bancária salva.");if(state.success)revalidatePath(`/empresas/${empresa.id}/bancos`);return state;
}
export async function archiveBank(empresaId:string,_:FormState,form:FormData):Promise<FormState>{
 const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 const parsed=version.extend({ativo:z.enum(["true","false"])}).safeParse(Object.fromEntries(form));if(!parsed.success)return {error:errors.desatualizado};
 const {data,error}=await supabase.rpc("status_conta_bancaria",{p_empresa:empresa.id,p_id:parsed.data.id,p_versao:parsed.data.atualizado_em,p_ativo:parsed.data.ativo==="true"});
 const state=result(data,error,"Situação da conta atualizada.");if(state.success)revalidatePath(`/empresas/${empresa.id}/bancos`,"layout");return state;
}
export async function confirmBankImport(empresaId:string,id:string,_:FormState):Promise<FormState>{
 void _;const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 if(!z.string().uuid().safeParse(id).success)return {error:errors.indisponivel};
 const {data,error}=await supabase.rpc("confirmar_importacao",{p_empresa:empresa.id,p_id:id});
 const state=result(data,error,`Importação concluída: ${data?.importados??0} importado(s), ${data?.ignorados??0} ignorado(s).`);if(state.success)revalidatePath(`/empresas/${empresa.id}/bancos`,"layout");return state;
}
export async function reconcileBank(empresaId:string,movimentoId:string,_:FormState,form:FormData):Promise<FormState>{
 const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 const parsed=z.object({lancamento:z.string().uuid(),tipo:z.enum(["pagar","receber"])}).safeParse(Object.fromEntries(form));
 if(!parsed.success||!z.string().uuid().safeParse(movimentoId).success)return {error:"Escolha um lançamento compatível."};
 const {data,error}=await supabase.rpc("conciliar_movimento",{p_empresa:empresa.id,p_movimento:movimentoId,p_tipo:parsed.data.tipo,p_lancamento:parsed.data.lancamento});
 const state=result(data,error,"Movimento conciliado.");if(state.success)revalidatePath(`/empresas/${empresa.id}/bancos`,"layout");return state;
}
export async function undoBankReconciliation(empresaId:string,id:string,_:FormState,form:FormData):Promise<FormState>{
 const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 const parsed=z.string().trim().min(5).max(500).safeParse(form.get("motivo"));if(!parsed.success||!z.string().uuid().safeParse(id).success)return {error:errors.motivo_invalido};
 const {data,error}=await supabase.rpc("desfazer_conciliacao",{p_empresa:empresa.id,p_id:id,p_motivo:parsed.data});
 const state=result(data,error,"Conciliação desfeita. A baixa original foi preservada.");if(state.success)revalidatePath(`/empresas/${empresa.id}/bancos`,"layout");return state;
}
