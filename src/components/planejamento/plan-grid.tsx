"use client";
import {useState} from "react";
import {simulatedMonths,planDeviation,type PlanSummary,type PlanMonth} from "@/lib/planejamento";
import {formatCentavos} from "@/lib/financeiro";
import {Button} from "@/components/ui/button";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
export function PlanGrid({summary,compare}:{summary:PlanSummary;compare?:{nome:string;meses:PlanMonth[]}}){
 const [enabled,setEnabled]=useState(true),months=simulatedMonths(summary.meses,enabled),other=compare?simulatedMonths(compare.meses,enabled):null;
 return <div className="space-y-4"><Button variant={enabled?"default":"outline"} aria-pressed={enabled} onClick={()=>setEnabled(!enabled)}>Simular: {enabled?"plano ligado":"plano desligado"}</Button>
 <p className="text-sm text-muted-foreground">R = registrado por vencimento, excluindo títulos vinculados ao plano. P = orçamento da linha planejada; somente linhas sem execução vinculada entram como adicional no caixa. Executado = baixas por data de liquidação. Desvio = executado − (R + P), disponível no mês fechado; positivo em despesa indica excesso. Fixos registrados já estão na base e não são somados duas vezes.</p>
 <Table><TableHeader><TableRow><TableHead>Caixa projetado</TableHead>{months.map(m=><TableHead key={m.mes}>{m.mes.slice(5,7)}/{summary.cenario.ano}</TableHead>)}</TableRow></TableHeader><TableBody>
 <TableRow><TableCell>Base do fluxo</TableCell>{months.map(m=><TableCell key={m.mes} className="font-mono">{formatCentavos(m.caixa)}</TableCell>)}</TableRow>
 <TableRow><TableCell>Com simulação</TableCell>{months.map(m=><TableCell key={m.mes} className="font-mono" data-testid={`simulado-${m.mes}`}>{formatCentavos(m.simulado)}</TableCell>)}</TableRow>
 {other&&<TableRow><TableCell>{compare!.nome}</TableCell>{other.map(m=><TableCell key={m.mes} className="font-mono">{formatCentavos(m.simulado)}</TableCell>)}</TableRow>}
 <TableRow><TableCell>Fixos registrados</TableCell>{months.map(m=><TableCell key={m.mes} className="font-mono">{formatCentavos(m.fixos)}</TableCell>)}</TableRow>
 </TableBody></Table>
 <p className="text-sm text-muted-foreground">A base do fluxo considera extratos, baixas sem conciliação e títulos abertos; vencidos anteriores participam da projeção. Cenários com anos diferentes são comparados pelo mês do ano. Produto/custo unitário poderá alimentar o plano quando o módulo de produtos for implementado; aqui o valor unitário e a quantidade são informados manualmente.</p>
 <Table><TableHeader><TableRow><TableHead>Setor / categoria</TableHead>{months.map(m=><TableHead key={m.mes}>{m.mes.slice(5,7)} · {m.fechado?"Fechado":"Aberto"}</TableHead>)}</TableRow></TableHeader><TableBody>{summary.grade.map(row=><TableRow key={`${row.tipo}-${row.categoria_id}-${row.centro_custo_id}`}><TableCell className="min-w-44 whitespace-normal">{row.centro}<br/>{row.categoria} · {row.tipo}</TableCell>{months.map(m=>{const cell=row.meses.find(c=>c.mes===m.mes)??{mes:m.mes,base:"0",plano:"0",realizado:"0",fixos:"0"};return <TableCell className="min-w-44 space-y-1 text-xs" key={m.mes}><p>R: {formatCentavos(cell.base)}</p><p>P: {formatCentavos(enabled?cell.plano:"0")}</p><p>Executado: {formatCentavos(cell.realizado)}</p>{m.fechado&&<p>Desvio: {formatCentavos(planDeviation(cell))}</p>}</TableCell>;})}</TableRow>)}{!summary.grade.length&&<TableRow><TableCell colSpan={13}>Nenhum registro ou plano neste cenário.</TableCell></TableRow>}</TableBody></Table>
 <p className="text-xs text-muted-foreground">Fechamento congela a grade e a posição base do mês. O desvio compara com o plano salvo, mesmo com a simulação desligada. Reabra o mês para atualizar a fotografia após ajustes nos lançamentos.</p></div>;
}
