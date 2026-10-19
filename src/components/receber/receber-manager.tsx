"use client";
import { useActionState, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { loadFinanceiro } from "@/app/empresas/[id]/financeiro-actions";
import { changeReceber, expandReceber, saveReceber } from "@/app/empresas/[id]/receber/actions";
import { formatCentavos, formatDate, hojeBahia, inputCentavos, type ReceberRecord } from "@/lib/receber";
import type { FormState } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ReceberOption={id:string;nome:string;ativo:boolean};
type Options={clientes:ReceberOption[];categorias:ReceberOption[];centros:ReceberOption[]};
const selectClass="h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
function Notice({state}:{state:FormState}) {return state.error||state.success ? <Alert variant={state.error?"destructive":"default"}><AlertDescription>{state.error??state.success}</AlertDescription></Alert>:null;}
function Field({id,label,children}:{id:string;label:string;children:ReactNode}) {return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;}
function References({name,label,options,value="",optional=false,prefix,onChange}:{name:string;label:string;options:ReceberOption[];value?:string;optional?:boolean;prefix:string;onChange:(value:string)=>void}) {
  const id=`${prefix}-${name}`;
  return <Field id={id} label={label}><select id={id} name={name} value={value} onChange={event=>onChange(event.target.value)} className={selectClass} required={!optional}><option value="">{optional?"Sem centro de custo":"Selecione"}</option>{options.filter(option=>option.ativo||option.id===value).map(option=><option key={option.id} value={option.id}>{option.nome}{!option.ativo?" (arquivado)":""}</option>)}</select></Field>;
}
function Editor({empresaId,options,requestId,record,onDone}:{empresaId:string;options:Options;requestId:string;record?:ReceberRecord;onDone?:(message:string)=>void}) {
  const [request,setRequest]=useState(requestId),[modo,setModo]=useState(record?.modo??"unica");
  const defaults={descricao:record?.descricao??"",documento:record?.documento??"",cliente_id:record?.cliente_id??"",categoria_id:record?.categoria_id??"",centro_custo_id:record?.centro_custo_id??"",parcelas:"3",valor_centavos:record?inputCentavos(record.valor_centavos):"",vencimento:record?.vencimento??hojeBahia()};
  const [values,setValues]=useState<Record<string,string>>(defaults);
  const setField=(name:string,value:string)=>setValues(previous=>({...previous,[name]:value}));
  const control=(name:string)=>({value:values[name],onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setField(name,event.target.value)});
  const [state,action,pending]=useActionState(async(prev:FormState,form:FormData)=>{
    const result=await saveReceber(empresaId,prev,form);
    if(result.success) {if(record) onDone?.(result.success);else {setRequest(crypto.randomUUID());setValues(defaults);setModo("unica");}}
    return result;
  },{});
  const prefix=record?"editar":"criar";
  return <form action={action} className="space-y-5" aria-label={record?"Editar lançamento":"Novo lançamento"}>
    <Notice state={state}/><input type="hidden" name="request_id" value={request}/>
    {record&&<><input type="hidden" name="id" value={record.id}/><input type="hidden" name="atualizado_em" value={record.atualizado_em}/><input type="hidden" name="modo" value="unica"/><input type="hidden" name="parcelas" value="1"/></>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${prefix}-descricao`} label="Descrição"><Input id={`${prefix}-descricao`} name="descricao" {...control("descricao")} required minLength={2} maxLength={160}/></Field>
      <Field id={`${prefix}-documento`} label="Documento (opcional)"><Input id={`${prefix}-documento`} name="documento" {...control("documento")} maxLength={120}/></Field>
      <References prefix={prefix} name="cliente_id" label="Cliente" options={options.clientes} value={values.cliente_id} onChange={value=>setField("cliente_id",value)}/>
      <References prefix={prefix} name="categoria_id" label="Categoria de receita" options={options.categorias} value={values.categoria_id} onChange={value=>setField("categoria_id",value)}/>
      <References prefix={prefix} name="centro_custo_id" label="Centro de custo (opcional)" options={options.centros} value={values.centro_custo_id} onChange={value=>setField("centro_custo_id",value)} optional/>
      {!record&&<><Field id={`${prefix}-modo`} label="Tipo de lançamento"><select id={`${prefix}-modo`} name="modo" value={modo} onChange={event=>setModo(event.target.value as typeof modo)} className={selectClass}><option value="unica">Único</option><option value="parcelado">Parcelado</option><option value="recorrente">Recorrente mensal</option></select></Field>
      <Field id={`${prefix}-parcelas`} label="Número de parcelas"><Input id={`${prefix}-parcelas`} name="parcelas" type="number" min={modo==="parcelado"?2:1} max={120} {...control("parcelas")} disabled={modo!=="parcelado"}/>{modo!=="parcelado"&&<input type="hidden" name="parcelas" value="1"/>}</Field></>}
      <Field id={`${prefix}-valor`} label={!record&&modo==="parcelado"?"Valor total (R$)":!record&&modo==="recorrente"?"Valor mensal (R$)":"Valor (R$)"}><Input id={`${prefix}-valor`} name="valor_centavos" inputMode="decimal" placeholder="1.234,56" {...control("valor_centavos")} required maxLength={30}/></Field>
      <Field id={`${prefix}-vencimento`} label={record?"Vencimento":"Primeiro vencimento"}><Input id={`${prefix}-vencimento`} name="vencimento" type="date" min="2000-01-01" max="2100-12-31" {...control("vencimento")} required/></Field>
    </div>
    <p className="text-sm text-muted-foreground">{record?"A edição altera somente esta ocorrência, sem alterar as demais parcelas ou o modelo da recorrência.":modo==="recorrente"?"Recorrência mensal sem data final. São geradas 12 ocorrências iniciais; use Atualizar recorrências para estender o calendário. Interromper cancela somente as futuras em aberto.":modo==="parcelado"?"O total será dividido em centavos, com a diferença nas primeiras parcelas. O dia original volta após meses mais curtos.":"O lançamento ficará em aberto até uma baixa manual."}</p>
    <div className="flex gap-3"><Button type="submit" disabled={pending}>{pending?"Salvando…":record?"Salvar alteração":"Criar lançamento"}</Button>{record&&<Button type="button" variant="outline" onClick={()=>onDone?.("")}>Fechar edição</Button>}</div>
  </form>;
}
type Operation="cancelar"|"interromper"|"baixar"|"estornar";
function OperationForm({empresaId,record,operation,onDone}:{empresaId:string;record:ReceberRecord;operation:Operation;onDone:(message:string)=>void}) {
  const labels={cancelar:"Cancelar lançamento",interromper:"Interromper recorrência",baixar:"Registrar recebimento manual",estornar:"Desfazer recebimento"};
  const [values,setValues]=useState<Record<string,string>>({recebido_em:hojeBahia(),juros_centavos:"0,00",multa_centavos:"0,00",desconto_centavos:"0,00",observacao:"",motivo:""});
  const control=(name:string)=>({value:values[name],onChange:(event:ChangeEvent<HTMLInputElement>)=>setValues(previous=>({...previous,[name]:event.target.value}))});
  const [state,action,pending]=useActionState(async(prev:FormState,form:FormData)=>{
    const result=await changeReceber(empresaId,operation,prev,form);if(result.success)onDone(result.success);return result;
  },{});
  return <Card><CardHeader><CardTitle>{labels[operation]}</CardTitle><CardDescription>{record.descricao} · {formatCentavos(record.valor_centavos)} · {formatDate(record.vencimento)}</CardDescription></CardHeader><CardContent><form action={action} className="space-y-4" aria-label={labels[operation]}>
    <Notice state={state}/><input type="hidden" name="id" value={record.id}/><input type="hidden" name="atualizado_em" value={record.atualizado_em}/>
    {operation==="baixar"&&<><p className="text-sm text-muted-foreground">Confirme um recebimento já realizado fora do Finbast. Este registro não gera transferência bancária.</p><div className="grid gap-4 sm:grid-cols-2">
      <Field id="baixa-data" label="Data do recebimento"><Input id="baixa-data" name="recebido_em" type="date" {...control("recebido_em")} min="2000-01-01" max={hojeBahia()} required/></Field>
      {(["juros","multa","desconto"] as const).map(name=><Field key={name} id={`baixa-${name}`} label={`${name==="juros"?"Juros":name==="multa"?"Multa":"Desconto"} (R$)`}><Input id={`baixa-${name}`} name={`${name}_centavos`} {...control(`${name}_centavos`)} inputMode="decimal" required/></Field>)}
      <Field id="baixa-observacao" label="Observação (opcional)"><Input id="baixa-observacao" name="observacao" {...control("observacao")} maxLength={500}/></Field>
    </div></>}
    {operation==="estornar"&&<Field id="estorno-motivo" label="Motivo para desfazer o recebimento"><Input id="estorno-motivo" name="motivo" {...control("motivo")} minLength={5} maxLength={500} required/></Field>}
    {operation==="cancelar"&&<p>O lançamento será cancelado e seu histórico será preservado.</p>}
    {operation==="interromper"&&<p>A geração será interrompida e as ocorrências futuras em aberto serão canceladas. Recebimentos, vencidos e vencimentos de hoje serão preservados.</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={pending}>{pending?"Confirmando…":labels[operation]}</Button><Button type="button" variant="outline" onClick={()=>onDone("")}>Voltar</Button></div>
  </form></CardContent></Card>;
}
export function ReceberManager({empresaId,records,options,canEdit,requestId}:{empresaId:string;records:ReceberRecord[];options:Options;canEdit:boolean;requestId:string}) {
  const [selected,setSelected]=useState<{record:ReceberRecord;operation:Operation|"editar"}|null>(null),[message,setMessage]=useState("");
  const [opening,startOpening]=useTransition();
  const open=(record:ReceberRecord,operation:Operation|"editar")=>startOpening(async()=>{
    const result=await loadFinanceiro(empresaId,"receber",record.id);
    if(result.error){setMessage(result.error);return;}
    setSelected({record:{...record,...result.record} as ReceberRecord,operation});
  });
  const [expandState,expandAction,expanding]=useActionState(expandReceber.bind(null,empresaId),{});
  const done=(text:string)=>{setSelected(null);setMessage(text);};
  return <div className="space-y-6">
    {canEdit&&<Card><CardHeader><CardTitle>Novo lançamento</CardTitle><CardDescription>Prepare os clientes e categorias de receita nos cadastros da conta.</CardDescription></CardHeader><CardContent><Editor empresaId={empresaId} options={options} requestId={requestId}/></CardContent></Card>}
    {canEdit&&<form action={expandAction} className="space-y-3"><Button variant="outline" disabled={expanding}>{expanding?"Atualizando…":"Atualizar recorrências"}</Button><p className="text-sm text-muted-foreground">Estende as recorrências ativas até os próximos 12 meses, sem duplicar ocorrências.</p><Notice state={expandState}/></form>}
    <Notice state={{success:message}}/>
    {selected&&(selected.operation==="editar"?<Card><CardHeader><CardTitle>Editar lançamento</CardTitle></CardHeader><CardContent><Editor key={selected.record.id} empresaId={empresaId} options={options} record={selected.record} requestId={requestId} onDone={done}/></CardContent></Card>:<OperationForm key={`${selected.record.id}-${selected.operation}`} empresaId={empresaId} record={selected.record} operation={selected.operation} onDone={done}/>)}
    <Card><CardHeader><CardTitle>Lançamentos</CardTitle><CardDescription>{canEdit?"Selecione uma ocorrência para editar ou registrar uma operação.":"Seu acesso permite consultar os lançamentos."}</CardDescription></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Cliente / categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
        {records.map(record=><TableRow key={record.id}><TableCell><p className="font-medium">{record.descricao}</p><p className="text-xs text-muted-foreground">{record.modo==="parcelado"?`Parcela ${record.parcela}/${record.parcelas}`:record.modo==="recorrente"?`Mensal · ocorrência ${record.parcela}`:"Único"}{record.documento?` · ${record.documento}`:""}</p></TableCell><TableCell><p>{record.cliente_nome}</p><p className="text-xs text-muted-foreground">{record.categoria_nome}</p></TableCell><TableCell>{formatDate(record.vencimento)}</TableCell><TableCell className="whitespace-nowrap">{formatCentavos(record.valor_centavos)}{record.status==="recebido"&&<p className="text-xs text-muted-foreground">Recebido: {formatCentavos(record.valor_recebido_centavos!)} em {formatDate(record.recebido_em!)}</p>}</TableCell><TableCell><Badge variant={record.status==="aberto"&&record.vencimento<hojeBahia()?"destructive":"secondary"}>{record.status==="aberto"?(record.vencimento<hojeBahia()?"Vencido":"Em aberto"):record.status==="recebido"?"Recebido":"Cancelado"}</Badge></TableCell>
          <TableCell><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link href={`/empresas/${empresaId}/receber/${record.id}`}>Histórico</Link></Button>{canEdit&&<>
            {record.status==="aberto"&&<><Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"editar")}>Editar</Button><Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"cancelar")}>Cancelar</Button>{canEdit&&<Button size="sm" disabled={opening} onClick={()=>open(record,"baixar")}>Receber</Button>}</>}
            {record.status==="recebido"&&canEdit&&<Button size="sm" variant="outline" disabled={opening} onClick={()=>open(record,"estornar")}>Desfazer recebimento</Button>}
            {record.modo==="recorrente"&&record.serie_ativa&&<Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"interromper")}>Interromper</Button>}
          </>}</div></TableCell>
        </TableRow>)}
        {!records.length&&<TableRow><TableCell colSpan={6}>Nenhum lançamento neste filtro.</TableCell></TableRow>}
      </TableBody></Table>
    </CardContent></Card>
  </div>;
}
