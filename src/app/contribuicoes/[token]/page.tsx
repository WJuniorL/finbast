import type {Metadata} from "next";
import {createHash} from "node:crypto";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import type {LeaderData} from "@/lib/planejamento";
import {LeaderLogin,ContributionForm} from "@/components/planejamento/leader-forms";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
export const metadata:Metadata={title:"Contribuição do setor · Finbast",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function LeaderPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;if(!/^[a-f0-9]{64}$/.test(token))notFound();const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();
 let data:LeaderData|null=null;
 if(user){const result=await supabase.rpc("consultar_contribuicao",{p_hash:createHash("sha256").update(token).digest("hex")});if(result.error)throw new Error("Não foi possível verificar o acesso ao formulário.");data=result.data as LeaderData|null;}
 return <main className="mx-auto max-w-2xl space-y-6 p-6"><p className="text-xl font-bold">finbast.</p><h1 className="text-3xl font-bold">Contribuição do setor</h1><Card><CardHeader><CardTitle>{data?data.setor:"Confirmar acesso"}</CardTitle></CardHeader><CardContent>{data?<ContributionForm token={token} data={data}/>:<LeaderLogin token={token}/>}</CardContent></Card></main>;
}
