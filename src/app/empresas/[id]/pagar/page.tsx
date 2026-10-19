import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEmpresa } from "@/lib/empresa";
import { canSettlePagar, formatCentavos, hojeBahia, type PagarRecord } from "@/lib/pagar";
import { PagarManager, type PagarOption } from "@/components/pagar/pagar-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PagarPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {id}=await params;
  const {supabase,empresa,papel,canEdit}=await requireEmpresa(id);
  const paramsQuery=await searchParams;
  const param=(key:string)=>typeof paramsQuery[key]==="string"?paramsQuery[key] as string:"";
  const q=param("q").trim().slice(0,120);
  const status=["aberto","vencido","pago","cancelado","todos"].includes(param("status"))?param("status"):"aberto";
  const fixo=["sim","nao"].includes(param("fixo"))?param("fixo"):"todos";
  const inicio=z.iso.date().safeParse(param("inicio")).success?param("inicio"):"";
  const fim=z.iso.date().safeParse(param("fim")).success?param("fim"):"";
  const page=/^\d+$/.test(param("page"))?Math.max(1,Math.min(1000,Number(param("page")))):1;
  let request=supabase.from("lancamentos_pagar").select("*",{count:"exact"}).eq("empresa_id",empresa.id);
  if(status!=="todos") request=request.eq("status",status==="vencido"?"aberto":status);
  if(status==="vencido") request=request.lt("vencimento",hojeBahia());
  if(fixo!=="todos") request=request.eq("custo_fixo",fixo==="sim");
  if(q) request=request.ilike("descricao",`%${q.replace(/[\\%_]/g,"\\$&")}%`);
  if(inicio) request=request.gte("vencimento",inicio);
  if(fim) request=request.lte("vencimento",fim);
  const canSettle=canSettlePagar(papel);
  const [list,summary,approval,categories,suppliers,centers]=await Promise.all([
    request.order("vencimento").order("id").range((page-1)*50,page*50-1),
    supabase.rpc("resumo_pagar",{p_empresa:empresa.id}),
    canSettle?supabase.rpc("status_aprovacao"):Promise.resolve({data:null,error:null}),
    supabase.from("categorias").select("id,nome,ativo").eq("empresa_id",empresa.id).eq("tipo","despesa").order("nome").limit(1000),
    supabase.from("fornecedores").select("id,nome,ativo").eq("empresa_id",empresa.id).order("nome").limit(1000),
    canEdit?supabase.from("centros_custo").select("id,nome,ativo").eq("empresa_id",empresa.id).order("nome").limit(1000):Promise.resolve({data:[],error:null}),
  ]);
  if([list,summary,approval,categories,suppliers,centers].some(result=>result.error)) throw new Error("Não foi possível carregar Contas a Pagar.");
  const records=(list.data??[]) as PagarRecord[];
  const options={categorias:(categories.data??[]) as PagarOption[],fornecedores:(suppliers.data??[]) as PagarOption[],centros:(centers.data??[]) as PagarOption[]};
  const missingRequests=([['categorias','categoria_id'],['fornecedores','fornecedor_id'],['centros','centro_custo_id']] as const).map(async([key,field])=>{
    const known=new Set(options[key].map(option=>option.id));
    const missing=[...new Set(records.map(record=>record[field]).filter((value):value is string=>!!value&&!known.has(value)))];
    if(!missing.length) return;
    const {data,error}=await supabase.from(key==="centros"?"centros_custo":key).select("id,nome,ativo").eq("empresa_id",empresa.id).in("id",missing);
    if(error) throw new Error("Não foi possível carregar os cadastros referenciados.");
    options[key].push(...(data??[]));
  });
  await Promise.all(missingRequests);
  const serieIds=[...new Set(records.map(record=>record.serie_id))];
  const series=serieIds.length?await supabase.from("series_pagar").select("id,modo,parcelas,ativo").eq("empresa_id",empresa.id).in("id",serieIds):{data:[],error:null};
  if(series.error) throw new Error("Não foi possível carregar as parcelas.");
  const serieMap=new Map((series.data??[]).map(serie=>[serie.id,serie]));
  const supplierMap=new Map(options.fornecedores.map(option=>[option.id,option.nome]));
  const categoryMap=new Map(options.categorias.map(option=>[option.id,option.nome]));
  const display=records.map(record=>({...record,modo:serieMap.get(record.serie_id)?.modo??"unica",parcelas:serieMap.get(record.serie_id)?.parcelas??null,serie_ativa:serieMap.get(record.serie_id)?.ativo??false,fornecedor_nome:supplierMap.get(record.fornecedor_id)??"Fornecedor",categoria_nome:categoryMap.get(record.categoria_id)??"Categoria"}));
  const pages=Math.max(1,Math.ceil((list.count??0)/50));
  const href=(number:number)=>`?${new URLSearchParams({q,status,fixo,inicio,fim,page:String(number)})}`;
  if(page>pages) redirect(`/empresas/${id}/pagar${href(pages)}`);
  return <>
    <Link href={`/empresas/${id}`} className="text-sm">← Voltar para a conta</Link>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1><p className="text-muted-foreground">Despesas, parcelas e recorrências de {empresa.nome}.</p><Link className="text-sm underline" href={`/empresas/${id}/cadastros`}>Abrir cadastros</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{([["aberto","Em aberto"],["vencido","Vencido"],["pago","Pago acumulado"],["fixo","Custo fixo em aberto"]] as const).map(([key,label])=><Card key={key}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent><p className="font-mono text-xl font-semibold">{formatCentavos(summary.data?.[key]??"0")}</p></CardContent></Card>)}</div>
    <p className="text-xs text-muted-foreground">Totais de toda a conta. Os filtros abaixo se aplicam à lista de lançamentos.</p>
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-2"><Label htmlFor="pagar-busca">Buscar descrição</Label><Input id="pagar-busca" name="q" defaultValue={q} maxLength={120}/></div>
      <div className="space-y-2"><Label htmlFor="pagar-status">Situação</Label><select id="pagar-status" name="status" defaultValue={status} className="h-9 rounded-md border border-input bg-card px-3 text-sm"><option value="aberto">Em aberto</option><option value="vencido">Vencidos</option><option value="pago">Pagos</option><option value="cancelado">Cancelados</option><option value="todos">Todos</option></select></div>
      <div className="space-y-2"><Label htmlFor="pagar-fixo">Custo fixo</Label><select id="pagar-fixo" name="fixo" defaultValue={fixo} className="h-9 rounded-md border border-input bg-card px-3 text-sm"><option value="todos">Todos</option><option value="sim">Sim</option><option value="nao">Não</option></select></div>
      <div className="space-y-2"><Label htmlFor="pagar-inicio">Vencimento de</Label><Input id="pagar-inicio" name="inicio" type="date" defaultValue={inicio}/></div>
      <div className="space-y-2"><Label htmlFor="pagar-fim">Até</Label><Input id="pagar-fim" name="fim" type="date" defaultValue={fim}/></div>
      <Button type="submit" variant="outline">Filtrar</Button>
    </form>
    <PagarManager empresaId={empresa.id} records={display} options={options} canEdit={canEdit} canSettle={canSettle} approvalConfigured={approval.data?.configurada===true} requestId={randomUUID()}/>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{list.count??0} lançamento(s) · Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={href(page-1)}>← Anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima →</Link>}</div></div>
  </>;
}
