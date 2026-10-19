import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import {formatCentavos,formatDate} from "@/lib/financeiro";
export default async function ReconciliationHistory({params,searchParams}:{params:Promise<{id:string;conta:string;movimento:string}>;searchParams:Promise<{page?:string}>}){
 const {id,conta,movimento}=await params;if(!z.string().uuid().safeParse(conta).success||!z.string().uuid().safeParse(movimento).success)notFound();
 const {supabase,empresa}=await requireEmpresa(id),query=await searchParams;
 const record=await supabase.from("lancamentos_importados").select("descricao,valor_centavos,data_movimento").eq("empresa_id",empresa.id).eq("conta_id",conta).eq("id",movimento).maybeSingle();if(record.error)throw new Error("Não foi possível carregar o movimento.");if(!record.data)notFound();
 const page=/^\d+$/.test(query.page??"")?Math.max(1,Number(query.page)):1;
 const list=await supabase.from("conciliacoes").select("id,pagar_id,receber_id,autor_id,criado_em,desfeita_em,desfeita_por,motivo",{count:"exact"}).eq("empresa_id",empresa.id).eq("movimento_id",movimento).order("criado_em",{ascending:false}).order("id").range((page-1)*50,page*50-1);if(list.error)throw new Error("Não foi possível carregar o histórico.");const pages=Math.max(1,Math.ceil((list.count??0)/50));if(page>pages)redirect(`?page=${pages}`);
 return <><Link href={`/empresas/${id}/bancos/${conta}`}>← Voltar para extrato</Link><h1 className="text-3xl font-bold">Histórico da conciliação</h1><p>{record.data.descricao} · {formatCentavos(record.data.valor_centavos)} · {formatDate(record.data.data_movimento)}</p><div className="space-y-4">{list.data?.map(c=><div className="rounded-lg border bg-card p-4 text-sm" key={c.id}><p>{c.desfeita_em?"Conciliação desfeita":"Conciliação ativa"} · {new Date(c.criado_em).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</p><Link className="underline" href={`/empresas/${id}/${c.pagar_id?"pagar":"receber"}/${c.pagar_id??c.receber_id}`}>Histórico do lançamento</Link><p className="break-all">Autor: {c.autor_id}</p>{c.desfeita_em&&<><p>Motivo: {c.motivo}</p><p className="break-all">Desfeito por: {c.desfeita_por}</p></>}</div>)}{!list.data?.length&&<p>Nenhuma conciliação registrada.</p>}</div><p>Página {page} de {pages}</p>{page>1&&<Link href={`?page=${page-1}`}>← Anterior</Link>}{page<pages&&<Link href={`?page=${page+1}`}>Próxima →</Link>}</>;
}
