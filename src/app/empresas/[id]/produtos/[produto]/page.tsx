import Link from "next/link";
import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import type {Product} from "@/lib/produtos";
import {ProductEditor,ProductSimulation,ProjectionForm} from "@/components/produtos/product-forms";
import {Card,CardHeader,CardTitle,CardContent} from "@/components/ui/card";
export default async function ProductPage({params}:{params:Promise<{id:string;produto:string}>}){
 const {id,produto}=await params;if(!z.string().uuid().safeParse(produto).success)notFound();const {supabase,canEdit}=await requireEmpresa(id);
 const [record,config,scenarios,categories,centers]=await Promise.all([
  supabase.from("produtos").select("*").eq("empresa_id",id).eq("id",produto).maybeSingle(),
  supabase.from("config_custeio").select("versao").eq("empresa_id",id).maybeSingle(),
  supabase.from("cenarios_planejamento").select("id,nome,ano,versao").eq("empresa_id",id).eq("arquivado",false).order("nome").limit(1000),
  supabase.from("categorias").select("id,nome,tipo").eq("empresa_id",id).eq("ativo",true).order("nome").limit(1000),
  supabase.from("centros_custo").select("id,nome").eq("empresa_id",id).eq("ativo",true).order("nome").limit(1000),
 ]);
 if([record,config,scenarios,categories,centers].some(r=>r.error))throw new Error("Não foi possível carregar o produto.");if(!record.data)notFound();const p=record.data as Product,versao=config.data?.versao??0,requestId=randomUUID();
 return <><Link href={`/empresas/${id}/produtos`}>← Voltar aos produtos</Link><h1 className="text-3xl font-bold">{p.nome}</h1><p>{p.ativo?"Ativo":"Arquivado"} · {p.volume} unidades previstas</p>
 <Card><CardHeader><CardTitle><h2>Simulação de preço e volume</h2></CardTitle></CardHeader><CardContent><ProductSimulation product={p}/></CardContent></Card>
 {canEdit&&<Card><CardHeader><CardTitle><h2>Editar premissas</h2></CardTitle></CardHeader><CardContent><ProductEditor empresa={id} versao={versao} requestId={requestId} products={[p]}/></CardContent></Card>}
 {canEdit&&p.ativo&&<Card><CardHeader><CardTitle><h2>Projetar no Planejamento</h2></CardTitle></CardHeader><CardContent><ProjectionForm empresa={id} versao={versao} requestId={requestId} produto={p.id} scenarios={scenarios.data??[]} categories={categories.data??[]} centers={centers.data??[]}/></CardContent></Card>}
 </>;
}
