import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import type {ImportRow} from "@/lib/bancos";
import {formatCentavos,formatDate} from "@/lib/financeiro";
import {ConfirmBankForm} from "@/components/bancos/bank-forms";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
export default async function ImportPreview({params,searchParams}:{params:Promise<{id:string;conta:string;lote:string}>;searchParams:Promise<{page?:string}>}){
 const {id,conta,lote}=await params;if(!z.string().uuid().safeParse(conta).success||!z.string().uuid().safeParse(lote).success)notFound();
 const {supabase,empresa,canEdit}=await requireEmpresa(id),query=await searchParams;
 const {data,error}=await supabase.from("importacoes_bancarias").select("nome_arquivo,status,linhas,importados,ignorados,confirmado_em").eq("empresa_id",empresa.id).eq("conta_id",conta).eq("id",lote).maybeSingle();if(error)throw new Error("Não foi possível carregar a prévia.");if(!data)notFound();
 const rows=data.linhas as ImportRow[],page=/^\d+$/.test(query.page??"")?Math.max(1,Number(query.page)):1,pages=Math.max(1,Math.ceil(rows.length/50));if(page>pages)redirect(`?page=${pages}`);
 return <><Link href={`/empresas/${id}/bancos/${conta}`}>← Voltar para extrato</Link><div><h1 className="text-3xl font-bold">Prévia de importação</h1><p>{data.nome_arquivo} · {rows.length} movimento(s)</p></div>
 {data.status==="previa"?<><p>Confira todos os movimentos antes de confirmar. A prévia não altera o saldo.</p>{rows.some(row=>row.chave.startsWith("linha:"))&&<p className="text-sm text-muted-foreground">Sem identificador em algumas linhas: deduplicação por data, descrição, valor e ocorrência. Confira extratos sobrepostos com movimentos idênticos; prefira identificadores únicos do banco.</p>}{canEdit&&<ConfirmBankForm empresa={id} id={lote}/>}</>:<p>Importação concluída: {data.importados} importado(s), {data.ignorados} ignorado(s).</p>}
 <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Identificador</TableHead></TableRow></TableHeader><TableBody>{rows.slice((page-1)*50,page*50).map(row=><TableRow key={row.chave}><TableCell>{formatDate(row.data_movimento)}</TableCell><TableCell className="max-w-60 whitespace-normal">{row.descricao}</TableCell><TableCell>{formatCentavos(row.valor_centavos)}</TableCell><TableCell className="max-w-48 break-all whitespace-normal text-xs">{row.chave}</TableCell></TableRow>)}</TableBody></Table>
 <div className="flex justify-between"><p>Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={`?page=${page-1}`}>← Anterior</Link>}{page<pages&&<Link href={`?page=${page+1}`}>Próxima →</Link>}</div></div></>;
}
