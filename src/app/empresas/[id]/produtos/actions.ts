"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireEmpresa} from "@/lib/empresa";
import {productSchema,allocationSchema,manualCostSchema} from "@/lib/produtos";
import {dateSchema,optionalId} from "@/lib/financeiro";
import type {FormState} from "@/lib/form-state";
const messages:Record<string,string>={sem_acesso:"Seu acesso permite apenas consulta.",desatualizado:"O custeio ou cenário mudou. Atualize a página e reabra a edição.",indisponivel:"Registro indisponível.",referencia_invalida:"Escolha registros ativos desta empresa e do tipo correto.",rateio_invalido:"O rateio deve somar 100% com produtos ativos, sem repetição.",ja_existe:"Nome ou critério de rateio já utilizado.",pedido_conflitante:"Pedido já utilizado com outros dados. Reabra o formulário.",mes_fechado:"Mês fechado. Reabra no Planejamento antes de substituir a projeção.",execucao_vinculada:"Desvincule a execução real no Planejamento antes de substituir a projeção.",dados_invalidos:"Confira os valores, datas e limites informados."};
export async function productCommand(empresaId:string,acao:string,_:FormState,form:FormData):Promise<FormState>{
 void _;const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:messages.sem_acesso};
 const common=z.object({versao:z.coerce.number().int().nonnegative(),request_id:z.string().uuid()}).safeParse(Object.fromEntries(form));if(!common.success)return {error:messages.dados_invalidos};
 const raw=Object.fromEntries(form);let dados:unknown;
 if(acao==="produto"){const p=productSchema.safeParse(raw);if(!p.success)return {error:p.error.issues[0]?.message};dados=p.data;}
 else if(acao==="regra"){
  let itens:unknown;try{itens=JSON.parse(String(form.get("itens")));}catch{return {error:messages.rateio_invalido};}
  const p=allocationSchema.safeParse({...raw,itens});if(!p.success)return {error:p.error.issues[0]?.message};dados=p.data;
 }else if(acao==="avulso"){const p=manualCostSchema.safeParse(raw);if(!p.success)return {error:p.error.issues[0]?.message};dados=p.data;}
 else if(["status_produto","status_regra","status_avulso"].includes(acao)){const p=z.object({id:z.string().uuid(),ativo:z.enum(["true","false"]).transform(v=>v==="true")}).safeParse(raw);if(!p.success)return {error:messages.dados_invalidos};dados=p.data;}
 else if(acao==="receita"){const p=z.object({id:z.string().uuid(),produto_id:optionalId}).safeParse(raw);if(!p.success)return {error:messages.dados_invalidos};dados=p.data;}
 else if(acao==="classificar"){const p=z.object({id:z.string().uuid(),tipo:z.enum(["automatico","direto","compartilhado","geral"]),produto_id:optionalId,regra_id:optionalId}).safeParse(raw);if(!p.success)return {error:messages.dados_invalidos};dados=p.data;}
 else return {error:"Ação indisponível."};
 const {data,error}=await supabase.rpc("operar_produtos",{p_empresa:empresa.id,p_versao:common.data.versao,p_acao:acao,p_dados:dados,p_request:common.data.request_id});
 if(error||data?.codigo!=="ok")return {error:messages[data?.codigo]??"Não foi possível salvar o custeio."};
 revalidatePath(`/empresas/${empresa.id}/produtos`,"layout");return {success:"Custeio atualizado."};
}
export async function projectProduct(empresaId:string,_:FormState,form:FormData):Promise<FormState>{
 void _;const {supabase,empresa,canEdit}=await requireEmpresa(empresaId);if(!canEdit)return {error:messages.sem_acesso};
 const p=z.object({produto_id:z.string().uuid(),versao:z.coerce.number().int().nonnegative(),cenario_id:z.string().uuid(),cenario_versao:z.coerce.number().int().positive(),mes:z.string().regex(/^\d{4}-\d{2}$/).transform(v=>`${v}-01`).pipe(dateSchema),categoria_receita:z.string().uuid(),categoria_despesa:z.string().uuid(),centro_custo_id:optionalId,request_id:z.string().uuid()}).safeParse(Object.fromEntries(form));
 if(!p.success)return {error:messages.dados_invalidos};const d=p.data;
 const {data,error}=await supabase.rpc("projetar_produto",{p_empresa:empresa.id,p_produto:d.produto_id,p_versao:d.versao,p_cenario:d.cenario_id,p_cenario_versao:d.cenario_versao,p_mes:d.mes,p_receita:d.categoria_receita,p_despesa:d.categoria_despesa,p_centro:d.centro_custo_id,p_request:d.request_id});
 if(error||data?.codigo!=="ok")return {error:messages[data?.codigo]??"Não foi possível enviar a projeção."};
 revalidatePath(`/empresas/${empresa.id}/produtos`,"layout");revalidatePath(`/empresas/${empresa.id}/planejamento`,"layout");return {success:"Projeção atualizada no cenário. Nenhum título financeiro foi criado."};
}
