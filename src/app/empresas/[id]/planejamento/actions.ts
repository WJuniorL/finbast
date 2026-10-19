"use server";
import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {requireEmpresa} from "@/lib/empresa";
import {scenarioSchema,planLineSchema} from "@/lib/planejamento";
import type {FormState} from "@/lib/form-state";
export type PlanState=FormState&{link?:string};
const errors:Record<string,string>={sem_acesso:"Seu acesso permite somente consultar.",desatualizado:"O cenário mudou. Atualize a página e reabra a edição.",indisponivel:"Registro indisponível.",arquivado:"Reative o cenário antes de alterar.",mes_fechado:"Mês fechado. Reabra com motivo antes de alterar o plano.",mes_aberto:"Este mês já está aberto.",mes_invalido:"Escolha um mês encerrado deste ano.",referencia_invalida:"Escolha categoria e centro de custo ativos desta empresa.",contribuicao_mudou:"A contribuição mudou. Atualize a página e confira a revisão.",prazo_invalido:"O prazo deve ser futuro e de até 7 dias.",motivo_invalido:"Informe motivo de 5 a 500 caracteres."};
export async function planCommand(empresaId:string,cenario:string|null,acao:string,_:PlanState,form:FormData):Promise<PlanState>{
 void _;const {empresa,supabase,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 if(cenario&&!z.string().uuid().safeParse(cenario).success)return {error:errors.indisponivel};
 let dados:Record<string,unknown>={},link:string|undefined;
 const raw=Object.fromEntries(form),version=z.coerce.number().int().positive().safeParse(form.get("versao"));
 if(acao==="criar"||acao==="duplicar"){const parsed=scenarioSchema.safeParse(raw);if(!parsed.success)return {error:"Confira nome e ano do cenário."};dados=parsed.data;}
 else if(acao==="linha"){const parsed=planLineSchema.safeParse(raw);if(!parsed.success)return {error:parsed.error.issues[0]?.message??"Confira os dados da linha."};dados=parsed.data;}
 else if(acao==="renomear"){const parsed=z.string().trim().min(2).max(120).safeParse(form.get("nome"));if(!parsed.success)return {error:"Informe nome de 2 a 120 caracteres."};dados={nome:parsed.data};}
 else if(acao==="excluir"){const parsed=z.string().uuid().safeParse(form.get("id"));if(!parsed.success)return {error:errors.indisponivel};dados={id:parsed.data};}
 else if(acao==="fechar"||acao==="reabrir"){const parsed=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(form.get("mes"));if(!parsed.success)return {error:errors.mes_invalido};dados={mes:`${parsed.data}-01`,motivo:String(form.get("motivo")??"").trim().slice(0,500)};}
 else if(acao==="convite"){
  const parsed=z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),centro_custo_id:z.string().uuid(),dias:z.coerce.number().int().min(1).max(7)}).safeParse(raw);if(!parsed.success)return {error:"Confira e-mail, setor e prazo (1 a 7 dias)."};
  const token=randomBytes(32).toString("hex");link=`/contribuicoes/${token}`;dados={...parsed.data,token_hash:createHash("sha256").update(token).digest("hex"),expira_em:new Date(Date.now()+parsed.data.dias*86400000-60000).toISOString()};
 }else if(["revogar","revisar","importar"].includes(acao)){
  const parsed=z.object({convite_id:z.string().uuid(),revisao:z.coerce.number().int().nonnegative()}).safeParse(raw);if(!parsed.success)return {error:errors.indisponivel};dados=parsed.data;
 }else if(!["arquivar","reativar"].includes(acao))return {error:"Ação indisponível."};
 const {data,error}=await supabase.rpc("operar_planejamento",{p_empresa:empresa.id,p_cenario:cenario,p_versao:version.success?version.data:null,p_acao:acao,p_dados:dados});
 if(error)return {error:error.code==="23514"?"Desvincule a execução antes de excluir a linha ou alterar seu tipo. Confira também os limites de valor.":error.code==="23505"?"Nome ou pedido já utilizado neste ano.":"Não foi possível salvar. Confira os dados informados."};
 if(data?.codigo!=="ok")return {error:errors[data?.codigo]??"Confira os dados e tente novamente."};
 revalidatePath(`/empresas/${empresa.id}/planejamento`,"layout");
 if(acao==="criar"||acao==="duplicar")redirect(`/empresas/${empresa.id}/planejamento/${data.id}`);
 return {success:acao==="importar"?"Revisão importada para o plano. Os lançamentos reais foram preservados.":"Planejamento atualizado.",...(link?{link}:{})};
}
export async function linkExecution(empresaId:string,cenario:string,_:PlanState,form:FormData):Promise<PlanState>{
 void _;const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:errors.sem_acesso};
 const parsed=z.object({linha_id:z.string().uuid(),tipo:z.enum(["receita","despesa"]),lancamento_id:z.union([z.string().uuid(),z.literal("")]),versao:z.coerce.number().int().positive()}).safeParse(Object.fromEntries(form));if(!parsed.success||!z.string().uuid().safeParse(cenario).success)return {error:"Confira a linha e o título real."};
 const {data,error}=await supabase.rpc("vincular_execucao_plano",{p_empresa:empresa.id,p_cenario:cenario,p_versao:parsed.data.versao,p_linha:parsed.data.linha_id,p_tipo:parsed.data.tipo,p_lancamento:parsed.data.lancamento_id||null});
 if(error||data?.codigo!=="ok")return {error:errors[data?.codigo]??(data?.codigo==="ja_vinculado"?"Este título já está vinculado a outra linha neste cenário.":"Não foi possível salvar o vínculo.")};
 revalidatePath(`/empresas/${empresa.id}/planejamento`,"layout");return {success:"Vínculo de execução atualizado."};
}
