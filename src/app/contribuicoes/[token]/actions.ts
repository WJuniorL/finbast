"use server";
import {createHash} from "node:crypto";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {moneySchema} from "@/lib/financeiro";
import type {FormState} from "@/lib/form-state";
const validToken=(token:string)=>/^[a-f0-9]{64}$/.test(token),hash=(token:string)=>createHash("sha256").update(token).digest("hex");
export type OtpState=FormState&{email?:string};
export async function requestLeaderCode(token:string,_:OtpState,form:FormData):Promise<OtpState>{
 void _;const parsed=z.email().max(254).transform(v=>v.toLowerCase()).safeParse(form.get("email"));if(!validToken(token)||!parsed.success)return {error:"Confira o e-mail e o link recebido."};
 const supabase=await createClient(),validation=await supabase.rpc("validar_link_lider",{p_hash:hash(token),p_email:parsed.data});
 if(validation.error||!validation.data)return {error:"Link ou e-mail indisponível. Confira com o financeiro."};
 const {error}=await supabase.auth.signInWithOtp({email:parsed.data,options:{shouldCreateUser:true}});
 if(error)return {error:"Não foi possível enviar o código. Aguarde um minuto e tente novamente."};
 return {success:"Confira o código recebido no seu e-mail.",email:parsed.data};
}
export async function verifyLeaderCode(token:string,_:FormState,form:FormData):Promise<FormState>{
 void _;const parsed=z.object({email:z.email().max(254).transform(v=>v.toLowerCase()),codigo:z.string().regex(/^\d{6,10}$/)}).safeParse(Object.fromEntries(form));if(!validToken(token)||!parsed.success)return {error:"Informe o e-mail e o código recebido (6 a 10 dígitos)."};
 const supabase=await createClient(),validation=await supabase.rpc("validar_link_lider",{p_hash:hash(token),p_email:parsed.data.email});if(validation.error||!validation.data)return {error:"Link ou e-mail indisponível."};
 const {error}=await supabase.auth.verifyOtp({email:parsed.data.email,token:parsed.data.codigo,type:"email"});

 if(error)return {error:"Código inválido ou expirado. Solicite outro código."};
 revalidatePath(`/contribuicoes/${token}`);return {success:"E-mail confirmado."};
}
export async function submitContribution(token:string,_:FormState,form:FormData):Promise<FormState>{
 void _;if(!validToken(token))return {error:"Link indisponível."};const version=z.coerce.number().int().positive().safeParse(form.get("versao"));
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)return {error:"Confirme novamente seu e-mail."};
 let raw:unknown;try{const text=String(form.get("linhas")??"");if(text.length>100000)return {error:"Contribuição acima do limite."};raw=JSON.parse(text);}catch{return {error:"Confira as linhas informadas."};}
 const schema=z.array(z.object({categoria_id:z.string().uuid(),mes:z.string().regex(/^(?:20\d{2}|2100)-(0[1-9]|1[0-2])$/).transform(v=>`${v}-01`),descricao:z.string().trim().min(2).max(160),valor_centavos:moneySchema.refine(v=>v>0)})).max(120);
 const parsed=schema.safeParse(raw);if(!parsed.success||!version.success)return {error:"Confira categoria, mês, descrição e valor positivo das linhas (até 120)."};
 const {data,error}=await supabase.rpc("salvar_contribuicao",{p_hash:hash(token),p_versao:version.data,p_linhas:parsed.data});
 if(error||data?.codigo!=="ok")return {error:data?.codigo==="desatualizado"?"A contribuição mudou. Atualize a página antes de editar.":"Envio indisponível. Confirme seu e-mail e verifique o prazo do link."};
 revalidatePath(`/contribuicoes/${token}`);return {success:"Contribuição enviada para revisão do financeiro."};
}
