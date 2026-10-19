"use client";
import {useActionState,useState} from "react";
import {linkExecution,type PlanState} from "@/app/empresas/[id]/planejamento/actions";
import type {PlanLine,Scenario} from "@/lib/planejamento";
import {formatCentavos} from "@/lib/financeiro";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Alert,AlertDescription} from "@/components/ui/alert";
export type ExecutionSource={id:string;descricao:string;vencimento:string;valor_centavos:number|string;tipo:string};
export type ExecutionLink={linha_id:string;pagar_id:string|null;receber_id:string|null};
export function ExecutionLinks({empresa,cenario,lines,sources,links}:{empresa:string;cenario:Scenario;lines:PlanLine[];sources:ExecutionSource[];links:ExecutionLink[]}){
 const [edit,setEdit]=useState<{line:PlanLine;version:number}|null>(null),[state,action,pending]=useActionState<PlanState,FormData>(async(prev,form)=>{const result=await linkExecution(empresa,cenario.id,prev,form);if(result.success)setEdit(null);return result;},{});
 const currentLink=edit?links.find(v=>v.linha_id===edit.line.id):null,currentId=currentLink?.pagar_id??currentLink?.receber_id??"";
 return <div className="space-y-3"><h3 className="font-medium">Vincular a execução real</h3><p className="text-sm text-muted-foreground">Quando uma ação do plano já virou um título, vincule-o aqui para evitar somar o plano novamente ao caixa. A estimativa continua no orçamento e no desvio. Um título por linha e uma linha por título em cada cenário. Títulos cancelados voltam a deixar a estimativa como adicional, respeitando a fotografia de meses fechados. As listas oferecem até 500 títulos recentes de cada tipo.</p>
 {state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}{state.success&&<Alert><AlertDescription>{state.success}</AlertDescription></Alert>}
 {lines.map(l=><div key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2"><p className="text-sm">{l.descricao} · {links.some(v=>v.linha_id===l.id)?"Vínculo registrado":"Sem vínculo"}</p><Button variant="outline" onClick={()=>setEdit({line:l,version:cenario.versao})}>Vincular {l.descricao}</Button></div>)}
 {edit&&<form action={action} className="space-y-3 rounded-lg border p-3"><input type="hidden" name="versao" value={edit.version}/><input type="hidden" name="linha_id" value={edit.line.id}/><input type="hidden" name="tipo" value={edit.line.tipo}/><Label htmlFor="plano-execucao">Título real de {edit.line.descricao}</Label><select id="plano-execucao" name="lancamento_id" className="h-9 w-full rounded-md border bg-background px-3" defaultValue={currentId}><option value="">Sem vínculo / desvincular</option>{currentId&&!sources.some(s=>s.id===currentId)&&<option value={currentId}>Vínculo atual (consulte no módulo financeiro)</option>}{sources.filter(s=>s.tipo===edit.line.tipo).map(s=><option key={s.id} value={s.id}>{s.descricao} · {s.vencimento} · {formatCentavos(s.valor_centavos)}</option>)}</select><div className="flex gap-3"><Button disabled={pending}>Salvar vínculo de execução</Button><Button type="button" variant="outline" onClick={()=>setEdit(null)}>Cancelar vínculo</Button></div></form>}
 </div>;
}
