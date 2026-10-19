import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import {formatCentavos,formatDate} from "@/lib/financeiro";
import {UploadBankForm,ReconcileForm,UndoReconcileForm} from "@/components/bancos/bank-forms";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
export default async function BankStatement({params,searchParams}:{params:Promise<{id:string;conta:string}>;searchParams:Promise<{page?:string;inicio?:string;fim?:string}>}){
 const {id,conta}=await params;if(!z.string().uuid().safeParse(conta).success)notFound();
 const {supabase,empresa,canEdit}=await requireEmpresa(id),query=await searchParams;
 const account=await supabase.from("contas_bancarias").select("*").eq("empresa_id",empresa.id).eq("id",conta).maybeSingle();if(account.error)throw new Error("Não foi possível carregar a conta.");if(!account.data)notFound();
 const page=/^\d+$/.test(query.page??"")?Math.max(1,Math.min(1000,Number(query.page))):1;
 const inicio=z.iso.date().safeParse(query.inicio).success?query.inicio!:"",fim=z.iso.date().safeParse(query.fim).success?query.fim!:"";
 let request=supabase.from("lancamentos_importados").select("*",{count:"exact"}).eq("empresa_id",empresa.id).eq("conta_id",conta);if(inicio)request=request.gte("data_movimento",inicio);if(fim)request=request.lte("data_movimento",fim);
 const [list,summary,imports]=await Promise.all([request.order("data_movimento",{ascending:false}).order("id").range((page-1)*50,page*50-1),supabase.rpc("resumo_conta_bancaria",{p_empresa:empresa.id,p_conta:conta}),supabase.from("importacoes_bancarias").select("id,nome_arquivo,status,importados,ignorados").eq("empresa_id",empresa.id).eq("conta_id",conta).order("criado_em",{ascending:false}).limit(20)]);
 if(list.error||summary.error||imports.error)throw new Error("Não foi possível carregar o extrato.");
 const movements=list.data??[],ids=movements.map(row=>row.id);
 const reconciliations=ids.length?await supabase.from("conciliacoes").select("id,movimento_id,pagar_id,receber_id").eq("empresa_id",empresa.id).in("movimento_id",ids).is("desfeita_em",null):{data:[],error:null};
 if(reconciliations.error)throw new Error("Não foi possível carregar as conciliações.");const map=new Map((reconciliations.data??[]).map(value=>[value.movimento_id,value]));
 const amounts=[...new Set(movements.map(row=>String(Math.abs(Number(row.valor_centavos)))))];
 const [paid,received]=canEdit&&account.data.ativo&&amounts.length?await Promise.all([
  supabase.from("lancamentos_pagar").select("id,descricao,valor_pago_centavos,pago_em").eq("empresa_id",empresa.id).eq("status","pago").in("valor_pago_centavos",amounts).order("pago_em",{ascending:false}).limit(500),
  supabase.from("lancamentos_receber").select("id,descricao,valor_recebido_centavos,recebido_em").eq("empresa_id",empresa.id).eq("status","recebido").in("valor_recebido_centavos",amounts).order("recebido_em",{ascending:false}).limit(500),
 ]):[{data:[],error:null},{data:[],error:null}];if(paid.error||received.error)throw new Error("Não foi possível carregar as liquidações.");
 const pages=Math.max(1,Math.ceil((list.count??0)/50)),href=(number:number)=>`?${new URLSearchParams({inicio,fim,page:String(number)})}`;if(page>pages)redirect(`/empresas/${id}/bancos/${conta}${href(pages)}`);
 const base=`/empresas/${id}/bancos/${conta}`;
 return <><Link href={`/empresas/${id}/bancos`}>← Voltar para contas bancárias</Link><div><h1 className="text-3xl font-bold">{account.data.nome}</h1><p>{account.data.banco} · {account.data.numero} · {account.data.ativo?"Ativa":"Arquivada"}</p></div>
 <div className="grid gap-4 sm:grid-cols-3">{[["Saldo do extrato",formatCentavos(summary.data?.saldo??0)],["Movimentos",String(summary.data?.movimentos??0)],["Conciliados",String(summary.data?.conciliados??0)]].map(([label,value])=><Card key={label}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="font-mono text-xl">{value}</CardContent></Card>)}</div>
 <p className="text-sm text-muted-foreground">Saldo de abertura em {formatDate(account.data.data_saldo_inicial)} mais movimentos importados. Conciliar não altera o saldo nem efetua pagamentos. Registre a baixa em Pagar/Receber antes de conciliar. Cartões mostram toda a conta.</p>
 {canEdit&&account.data.ativo&&<Card><CardHeader><CardTitle>Importar extrato</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-4 text-sm"><a href={`${base}/modelo?formato=csv`} download>Baixar modelo CSV</a><a href={`${base}/modelo?formato=xlsx`} download>Baixar modelo XLSX</a></div><UploadBankForm empresa={id} conta={conta}/></CardContent></Card>}
 <Card><CardHeader><CardTitle>Últimas 20 importações</CardTitle></CardHeader><CardContent className="space-y-3">{imports.data?.map(lote=><p key={lote.id}><Link className="underline" href={`${base}/importacoes/${lote.id}`}>{lote.nome_arquivo}</Link> · {lote.status==="previa"?"Prévia aguardando confirmação":`${lote.importados} importados / ${lote.ignorados} ignorados`}</p>)}{!imports.data?.length&&<p>Nenhuma importação.</p>}</CardContent></Card>
 <form method="get" className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="extrato-inicio">Movimento de</Label><Input id="extrato-inicio" name="inicio" type="date" defaultValue={inicio}/></div><div className="space-y-2"><Label htmlFor="extrato-fim">Até</Label><Input id="extrato-fim" name="fim" type="date" defaultValue={fim}/></div><Button variant="outline">Filtrar</Button></form>
 <Card><CardHeader><CardTitle>Movimentos do extrato</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Valor</TableHead><TableHead>Conciliação</TableHead></TableRow></TableHeader><TableBody>{movements.map(m=>{
  const reconciliation=map.get(m.id),isPay=Number(m.valor_centavos)<0;
  const candidates=isPay?(paid.data??[]).filter(value=>BigInt(value.valor_pago_centavos)===-BigInt(m.valor_centavos)).map(value=>({id:value.id,label:`${value.descricao} · ${formatDate(value.pago_em)}`})):(received.data??[]).filter(value=>BigInt(value.valor_recebido_centavos)===BigInt(m.valor_centavos)).map(value=>({id:value.id,label:`${value.descricao} · ${formatDate(value.recebido_em)}`}));
  return <TableRow key={m.id}><TableCell>{formatDate(m.data_movimento)}</TableCell><TableCell className="max-w-60 whitespace-normal">{m.descricao}</TableCell><TableCell>{formatCentavos(m.valor_centavos)}</TableCell><TableCell className="min-w-64 space-y-3"><p>{reconciliation?"Conciliado":"Pendente"}</p><Link className="text-sm underline" href={`${base}/movimentos/${m.id}`}>Histórico da conciliação</Link>{canEdit&&(reconciliation?<UndoReconcileForm empresa={id} id={reconciliation.id}/>:account.data.ativo?<ReconcileForm empresa={id} movimento={m.id} tipo={isPay?"pagar":"receber"} options={candidates}/>:null)}</TableCell></TableRow>;
 })}{!movements.length&&<TableRow><TableCell colSpan={4}>Nenhum movimento neste filtro.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
 <div className="flex justify-between text-sm"><p>{list.count??0} movimento(s) · Página {page} de {pages}</p><div className="flex gap-4">{page>1&&<Link href={href(page-1)}>← Anterior</Link>}{page<pages&&<Link href={href(page+1)}>Próxima →</Link>}</div></div></>;
}
