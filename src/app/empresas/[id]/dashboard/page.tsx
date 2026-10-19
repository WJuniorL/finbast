import Link from "next/link";
import {notFound} from "next/navigation";
import {requireEmpresa} from "@/lib/empresa";
import {dashboardMonthSchema,type Dashboard} from "@/lib/dashboard";
import {cashTotals} from "@/lib/fluxo-caixa";
import {formatCentavos,formatDate,hojeBahia} from "@/lib/financeiro";
import {CashChart} from "@/components/dashboard/cash-chart";
import {Card,CardContent,CardHeader,CardTitle,CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";

export default async function DashboardPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {id}=await params,{empresa,supabase}=await requireEmpresa(id),query=await searchParams;
 const month=query.mes??hojeBahia().slice(0,7),valid=dashboardMonthSchema.safeParse(month).success;
 let data:Dashboard|null=null;
 if(valid){const response=await supabase.rpc("resumo_dashboard",{p_empresa:id,p_mes:`${month}-01`});if(response.error)throw new Error("Não foi possível carregar o Dashboard.");if(!response.data)notFound();data=response.data as Dashboard;}
 const base=`/empresas/${id}`,period=data?new URLSearchParams({inicio:data.mes,fim:data.fim}):null;
 const titleHref=(tipo:string,status="aberto",fixed=false)=>`${base}/${tipo}?${new URLSearchParams({...Object.fromEntries(period??[]),status,...(fixed?{fixo:"sim"}:{})})}`;
 const flowHref=`${base}/fluxo-caixa?${period??""}`;
 const totals=data?cashTotals(data.fluxo.dias):null,last=data?.fluxo.dias.at(-1);
 return <><Link href={base}>← Voltar para {empresa.nome}</Link>
  <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Dashboard</h1><p className="text-muted-foreground">Visão financeira de {empresa.nome}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`${base}/pagar`}>Contas a Pagar</Link></Button><Button asChild variant="outline"><Link href={`${base}/receber`}>Contas a Receber</Link></Button><Button asChild><Link href={flowHref}>Ver fluxo de caixa</Link></Button></div></div>
  <form method="get" className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="dashboard-mes">Mês de referência</Label><Input id="dashboard-mes" name="mes" type="month" min="2000-01" max="2100-12" defaultValue={typeof month==="string"?month:""} required/></div><Button>Atualizar Dashboard</Button></form>
  {!valid&&<Alert variant="destructive"><AlertDescription>Escolha um mês entre 2000 e 2100.</AlertDescription></Alert>}
  {data&&totals&&last&&<>
   <p className="text-sm text-muted-foreground">Período: {formatDate(data.mes)} a {formatDate(data.fim)}. Valores do estado atual dos registros; baixas conciliadas entram uma única vez pelo extrato. Previsões sem conta definida fazem parte do consolidado.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
    {label:"Saldo realizado inicial",value:data.fluxo.saldo_inicial,href:flowHref},
    {label:"Saldo realizado final",value:last.saldo_realizado,href:flowHref},
    {label:"Saldo projetado final",value:last.saldo_projetado,href:flowHref},
    {label:"Variação de caixa no mês",value:totals.entradas-totals.saidas,href:flowHref},
    {label:"Entradas realizadas",value:totals.entradas,href:flowHref},
    {label:"Saídas realizadas",value:totals.saidas,href:flowHref},
    {label:"A pagar em aberto no mês",value:data.pagar_aberto,href:titleHref("pagar"),count:data.pagar_quantidade},
    {label:"A receber em aberto no mês",value:data.receber_aberto,href:titleHref("receber"),count:data.receber_quantidade},
   ].map(item=><Card key={item.label}><CardHeader><CardTitle className="text-sm">{item.label}</CardTitle></CardHeader><CardContent className="space-y-2"><p className="font-mono text-xl" data-testid={`dashboard-${item.label}`}>{formatCentavos(item.value)}</p>{item.count!==undefined&&<p className="text-sm text-muted-foreground">{item.count} título(s)</p>}<Link className="text-sm underline" href={item.href}>Consultar {item.label.toLowerCase()}</Link></CardContent></Card>)}</div>
   <p className="text-sm text-muted-foreground">Variação de caixa = entradas menos saídas realizadas; aberturas não são receita. O saldo projetado inclui vencidos anteriores. Valores sem conciliação precisam ser conferidos para identificar registros do mesmo fato.</p>
   <Card><CardHeader><CardTitle><h2>Evolução do caixa</h2></CardTitle><CardDescription>Compare a posição diária realizada com a projetada.</CardDescription></CardHeader><CardContent className="space-y-4"><CashChart key={String(month)} days={data.fluxo.dias}/><Link className="text-sm underline" href={flowHref}>Consultar evolução e origens no fluxo de caixa</Link></CardContent></Card>
   <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle><h2>Vencidos até ontem</h2></CardTitle><CardDescription>Todos os períodos · referência {formatDate(data.hoje)} · somente títulos abertos.</CardDescription></CardHeader><CardContent className="space-y-3"><p>A pagar: <span className="font-mono" data-testid="dashboard-pagar-vencido">{formatCentavos(data.pagar_vencido)}</span> · {data.pagar_vencidos} título(s)</p><p>A receber: <span className="font-mono" data-testid="dashboard-receber-vencido">{formatCentavos(data.receber_vencido)}</span> · {data.receber_vencidos} título(s)</p><div className="flex flex-wrap gap-4 text-sm"><Link className="underline" href={`${base}/pagar?status=vencido`}>Consultar pagamentos vencidos</Link><Link className="underline" href={`${base}/receber?status=vencido`}>Consultar recebimentos vencidos</Link></div></CardContent></Card>
    <Card><CardHeader><CardTitle><h2>Conciliação pendente</h2></CardTitle><CardDescription>Movimentos importados até {formatDate(data.fim)} sem vínculo ativo.</CardDescription></CardHeader><CardContent className="space-y-3"><p data-testid="dashboard-pendentes">{data.pendentes} movimento(s) pendente(s)</p>{data.movimentos_pendentes.map(m=><p className="text-sm" key={m.id}><Link className="underline" href={`${base}/bancos/${m.conta_id}/movimentos/${m.id}`}>{m.descricao}</Link> · {formatDate(m.data)} · {formatCentavos(m.valor)}</p>)}{!data.pendentes&&<p className="text-sm text-muted-foreground">Nenhuma pendência de conciliação neste período.</p>}<Link className="text-sm underline" href={`${base}/bancos`}>Abrir contas bancárias</Link>{data.pendentes>5&&<p className="text-xs text-muted-foreground">Mostrando os 5 movimentos mais recentes.</p>}</CardContent></Card>
   </div>
   <Card><CardHeader><CardTitle><h2>Custos fixos do mês</h2></CardTitle><CardDescription>Por vencimento, valores originais de títulos fixos abertos ou pagos; cancelados excluídos.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="font-mono text-2xl" data-testid="dashboard-custos-fixos">{formatCentavos(data.custos_fixos)}</p><Link className="text-sm underline" href={titleHref("pagar","todos",true)}>Consultar custos fixos do mês</Link><div className="grid gap-6 md:grid-cols-2"><div><h3 className="mb-3 font-medium">Por categoria</h3>{data.fixos.map(f=><p className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm" key={f.categoria_id}><span>{f.categoria}</span><span className="font-mono">{formatCentavos(f.valor)}</span></p>)}{!data.fixos.length&&<p className="text-sm text-muted-foreground">Nenhum custo fixo neste mês.</p>}{data.categorias_fixos>10&&<p className="text-xs text-muted-foreground">10 maiores categorias de {data.categorias_fixos}. O total inclui todas.</p>}</div><div><h3 className="mb-3 font-medium">Próximos 3 meses</h3>{data.projecao_fixos.map(p=><p className="flex justify-between gap-2 border-b py-2 text-sm" key={p.mes}><span>{p.mes.slice(0,7).split("-").reverse().join("/")}</span><span className="font-mono">{formatCentavos(p.valor)}</span></p>)}<p className="mt-3 text-xs text-muted-foreground">Somente títulos fixos abertos já gerados. Recorrência não define custo fixo e não cria previsão automaticamente.</p></div></div></CardContent></Card>
   <Card><CardHeader><CardTitle><h2>Títulos abertos do mês</h2></CardTitle><CardDescription>Até 10 títulos, em ordem de vencimento. Os totais consideram todos.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Situação hoje</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader><TableBody>{data.titulos.map(t=><TableRow key={t.id}><TableCell>{formatDate(t.vencimento)}</TableCell><TableCell className="max-w-64 whitespace-normal"><Link className="underline" href={`${base}/${t.tipo}/${t.id}`}>{t.descricao}</Link></TableCell><TableCell>{t.tipo==="pagar"?"A pagar":"A receber"}</TableCell><TableCell>{t.vencimento<data.hoje?"Vencido":"Em aberto"}</TableCell><TableCell className="font-mono">{formatCentavos(t.valor)}</TableCell></TableRow>)}{!data.titulos.length&&<TableRow><TableCell colSpan={5}>Nenhum título aberto neste mês.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
   <Card><CardHeader><CardTitle><h2>Saldos bancários no fim do mês</h2></CardTitle><CardDescription>Abertura mais extrato confirmado; contas arquivadas preservadas.</CardDescription></CardHeader><CardContent className="space-y-3">{data.contas.map(b=><div className="flex flex-wrap justify-between gap-2 border-b pb-3" key={b.id}><Link className="underline" href={`${base}/bancos/${b.id}`}>{b.nome}{!b.ativo?" (arquivada)":""}</Link><span className="font-mono">{formatCentavos(b.saldo)}</span></div>)}{!data.contas.length&&<p>Nenhuma conta com abertura até o fim deste mês.</p>}{data.quantidade_contas>10&&<p className="text-sm text-muted-foreground">Mostrando 10 de {data.quantidade_contas} contas.</p>}</CardContent></Card>
  </>}
 </>;
}
