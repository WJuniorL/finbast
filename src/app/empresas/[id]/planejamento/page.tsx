import Link from "next/link";
import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import {requireEmpresa} from "@/lib/empresa";
import {hojeBahia} from "@/lib/financeiro";
import {PlanForm,ScenarioFields} from "@/components/planejamento/plan-forms";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
export default async function PlanningPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params,{supabase,empresa,canEdit}=await requireEmpresa(id),q=await searchParams;
 const archived=q.status==="arquivados",page=typeof q.page==="string"&&/^\d+$/.test(q.page)?Math.max(1,Math.min(1000000,Number(q.page))):1;
 const {data,error,count}=await supabase.from("cenarios_planejamento").select("id,nome,ano,versao,arquivado",{count:"exact"}).eq("empresa_id",id).eq("arquivado",archived).order("ano",{ascending:false}).order("nome").order("id").range((page-1)*50,page*50-1);
 if(error)throw new Error("Não foi possível carregar os cenários.");const pages=Math.max(1,Math.ceil((count??0)/50));if(page>pages)redirect(`?status=${archived?"arquivados":"ativos"}&page=${pages}`);
 return <><Link href={`/empresas/${id}`}>← Voltar para {empresa.nome}</Link><div><h1 className="text-3xl font-bold">Planejamento e Simulador</h1><p>Receitas, despesas e cenários sem gerar lançamentos reais.</p></div>
 <nav className="flex gap-4 text-sm" aria-label="Situação dos cenários"><Link href="?status=ativos">Ativos</Link><Link href="?status=arquivados">Arquivados</Link></nav>
 {canEdit&&<Card><CardHeader><CardTitle>Criar cenário</CardTitle></CardHeader><CardContent><PlanForm empresa={id} acao="criar" label="Criar cenário"><ScenarioFields ano={Number(hojeBahia().slice(0,4))} requestId={randomUUID()}/></PlanForm></CardContent></Card>}
 <div className="grid gap-4 sm:grid-cols-2">{data?.map(c=><Card key={c.id}><CardHeader><CardTitle>{c.nome}</CardTitle></CardHeader><CardContent className="space-y-3"><p>{c.ano} · {c.arquivado?"Arquivado":"Ativo"}</p><Link className="underline" href={`/empresas/${id}/planejamento/${c.id}`}>Abrir {c.nome}</Link></CardContent></Card>)}</div>{!data?.length&&<p>Nenhum cenário nesta situação.</p>}
 <div className="flex justify-between text-sm"><p>{count??0} cenário(s) · Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={`?status=${archived?"arquivados":"ativos"}&page=${page-1}`}>← Anterior</Link>}{page<pages&&<Link href={`?status=${archived?"arquivados":"ativos"}&page=${page+1}`}>Próxima →</Link>}</div></div></>;
}
