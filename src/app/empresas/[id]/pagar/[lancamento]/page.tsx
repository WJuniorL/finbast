import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import {formatCentavos,formatDate} from "@/lib/pagar";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
export default async function PagarHistory({params,searchParams}:{params:Promise<{id:string;lancamento:string}>;searchParams:Promise<{page?:string}>}) {
  const {id,lancamento}=await params;
  if(!z.string().uuid().safeParse(lancamento).success)notFound();
  const {supabase,empresa}=await requireEmpresa(id);
  const query=await searchParams;
  const page=/^\d+$/.test(query.page??"")?Math.max(1,Math.min(1000,Number(query.page))):1;
  const {data:item,error}=await supabase.from("lancamentos_pagar").select("descricao,valor_centavos,vencimento,status").eq("empresa_id",empresa.id).eq("id",lancamento).maybeSingle();
  if(error)throw new Error("Não foi possível carregar o lançamento.");
  if(!item)notFound();
  const history=await supabase.from("baixas_pagar").select("id,tipo,valor_centavos,data_pagamento,autor_id,observacao,criado_em",{count:"exact"}).eq("empresa_id",empresa.id).eq("lancamento_id",lancamento).order("criado_em",{ascending:false}).order("id").range((page-1)*50,page*50-1);
  if(history.error)throw new Error("Não foi possível carregar o histórico.");
  const pages=Math.max(1,Math.ceil((history.count??0)/50));
  if(page>pages)redirect(`/empresas/${id}/pagar/${lancamento}?page=${pages}`);
  return <><Link href={`/empresas/${id}/pagar?status=todos`}>← Voltar para Contas a Pagar</Link><div className="space-y-2"><h1 className="text-3xl font-bold">Histórico de pagamentos</h1><p>{item.descricao} · {formatCentavos(item.valor_centavos)} · vencimento {formatDate(item.vencimento)}</p><p className="text-sm text-muted-foreground">As baixas e os estornos são preservados. Autor identificado pelo ID do usuário.</p></div>
  <Card><CardHeader><CardTitle>Baixas e estornos</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Operação</TableHead><TableHead>Valor</TableHead><TableHead>Pagamento em</TableHead><TableHead>Autor</TableHead><TableHead>Observação</TableHead><TableHead>Registrado em</TableHead></TableRow></TableHeader><TableBody>{history.data?.map(event=><TableRow key={event.id}><TableCell>{event.tipo==="baixa"?"Baixa manual":"Estorno"}</TableCell><TableCell>{formatCentavos(event.valor_centavos)}</TableCell><TableCell>{formatDate(event.data_pagamento)}</TableCell><TableCell className="max-w-40 break-all whitespace-normal text-xs">{event.autor_id}</TableCell><TableCell className="max-w-60 whitespace-normal">{event.observacao??"—"}</TableCell><TableCell>{new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Bahia",dateStyle:"short",timeStyle:"short"}).format(new Date(event.criado_em))}</TableCell></TableRow>)}{!history.data?.length&&<TableRow><TableCell colSpan={6}>Nenhuma baixa registrada.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  <div className="flex justify-between text-sm"><p>{history.count??0} operação(s) · Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={`?page=${page-1}`}>← Anterior</Link>}{page<pages&&<Link href={`?page=${page+1}`}>Próxima →</Link>}</div></div></>;
}
