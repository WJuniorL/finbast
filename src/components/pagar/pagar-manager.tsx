"use client";
import { useActionState, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { loadFinanceiro } from "@/app/empresas/[id]/financeiro-actions";
import { changePagar, configureApproval, expandPagar, requestApprovalCode, savePagar } from "@/app/empresas/[id]/pagar/actions";
import { formatCentavos, formatDate, hojeBahia, inputCentavos, type PagarRecord } from "@/lib/pagar";
import type { FormState } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PagarOption={id:string;nome:string;ativo:boolean};
type Options={fornecedores:PagarOption[];categorias:PagarOption[];centros:PagarOption[]};
const selectClass="h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
function Notice({state}:{state:FormState}) {return state.error||state.success ? <Alert variant={state.error?"destructive":"default"}><AlertDescription>{state.error??state.success}</AlertDescription></Alert>:null;}
function Field({id,label,children}:{id:string;label:string;children:ReactNode}) {return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;}
function References({name,label,options,value="",optional=false,prefix,onChange}:{name:string;label:string;options:PagarOption[];value?:string;optional?:boolean;prefix:string;onChange:(value:string)=>void}) {
  const id=`${prefix}-${name}`;
  return <Field id={id} label={label}><select id={id} name={name} value={value} onChange={event=>onChange(event.target.value)} className={selectClass} required={!optional}><option value="">{optional?"Sem centro de custo":"Selecione"}</option>{options.filter(option=>option.ativo||option.id===value).map(option=><option key={option.id} value={option.id}>{option.nome}{!option.ativo?" (arquivado)":""}</option>)}</select></Field>;
}
function Editor({empresaId,options,requestId,record,onDone}:{empresaId:string;options:Options;requestId:string;record?:PagarRecord;onDone?:(message:string)=>void}) {
  const [request,setRequest]=useState(requestId),[modo,setModo]=useState(record?.modo??"unica");
  const defaults={descricao:record?.descricao??"",documento:record?.documento??"",fornecedor_id:record?.fornecedor_id??"",categoria_id:record?.categoria_id??"",centro_custo_id:record?.centro_custo_id??"",custo_fixo_override:record?.custo_fixo_override==null?"categoria":record.custo_fixo_override?"sim":"nao",parcelas:"3",valor_centavos:record?inputCentavos(record.valor_centavos):"",vencimento:record?.vencimento??hojeBahia()};
  const [values,setValues]=useState<Record<string,string>>(defaults);
  const setField=(name:string,value:string)=>setValues(previous=>({...previous,[name]:value}));
  const control=(name:string)=>({value:values[name],onChange:(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setField(name,event.target.value)});
  const [state,action,pending]=useActionState(async(prev:FormState,form:FormData)=>{
    const result=await savePagar(empresaId,prev,form);
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
      <References prefix={prefix} name="fornecedor_id" label="Fornecedor" options={options.fornecedores} value={values.fornecedor_id} onChange={value=>setField("fornecedor_id",value)}/>
      <References prefix={prefix} name="categoria_id" label="Categoria de despesa" options={options.categorias} value={values.categoria_id} onChange={value=>setField("categoria_id",value)}/>
      <References prefix={prefix} name="centro_custo_id" label="Centro de custo (opcional)" options={options.centros} value={values.centro_custo_id} onChange={value=>setField("centro_custo_id",value)} optional/>
      <Field id={`${prefix}-fixo`} label="Custo fixo"><select id={`${prefix}-fixo`} name="custo_fixo_override" className={selectClass} {...control("custo_fixo_override")}><option value="categoria">Usar configuração da categoria</option><option value="sim">Sim</option><option value="nao">Não</option></select></Field>
      {!record&&<><Field id={`${prefix}-modo`} label="Tipo de lançamento"><select id={`${prefix}-modo`} name="modo" value={modo} onChange={event=>setModo(event.target.value as typeof modo)} className={selectClass}><option value="unica">Único</option><option value="parcelado">Parcelado</option><option value="recorrente">Recorrente mensal</option></select></Field>
      <Field id={`${prefix}-parcelas`} label="Número de parcelas"><Input id={`${prefix}-parcelas`} name="parcelas" type="number" min={modo==="parcelado"?2:1} max={120} {...control("parcelas")} disabled={modo!=="parcelado"}/>{modo!=="parcelado"&&<input type="hidden" name="parcelas" value="1"/>}</Field></>}
      <Field id={`${prefix}-valor`} label={!record&&modo==="parcelado"?"Valor total (R$)":!record&&modo==="recorrente"?"Valor mensal (R$)":"Valor (R$)"}><Input id={`${prefix}-valor`} name="valor_centavos" inputMode="decimal" placeholder="1.234,56" {...control("valor_centavos")} required maxLength={30}/></Field>
      <Field id={`${prefix}-vencimento`} label={record?"Vencimento":"Primeiro vencimento"}><Input id={`${prefix}-vencimento`} name="vencimento" type="date" min="2000-01-01" max="2100-12-31" {...control("vencimento")} required/></Field>
    </div>
    <p className="text-sm text-muted-foreground">{record?"A edição altera somente esta ocorrência, sem alterar as demais parcelas ou o modelo da recorrência.":modo==="recorrente"?"Recorrência mensal sem data final. São geradas 12 ocorrências iniciais; use Atualizar recorrências para estender o calendário. Interromper cancela somente as futuras em aberto.":modo==="parcelado"?"O total será dividido em centavos, com a diferença nas primeiras parcelas. O dia original volta após meses mais curtos.":"O lançamento ficará em aberto até uma baixa manual."}</p>
    <div className="flex gap-3"><Button type="submit" disabled={pending}>{pending?"Salvando…":record?"Salvar alteração":"Criar lançamento"}</Button>{record&&<Button type="button" variant="outline" onClick={()=>onDone?.("")}>Fechar edição</Button>}</div>
  </form>;
}
function Approval({empresaId,configured}:{empresaId:string;configured:boolean}) {
  const [changing,setChanging]=useState(false);
  const [sendState,sendAction,sending]=useActionState(requestApprovalCode.bind(null,empresaId),{});
  const [state,action,pending]=useActionState(configureApproval.bind(null,empresaId,configured),{});
  return <Card><CardHeader><CardTitle>Senha de aprovação</CardTitle><CardDescription>Seis dígitos diferentes, sem sequência. É pessoal e vale para todas as suas contas.</CardDescription></CardHeader><CardContent className="space-y-4">
    <Notice state={state}/>
    {configured&&!changing?<><p className="text-sm text-muted-foreground">Senha configurada. Cinco tentativas incorretas bloqueiam a aprovação por 15 minutos.</p><Button variant="outline" onClick={()=>setChanging(true)}>Trocar senha de aprovação</Button></>:<>
      {configured&&<><form action={sendAction}><Button variant="outline" disabled={sending}>{sending?"Enviando…":"Enviar código por e-mail"}</Button></form><Notice state={sendState}/></>}
      <form action={action} className="grid gap-4 sm:grid-cols-2" aria-label="Configurar senha de aprovação">
        {configured&&<Field id="aprovacao-codigo" label="Código recebido por e-mail"><Input id="aprovacao-codigo" name="codigo" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" required minLength={6} maxLength={10}/></Field>}
        <Field id="aprovacao-senha" label="Nova senha de aprovação"><Input id="aprovacao-senha" name="senha" type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" required minLength={6} maxLength={6}/></Field>
        <Field id="aprovacao-confirmacao" label="Confirmar senha de aprovação"><Input id="aprovacao-confirmacao" name="confirmacao" type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" required minLength={6} maxLength={6}/></Field>
        <div className="flex items-end"><Button disabled={pending}>{pending?"Salvando…":configured?"Confirmar troca":"Configurar senha"}</Button></div>
      </form>
    </>}
  </CardContent></Card>;
}
type Operation="cancelar"|"interromper"|"baixar"|"estornar";
function OperationForm({empresaId,record,operation,onDone}:{empresaId:string;record:PagarRecord;operation:Operation;onDone:(message:string)=>void}) {
  const labels={cancelar:"Cancelar lançamento",interromper:"Interromper recorrência",baixar:"Registrar baixa manual",estornar:"Desfazer baixa"};
  const [values,setValues]=useState<Record<string,string>>({pago_em:hojeBahia(),juros_centavos:"0,00",multa_centavos:"0,00",desconto_centavos:"0,00",observacao:"",motivo:""});
  const control=(name:string)=>({value:values[name],onChange:(event:ChangeEvent<HTMLInputElement>)=>setValues(previous=>({...previous,[name]:event.target.value}))});
  const [state,action,pending]=useActionState(async(prev:FormState,form:FormData)=>{
    const result=await changePagar(empresaId,operation,prev,form);if(result.success)onDone(result.success);return result;
  },{});
  return <Card><CardHeader><CardTitle>{labels[operation]}</CardTitle><CardDescription>{record.descricao} · {formatCentavos(record.valor_centavos)} · {formatDate(record.vencimento)}</CardDescription></CardHeader><CardContent><form action={action} className="space-y-4" aria-label={labels[operation]}>
    <Notice state={state}/><input type="hidden" name="id" value={record.id}/><input type="hidden" name="atualizado_em" value={record.atualizado_em}/>
    {operation==="baixar"&&<><p className="text-sm text-muted-foreground">Confirme um pagamento já realizado fora do Finbast. Nenhuma transferência bancária será feita.</p><div className="grid gap-4 sm:grid-cols-2">
      <Field id="baixa-data" label="Data do pagamento"><Input id="baixa-data" name="pago_em" type="date" {...control("pago_em")} min="2000-01-01" max={hojeBahia()} required/></Field>
      {(["juros","multa","desconto"] as const).map(name=><Field key={name} id={`baixa-${name}`} label={`${name==="juros"?"Juros":name==="multa"?"Multa":"Desconto"} (R$)`}><Input id={`baixa-${name}`} name={`${name}_centavos`} {...control(`${name}_centavos`)} inputMode="decimal" required/></Field>)}
      <Field id="baixa-observacao" label="Observação (opcional)"><Input id="baixa-observacao" name="observacao" {...control("observacao")} maxLength={500}/></Field>
    </div></>}
    {operation==="estornar"&&<Field id="estorno-motivo" label="Motivo para desfazer a baixa"><Input id="estorno-motivo" name="motivo" {...control("motivo")} minLength={5} maxLength={500} required/></Field>}
    {(operation==="baixar"||operation==="estornar")&&<Field id="operacao-senha" label="Senha de aprovação"><Input id="operacao-senha" name="senha" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></Field>}
    {operation==="cancelar"&&<p>O lançamento será cancelado e seu histórico será preservado.</p>}
    {operation==="interromper"&&<p>A geração será interrompida e as ocorrências futuras em aberto serão canceladas. Pagamentos, vencidos e vencimentos de hoje serão preservados.</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={pending}>{pending?"Confirmando…":labels[operation]}</Button><Button type="button" variant="outline" onClick={()=>onDone("")}>Voltar</Button></div>
  </form></CardContent></Card>;
}
export function PagarManager({empresaId,records,options,canEdit,canSettle,approvalConfigured,requestId}:{empresaId:string;records:PagarRecord[];options:Options;canEdit:boolean;canSettle:boolean;approvalConfigured:boolean;requestId:string}) {
  const [selected,setSelected]=useState<{record:PagarRecord;operation:Operation|"editar"}|null>(null),[message,setMessage]=useState("");
  const [opening,startOpening]=useTransition();
  const open=(record:PagarRecord,operation:Operation|"editar")=>startOpening(async()=>{
    const result=await loadFinanceiro(empresaId,"pagar",record.id);
    if(result.error){setMessage(result.error);return;}
    setSelected({record:{...record,...result.record} as PagarRecord,operation});
  });
  const [expandState,expandAction,expanding]=useActionState(expandPagar.bind(null,empresaId),{});
  const done=(text:string)=>{setSelected(null);setMessage(text);};
  return <div className="space-y-6">
    {canSettle&&<Approval empresaId={empresaId} configured={approvalConfigured}/>}
    {canEdit&&<Card><CardHeader><CardTitle>Novo lançamento</CardTitle><CardDescription>Prepare os fornecedores e categorias de despesa nos cadastros da conta.</CardDescription></CardHeader><CardContent><Editor empresaId={empresaId} options={options} requestId={requestId}/></CardContent></Card>}
    {canEdit&&<form action={expandAction} className="space-y-3"><Button variant="outline" disabled={expanding}>{expanding?"Atualizando…":"Atualizar recorrências"}</Button><p className="text-sm text-muted-foreground">Estende as recorrências ativas até os próximos 12 meses, sem duplicar ocorrências.</p><Notice state={expandState}/></form>}
    <Notice state={{success:message}}/>
    {selected&&(selected.operation==="editar"?<Card><CardHeader><CardTitle>Editar lançamento</CardTitle></CardHeader><CardContent><Editor key={selected.record.id} empresaId={empresaId} options={options} record={selected.record} requestId={requestId} onDone={done}/></CardContent></Card>:<OperationForm key={`${selected.record.id}-${selected.operation}`} empresaId={empresaId} record={selected.record} operation={selected.operation} onDone={done}/>)}
    <Card><CardHeader><CardTitle>Lançamentos</CardTitle><CardDescription>{canEdit?"Selecione uma ocorrência para editar ou registrar uma operação.":"Seu acesso permite consultar os lançamentos."}</CardDescription></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Fornecedor / categoria</TableHead><TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Situação</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
        {records.map(record=><TableRow key={record.id}><TableCell><p className="font-medium">{record.descricao}</p><p className="text-xs text-muted-foreground">{record.modo==="parcelado"?`Parcela ${record.parcela}/${record.parcelas}`:record.modo==="recorrente"?`Mensal · ocorrência ${record.parcela}`:"Único"}{record.documento?` · ${record.documento}`:""}</p></TableCell><TableCell><p>{record.fornecedor_nome}</p><p className="text-xs text-muted-foreground">{record.categoria_nome}</p>{record.custo_fixo&&<Badge variant="secondary">Custo fixo</Badge>}</TableCell><TableCell>{formatDate(record.vencimento)}</TableCell><TableCell className="whitespace-nowrap">{formatCentavos(record.valor_centavos)}{record.status==="pago"&&<p className="text-xs text-muted-foreground">Pago: {formatCentavos(record.valor_pago_centavos!)} em {formatDate(record.pago_em!)}</p>}</TableCell><TableCell><Badge variant={record.status==="aberto"&&record.vencimento<hojeBahia()?"destructive":"secondary"}>{record.status==="aberto"?(record.vencimento<hojeBahia()?"Vencido":"Em aberto"):record.status==="pago"?"Pago":"Cancelado"}</Badge></TableCell>
          <TableCell><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link href={`/empresas/${empresaId}/pagar/${record.id}`}>Histórico</Link></Button>{canEdit&&<>
            {record.status==="aberto"&&<><Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"editar")}>Editar</Button><Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"cancelar")}>Cancelar</Button>{canSettle&&<Button size="sm" disabled={opening} onClick={()=>open(record,"baixar")}>Baixar</Button>}</>}
            {record.status==="pago"&&canSettle&&<Button size="sm" variant="outline" disabled={opening} onClick={()=>open(record,"estornar")}>Desfazer baixa</Button>}
            {record.modo==="recorrente"&&record.serie_ativa&&<Button variant="outline" size="sm" disabled={opening} onClick={()=>open(record,"interromper")}>Interromper</Button>}
          </>}</div></TableCell>
        </TableRow>)}
        {!records.length&&<TableRow><TableCell colSpan={6}>Nenhum lançamento neste filtro.</TableCell></TableRow>}
      </TableBody></Table>
    </CardContent></Card>
  </div>;
}
