import Link from "next/link";
import {redirect} from "next/navigation";
import {requireEmpresa} from "@/lib/empresa";
import type {BankAccount} from "@/lib/bancos";
import {BankAccounts} from "@/components/bancos/bank-forms";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
export default async function BankList({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string;q?:string;status?:string}>}){
 const {id}=await params,{supabase,empresa,canEdit}=await requireEmpresa(id),query=await searchParams;
 const page=/^\d+$/.test(query.page??"")?Math.max(1,Math.min(1000,Number(query.page))):1,q=(query.q??"").trim().slice(0,120),status=["ativas","arquivadas","todos"].includes(query.status??"")?query.status!:"ativas";
 let request=supabase.from("contas_bancarias").select("*",{count:"exact"}).eq("empresa_id",empresa.id);if(status!=="todos")request=request.eq("ativo",status==="ativas");if(q)request=request.ilike("nome",`%${q.replace(/[\\%_]/g,"\\$&")}%`);
 const list=await request.order("nome").order("id").range((page-1)*50,page*50-1);if(list.error)throw new Error("Não foi possível carregar as contas bancárias.");
 const pages=Math.max(1,Math.ceil((list.count??0)/50)),href=(number:number)=>`?${new URLSearchParams({q,status,page:String(number)})}`;if(page>pages)redirect(`/empresas/${id}/bancos${href(pages)}`);
 return <><Link href={`/empresas/${id}`}>← Voltar para a conta</Link><div><h1 className="text-3xl font-bold">Contas bancárias</h1><p className="text-muted-foreground">Extratos importados e conciliação de {empresa.nome}.</p></div>
 <form method="get" className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="banco-busca">Buscar conta bancária</Label><Input id="banco-busca" name="q" defaultValue={q}/></div><div className="space-y-2"><Label htmlFor="banco-status">Mostrar contas</Label><select id="banco-status" name="status" defaultValue={status} className="h-9 rounded-md border border-input bg-card px-3 text-sm"><option value="ativas">Ativas</option><option value="arquivadas">Arquivadas</option><option value="todos">Todas</option></select></div><Button variant="outline">Filtrar</Button></form>
 <BankAccounts empresa={empresa.id} accounts={(list.data??[]) as BankAccount[]} canEdit={canEdit}/><div className="flex justify-between text-sm"><p>{list.count??0} conta(s) · Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={href(page-1)}>← Anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima →</Link>}</div></div></>;
}
