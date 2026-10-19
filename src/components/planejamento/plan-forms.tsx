"use client";
import {useActionState,useState,type ReactNode} from "react";
import {planCommand,type PlanState} from "@/app/empresas/[id]/planejamento/actions";
import type {Option,PlanLine,Scenario} from "@/lib/planejamento";
import {inputCentavos,formatCentavos} from "@/lib/financeiro";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Alert,AlertDescription} from "@/components/ui/alert";
export function PlanForm({empresa,cenario,acao,label,children}:{empresa:string;cenario?:Scenario;acao:string;label:string;children?:ReactNode}){
 const [state,action,pending]=useActionState<PlanState,FormData>(planCommand.bind(null,empresa,cenario?.id??null,acao),{});
 return <form action={action} className="space-y-3"><input type="hidden" name="versao" value={cenario?.versao??""}/>{children}{state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}{state.success&&<Alert><AlertDescription>{state.success}</AlertDescription></Alert>}{state.link&&<p className="break-all text-sm"><a className="underline" href={state.link} target="_blank" rel="noreferrer">Abrir link individual do líder</a><br/>Copie o endereço e compartilhe somente com o destinatário. O link é mostrado apenas nesta criação.</p>}<Button disabled={pending} variant={acao==="excluir"?"outline":"default"}>{pending?"Salvando…":label}</Button></form>;
}
export function ScenarioFields({ano,nome="",requestId}:{ano:number;nome?:string;requestId:string}){
 const [request]=useState(requestId);return <><input type="hidden" name="request_id" value={request}/><div className="space-y-2"><Label>Nome do cenário<Input name="nome" defaultValue={nome} required maxLength={120}/></Label></div><div className="space-y-2"><Label>Ano<Input name="ano" type="number" min={2000} max={2100} defaultValue={ano} required/></Label></div></>;
}
export function LineEditor({empresa,cenario,categorias,centros,linhas}:{empresa:string;cenario:Scenario;categorias:Option[];centros:Option[];linhas:PlanLine[]}){
 const [edit,setEdit]=useState<{line:PlanLine|null;version:number}|null>(null);
 const [state,action,pending]=useActionState<PlanState,FormData>(async(prev,form)=>{const result=await planCommand(empresa,cenario.id,"linha",prev,form);if(result.success)setEdit(null);return result;},{});
 return <div className="space-y-4">{state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}{state.success&&<Alert><AlertDescription>{state.success}</AlertDescription></Alert>}
 {!cenario.arquivado&&<Button variant="outline" onClick={()=>setEdit({line:null,version:cenario.versao})}>Adicionar linha ao plano</Button>}
 {edit&&<form action={action} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><input type="hidden" name="versao" value={edit.version}/><input type="hidden" name="id" value={edit.line?.id??""}/>
 <Label>Descrição<Input name="descricao" defaultValue={edit.line?.descricao??""} required minLength={2} maxLength={160}/></Label>
 <Label>Tipo<select aria-label="Tipo" className="h-9 w-full rounded-md border bg-background px-3" name="tipo" defaultValue={edit.line?.tipo??"despesa"}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></Label>
 <Label>Categoria<select aria-label="Categoria" className="h-9 w-full rounded-md border bg-background px-3" name="categoria_id" defaultValue={edit.line?.categoria_id??""} required><option value="">Selecione</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nome} · {c.tipo}</option>)}</select></Label>
 <Label>Centro de custo<select aria-label="Centro de custo" className="h-9 w-full rounded-md border bg-background px-3" name="centro_custo_id" defaultValue={edit.line?.centro_custo_id??""}><option value="">Sem centro de custo</option>{centros.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Label>
 <Label>Mês<Input name="mes" type="month" min={`${cenario.ano}-01`} max={`${cenario.ano}-12`} defaultValue={edit.line?.mes.slice(0,7)??`${cenario.ano}-01`} required/></Label>
 <Label>Valor unitário (R$)<Input name="valor_unitario_centavos" inputMode="decimal" defaultValue={edit.line?inputCentavos(edit.line.valor_unitario_centavos):""} required/></Label>
 <Label>Quantidade<Input name="quantidade" type="number" min={1} max={1000000} defaultValue={edit.line?.quantidade??1} required/></Label>
 <div className="flex items-end gap-3"><Button disabled={pending}>Salvar linha do plano</Button><Button variant="outline" type="button" onClick={()=>setEdit(null)}>Fechar edição</Button></div></form>}
 <p className="text-sm text-muted-foreground">Até 50 linhas nesta página. Total = valor unitário × quantidade. Escolha categoria do mesmo tipo. Importações substituem linhas anteriores do mesmo convite após revisão explícita.</p>
 {linhas.map(line=><div key={line.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p>{line.descricao}</p><p className="text-sm text-muted-foreground">{line.mes.slice(0,7)} · {line.tipo} · {formatCentavos(line.valor_centavos)}{line.convite_id?" · contribuição importada":""}</p></div>{!cenario.arquivado&&<div className="flex flex-wrap gap-3"><Button variant="outline" onClick={()=>setEdit({line,version:cenario.versao})}>Editar {line.descricao}</Button><PlanForm empresa={empresa} cenario={cenario} acao="excluir" label={`Excluir ${line.descricao}`}><input type="hidden" name="id" value={line.id}/></PlanForm></div>}</div>)}{!linhas.length&&<p>Nenhuma linha adicional de plano.</p>}</div>;
}
