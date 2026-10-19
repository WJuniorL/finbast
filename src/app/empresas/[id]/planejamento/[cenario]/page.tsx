import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import type {PlanSummary,PlanLine,Option,ContributionLine} from "@/lib/planejamento";
import {formatCentavos} from "@/lib/financeiro";
import {PlanForm,ScenarioFields,LineEditor} from "@/components/planejamento/plan-forms";
import {ExecutionLinks} from "@/components/planejamento/execution-links";
import {PlanGrid} from "@/components/planejamento/plan-grid";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
export default async function ScenarioPage({params,searchParams}:{params:Promise<{id:string;cenario:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id,cenario}=await params;if(!z.string().uuid().safeParse(cenario).success)notFound();const {supabase,empresa,canEdit}=await requireEmpresa(id),q=await searchParams;
 const page=typeof q.page==="string"&&/^\d+$/.test(q.page)?Math.max(1,Math.min(1000000,Number(q.page))):1;
 const linesPage=typeof q.linhas==="string"&&/^\d+$/.test(q.linhas)?Math.max(1,Math.min(1000000,Number(q.linhas))):1;
 const compareId=typeof q.comparar==="string"&&q.comparar?q.comparar:null;if(compareId&&!z.string().uuid().safeParse(compareId).success)notFound();
 const [result,lines,cats,centers,scenarios,invitations,history,comparison,paySources,receiveSources]=await Promise.all([
  supabase.rpc("resumo_planejamento",{p_empresa:id,p_cenario:cenario,p_pagina:page}),
  supabase.from("plano_linhas").select("*",{count:"exact"}).eq("empresa_id",id).eq("cenario_id",cenario).order("mes").order("id").range((linesPage-1)*50,linesPage*50-1),
  supabase.from("categorias").select("id,nome,tipo").eq("empresa_id",id).eq("ativo",true).order("nome").limit(1000),
  supabase.from("centros_custo").select("id,nome").eq("empresa_id",id).eq("ativo",true).order("nome").limit(1000),
  supabase.from("cenarios_planejamento").select("id,nome,ano").eq("empresa_id",id).order("nome").limit(1000),
  supabase.from("convites_planejamento").select("id,email,centro_custo_id,status,revisao,importada,linhas,revogado_em,expira_em").eq("empresa_id",id).eq("cenario_id",cenario).order("criado_em",{ascending:false}).limit(50),
  supabase.from("historico_planejamento").select("id,evento,criado_em,dados").eq("empresa_id",id).eq("cenario_id",cenario).order("criado_em",{ascending:false}).limit(50),
  compareId?supabase.rpc("resumo_planejamento",{p_empresa:id,p_cenario:compareId,p_pagina:1}):Promise.resolve({data:null,error:null}),
  canEdit?supabase.from("lancamentos_pagar").select("id,descricao,vencimento,valor_centavos").eq("empresa_id",id).neq("status","cancelado").order("vencimento",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
  canEdit?supabase.from("lancamentos_receber").select("id,descricao,vencimento,valor_centavos").eq("empresa_id",id).neq("status","cancelado").order("vencimento",{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
 ]);
 if([result,lines,cats,centers,scenarios,invitations,history,comparison,paySources,receiveSources].some(r=>r.error))throw new Error("Não foi possível carregar o planejamento.");
 const executions=lines.data?.length?await supabase.from("execucoes_plano").select("linha_id,pagar_id,receber_id").eq("empresa_id",id).eq("cenario_id",cenario).in("linha_id",lines.data.map(l=>l.id)):{data:[],error:null};
 if(executions.error)throw new Error("Não foi possível carregar os vínculos de execução.");
 if(!result.data||compareId&&!comparison.data)notFound();const summary=result.data as PlanSummary,c=summary.cenario,other=comparison.data as PlanSummary|null;
 const base=`/empresas/${id}/planejamento/${cenario}`,href=(p:number,l:number)=>`?${new URLSearchParams({page:String(p),linhas:String(l),...(compareId?{comparar:compareId}:{})})}`;
 return <><Link href={`/empresas/${id}/planejamento`}>← Voltar aos cenários de {empresa.nome}</Link><div className="space-y-2"><h1 className="text-3xl font-bold">{c.nome}</h1><p>{c.ano} · {c.arquivado?"Arquivado":"Ativo"} · revisão {c.versao}</p><a className="text-sm underline" href={base}>Atualizar página</a></div>
 <form method="get" className="flex flex-wrap items-end gap-3"><Label>Comparar com<select aria-label="Comparar com" name="comparar" className="h-9 w-full rounded-md border bg-background px-3" defaultValue={compareId??""}><option value="">Sem comparação</option>{scenarios.data?.filter(s=>s.id!==c.id).map(s=><option key={s.id} value={s.id}>{s.nome} · {s.ano}</option>)}</select></Label><Button variant="outline">Comparar cenários</Button></form>
 <Card><CardHeader><CardTitle><h2>Cenário, simulação e comparação</h2></CardTitle></CardHeader><CardContent><PlanGrid summary={summary} compare={other?{nome:other.cenario.nome,meses:other.meses}:undefined}/></CardContent></Card>
 <div className="flex justify-between text-sm"><p>{summary.total} grupo(s) · Página {summary.pagina} de {Math.max(1,Math.ceil(summary.total/50))}</p><div className="flex gap-3">{summary.pagina>1&&<Link href={href(summary.pagina-1,linesPage)}>← Grupos anteriores</Link>}{summary.pagina<Math.ceil(summary.total/50)&&<Link href={href(summary.pagina+1,linesPage)}>Próximos grupos →</Link>}</div></div>
 <Card><CardHeader><CardTitle><h2>Linhas adicionais do plano</h2></CardTitle></CardHeader><CardContent>{canEdit?<LineEditor empresa={id} cenario={c} categorias={(cats.data??[]) as Option[]} centros={(centers.data??[]) as Option[]} linhas={(lines.data??[]) as PlanLine[]}/>:<div>{lines.data?.map(l=><p key={l.id}>{l.descricao} · {l.mes.slice(0,7)} · {formatCentavos(l.valor_centavos)}</p>)}{!lines.data?.length&&<p>Nenhuma linha adicional de plano.</p>}</div>}<div className="mt-4 flex flex-wrap justify-between gap-3 text-sm"><p>{lines.count??0} linha(s) · Página {linesPage}</p><div className="flex gap-3">{linesPage>1&&<Link href={href(summary.pagina,linesPage-1)}>← Linhas anteriores</Link>}{linesPage*50<(lines.count??0)&&<Link href={href(summary.pagina,linesPage+1)}>Próximas linhas →</Link>}</div></div></CardContent></Card>
 {canEdit&&!c.arquivado&&<Card><CardHeader><CardTitle>Execução do plano</CardTitle></CardHeader><CardContent><ExecutionLinks empresa={id} cenario={c} lines={(lines.data??[]) as PlanLine[]} links={executions.data??[]} sources={[...(paySources.data??[]).map(l=>({...l,tipo:"despesa"})),...(receiveSources.data??[]).map(l=>({...l,tipo:"receita"}))]}/></CardContent></Card>}
 {canEdit&&<details className="space-y-4 rounded-lg border p-4"><summary className="cursor-pointer font-medium">Gerenciar cenário e fechamento</summary><div className="grid gap-6 md:grid-cols-2">
 <PlanForm empresa={id} cenario={c} acao="renomear" label="Renomear cenário"><Label>Novo nome<Input name="nome" defaultValue={c.nome} required/></Label></PlanForm>
 <PlanForm empresa={id} cenario={c} acao="duplicar" label="Duplicar cenário"><ScenarioFields ano={c.ano} nome={`${c.nome} (cópia)`} requestId={randomUUID()}/></PlanForm>
 <PlanForm empresa={id} cenario={c} acao={c.arquivado?"reativar":"arquivar"} label={c.arquivado?"Reativar cenário":"Arquivar cenário"}/>
 {!c.arquivado&&<><PlanForm empresa={id} cenario={c} acao="fechar" label="Fechar mês"><Label>Mês a fechar<Input type="month" name="mes" min={`${c.ano}-01`} max={`${c.ano}-12`} required/></Label></PlanForm><PlanForm empresa={id} cenario={c} acao="reabrir" label="Reabrir mês"><Label>Mês a reabrir<Input type="month" name="mes" min={`${c.ano}-01`} max={`${c.ano}-12`} required/></Label><Label>Motivo da reabertura<Input name="motivo" minLength={5} maxLength={500} required/></Label></PlanForm></>}
 </div></details>}
 <Card><CardHeader><CardTitle><h2>Contribuições dos líderes</h2></CardTitle></CardHeader><CardContent className="space-y-6"><p className="text-sm text-muted-foreground">O líder confirma e-mail por código e vê somente o formulário do seu setor. Nada entra automaticamente no cenário. A importação substitui linhas previamente importadas do mesmo convite, preservando espelhos no histórico.</p>
 {canEdit&&!c.arquivado&&<PlanForm empresa={id} cenario={c} acao="convite" label="Criar link do líder"><Label>E-mail do líder<Input name="email" type="email" required/></Label><Label>Setor do líder<select aria-label="Setor do líder" className="h-9 w-full rounded-md border bg-background px-3" name="centro_custo_id" required><option value="">Selecione</option>{centers.data?.map(cc=><option key={cc.id} value={cc.id}>{cc.nome}</option>)}</select></Label><Label>Validade em dias<Input name="dias" type="number" min={1} max={7} defaultValue={7} required/></Label></PlanForm>}
 <p className="text-xs text-muted-foreground">Últimos 50 links e últimos 50 eventos exibidos abaixo.</p>
 {invitations.data?.map(i=><div className="space-y-3 rounded-lg border p-4" key={i.id}><p className="break-all">{i.email} · {i.status} · revisão {i.revisao}{i.importada?` · importada ${i.importada}`:""}{i.revogado_em?" · revogado":""}</p><p className="text-xs">Prazo: {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Bahia",dateStyle:"short",timeStyle:"short"}).format(new Date(i.expira_em))}</p>
 {(i.linhas as ContributionLine[]).map((l,n)=><p key={n} className="text-sm">{l.mes.slice(0,7)} · {l.descricao} · {formatCentavos(l.valor_centavos)}</p>)}
 {canEdit&&!c.arquivado&&<div className="flex flex-wrap gap-4">{!i.revogado_em&&<PlanForm empresa={id} cenario={c} acao="revogar" label="Revogar link"><input type="hidden" name="convite_id" value={i.id}/><input type="hidden" name="revisao" value={i.revisao}/></PlanForm>}{i.revisao>0&&["revisar","importar"].map(acao=><PlanForm key={acao} empresa={id} cenario={c} acao={acao} label={acao==="revisar"?"Marcar revisado":"Importar revisão para o plano"}><input type="hidden" name="convite_id" value={i.id}/><input type="hidden" name="revisao" value={i.revisao}/></PlanForm>)}</div>}</div>)}{!invitations.data?.length&&<p>Nenhuma contribuição solicitada.</p>}
 </CardContent></Card>
 <Card><CardHeader><CardTitle><h2>Histórico e espelhos</h2></CardTitle></CardHeader><CardContent className="space-y-3">{history.data?.map(h=><details className="border-b pb-2" key={h.id}><summary className="cursor-pointer">{h.evento} · {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Bahia",dateStyle:"short",timeStyle:"short"}).format(new Date(h.criado_em))}</summary>{h.evento==="contribuicao"&&Array.isArray(h.dados?.linhas)?(h.dados.linhas as ContributionLine[]).map((l,n)=><p className="text-sm" key={n}>{l.mes} · {l.descricao} · {formatCentavos(l.valor_centavos)}</p>):<p className="text-sm">{[h.dados?.descricao,h.dados?.nome,h.dados?.motivo].find(v=>typeof v==="string")??"Operação registrada"}</p>}</details>)}</CardContent></Card></>;
}
