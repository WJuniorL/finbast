import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {requireEmpresa} from "@/lib/empresa";
import {dateSchema,formatCentavos,formatDate,hojeBahia} from "@/lib/financeiro";
import {cashTotals,groupCashDays,type CashFlow} from "@/lib/fluxo-caixa";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";

type Query = {inicio?:string;fim?:string;conta?:string;agrupamento?:string;page?:string};
export default async function CashFlowPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}) {
 const {id}=await params,{supabase,empresa}=await requireEmpresa(id),q=await searchParams;
 const today=hojeBahia(),month=today.slice(0,7),last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 const inicio=q.inicio??`${month}-01`,fim=q.fim??`${month}-${last}`,conta=q.conta??"",monthly=q.agrupamento==="mensal";
 const accounts=await supabase.from("contas_bancarias").select("id,nome,ativo").eq("empresa_id",id).order("nome");
 if(accounts.error)throw new Error("Não foi possível carregar as contas bancárias.");
 const validDates=dateSchema.safeParse(inicio).success&&dateSchema.safeParse(fim).success&&fim>=inicio&&(Date.parse(fim)-Date.parse(inicio))/86400000<=365;
 const validAccount=conta===""||conta==="sem-conta"||z.string().uuid().safeParse(conta).success;
 const page=/^\d+$/.test(q.page??"")?Math.max(1,Math.min(1000000,Number(q.page))):1;
 let data:CashFlow|null=null;
 if(validDates&&validAccount){
  const result=await supabase.rpc("fluxo_caixa",{p_empresa:id,p_inicio:inicio,p_fim:fim,p_conta:conta&&conta!=="sem-conta"?conta:null,p_sem_conta:conta==="sem-conta",p_pagina:page});
  if(result.error)throw new Error("Não foi possível carregar o fluxo de caixa.");
  if(!result.data)notFound();data=result.data as CashFlow;
 }
 const href=(number:number)=>`?${new URLSearchParams({inicio,fim,conta,agrupamento:monthly?"mensal":"diario",page:String(number)})}`;
 const rows=data?groupCashDays(data.dias,monthly):[],totals=data?cashTotals(data.dias):null,lastDay=data?.dias.at(-1);
 const origins={abertura:"Saldo de abertura",extrato:"Extrato bancário",pagar:"Contas a Pagar",receber:"Contas a Receber"};
 const accountNames=new Map(accounts.data.map(account=>[account.id,account.nome]));
 return <><Link href={`/empresas/${id}`}>← Voltar para {empresa.nome}</Link>
  <div><h1 className="text-3xl font-bold">Fluxo de caixa</h1><p className="text-muted-foreground">Entradas, saídas e saldo realizado ou projetado.</p></div>
  <form method="get" className="flex flex-wrap items-end gap-3">
   <div className="space-y-2"><Label htmlFor="fluxo-inicio">Período de</Label><Input id="fluxo-inicio" name="inicio" type="date" defaultValue={inicio} required/></div>
   <div className="space-y-2"><Label htmlFor="fluxo-fim">Até</Label><Input id="fluxo-fim" name="fim" type="date" defaultValue={fim} required/></div>
   <div className="space-y-2"><Label htmlFor="fluxo-conta">Conta bancária</Label><select id="fluxo-conta" name="conta" defaultValue={conta} className="h-9 w-full rounded-md border bg-background px-3 text-sm"><option value="">Todas as contas + sem conta definida</option><option value="sem-conta">Sem conta definida</option>{accounts.data.map(account=><option key={account.id} value={account.id}>{account.nome}{!account.ativo?" (arquivada)":""}</option>)}</select></div>
   <div className="space-y-2"><Label htmlFor="fluxo-grupo">Agrupar por</Label><select id="fluxo-grupo" name="agrupamento" defaultValue={monthly?"mensal":"diario"} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="diario">Dia</option><option value="mensal">Mês</option></select></div><Button>Aplicar filtros</Button>
  </form>
  {(!validDates||!validAccount)&&<Alert variant="destructive"><AlertDescription>Filtros inválidos. Use datas entre 2000 e 2100, início até o fim e no máximo 366 dias.</AlertDescription></Alert>}
  <p className="text-sm text-muted-foreground">O extrato usa a data do movimento. Baixas conciliadas entram uma única vez, pelo extrato. Baixas sem conciliação e títulos em aberto ficam sem conta definida. Contas arquivadas preservam seus valores.</p>
  {conta&&conta!=="sem-conta"&&<Alert><AlertDescription>Esta conta mostra o extrato e o saldo de abertura. As previsões de Pagar/Receber ainda não têm conta definida; consulte a visão consolidada ou “Sem conta definida”.</AlertDescription></Alert>}
  <p className="text-sm text-muted-foreground">A previsão usa os títulos atualmente em aberto, com valores originais e vencimentos. Vencidos antes do período entram no saldo projetado inicial, sem alterar o realizado. Recorrências entram somente após gerar suas ocorrências. Esta consulta não reconstrói o estado histórico dos títulos.</p>
  {data&&totals&&lastDay&&<>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[
    ["Saldo realizado inicial",data.saldo_inicial],["Entradas realizadas",totals.entradas],["Saídas realizadas",totals.saidas],
    ["Saldo realizado final",lastDay.saldo_realizado],["Saldo projetado final",lastDay.saldo_projetado],["Aberturas no período",totals.abertura],
    ["Entradas previstas no período",totals.previstas_entradas],["Saídas previstas no período",totals.previstas_saidas],
    ["Vencidos anteriores · a receber",data.vencidos_entradas],["Vencidos anteriores · a pagar",data.vencidos_saidas],
   ].map(([label,value])=><Card key={String(label)}><CardHeader><CardTitle className="text-sm">{String(label)}</CardTitle></CardHeader><CardContent className="font-mono text-xl" data-testid={String(label)}>{formatCentavos(value)}</CardContent></Card>)}</div>
   <Card><CardHeader><CardTitle>Evolução {monthly?"mensal":"diária"}</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow>{["Período","Aberturas","Entradas realizadas","Saídas realizadas","Entradas previstas","Saídas previstas","Saldo realizado","Saldo projetado"].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.data}><TableCell>{monthly?row.data.split("-").reverse().join("/"):formatDate(row.data)}</TableCell>{(["abertura","entradas","saidas","previstas_entradas","previstas_saidas","saldo_realizado","saldo_projetado"] as const).map(key=><TableCell className="font-mono" key={key}>{formatCentavos(row[key])}</TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>
   <Card><CardHeader><CardTitle>Origens dos valores</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow>{["Data","Descrição","Origem","Conta","Situação","Valor"].map(label=><TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{data.movimentos.map(m=>{
    const target=m.conta_id?(m.origem==="abertura"?`bancos/${m.conta_id}`:`bancos/${m.conta_id}/movimentos/${m.id}`):`${m.origem}/${m.id}`;
    return <TableRow key={`${m.origem}-${m.id}`}><TableCell>{formatDate(m.data)}</TableCell><TableCell className="max-w-64 whitespace-normal"><Link className="underline" href={`/empresas/${id}/${target}`}>{m.descricao}</Link></TableCell><TableCell>{origins[m.origem]}</TableCell><TableCell>{m.conta_id?accountNames.get(m.conta_id):"Sem conta definida"}</TableCell><TableCell>{m.tipo==="realizado"?"Realizado":m.data<inicio?"Previsto · vencido antes do período":"Previsto"}</TableCell><TableCell className="font-mono">{formatCentavos(m.valor)}</TableCell></TableRow>;
   })}{!data.movimentos.length&&<TableRow><TableCell colSpan={6}>Nenhum movimento neste filtro.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
   <div className="flex flex-wrap justify-between gap-3 text-sm"><p>{data.total} origem(ns) · Página {data.pagina} de {Math.max(1,Math.ceil(data.total/50))}</p><div className="flex gap-4">{data.pagina>1&&<Link href={href(data.pagina-1)}>← Anterior</Link>}{data.pagina<Math.ceil(data.total/50)&&<Link href={href(data.pagina+1)}>Próxima →</Link>}</div></div>
  </>}
 </>;
}
