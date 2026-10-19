"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireEmpresa} from "@/lib/empresa";
import type {FormState} from "@/lib/form-state";
export async function classifyDre(empresaId:string,_:FormState,form:FormData):Promise<FormState>{
 void _;const {supabase,canEdit,empresa}=await requireEmpresa(empresaId);if(!canEdit)return {error:"Seu acesso permite apenas consulta."};
 const parsed=z.object({categoria_id:z.string().uuid(),versao:z.coerce.number().int().nonnegative(),grupo:z.enum(["","receita","deducoes","custos","operacionais","financeiro","tributos"]),request_id:z.string().uuid()}).safeParse(Object.fromEntries(form));
 if(!parsed.success)return {error:"Confira os dados da classificação."};const p=parsed.data;
 const {data,error}=await supabase.rpc("configurar_dre",{p_empresa:empresa.id,p_categoria:p.categoria_id,p_versao:p.versao,p_grupo:p.grupo||null,p_request:p.request_id});
 const messages:Record<string,string>={desatualizado:"A classificação mudou. Atualize a página e reabra a edição.",grupo_invalido:"Grupo incompatível com o tipo da categoria.",indisponivel:"Categoria indisponível.",sem_acesso:"Seu acesso permite apenas consulta.",pedido_conflitante:"Pedido já utilizado com outros dados. Reabra a edição."};
 if(error||data?.codigo!=="ok")return {error:messages[data?.codigo]??"Não foi possível salvar a classificação."};
 revalidatePath(`/empresas/${empresa.id}/relatorios`,"layout");return {success:"Classificação DRE atualizada. Os períodos consultados serão recalculados."};
}
