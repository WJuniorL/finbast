"use client";
import {useActionState,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {archiveBank,saveBank,confirmBankImport,reconcileBank,undoBankReconciliation} from "@/app/empresas/[id]/bancos/actions";
import type {BankAccount} from "@/lib/bancos";
import {hojeBahia,inputCentavos} from "@/lib/financeiro";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Alert,AlertDescription} from "@/components/ui/alert";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import type {FormState} from "@/lib/form-state";
export function BankNotice({state}:{state:FormState}){return state.error||state.success?<Alert variant={state.error?"destructive":"default"}><AlertDescription>{state.error??state.success}</AlertDescription></Alert>:null;}
function AccountEditor({empresa,account,onSaved}:{empresa:string;account?:BankAccount;onSaved:()=>void}){
 const [values,setValues]=useState<Record<string,string>>({nome:account?.nome??"",banco:account?.banco??"",codigo_banco:account?.codigo_banco??"",agencia:account?.agencia??"",numero:account?.numero??"",saldo_inicial_centavos:account?`${Number(account.saldo_inicial_centavos)<0?"-":""}${inputCentavos(Math.abs(Number(account.saldo_inicial_centavos)))}`:"0,00",data_saldo_inicial:account?.data_saldo_inicial??hojeBahia()});
 const [state,action,pending]=useActionState(async(prev:FormState,form:FormData)=>{const result=await saveBank(empresa,prev,form);if(result.success)onSaved();return result;},{});
 const labels:Record<string,string>={nome:"Nome da conta bancária",banco:"Instituição",codigo_banco:"Código do banco (opcional)",agencia:"Agência (opcional)",numero:"Número da conta",saldo_inicial_centavos:"Saldo de abertura (R$)",data_saldo_inicial:"Data do saldo de abertura"};
 return <form action={action} className="space-y-4" aria-label={account?"Editar conta bancária":"Nova conta bancária"}><BankNotice state={state}/>{account&&<><input type="hidden" name="id" value={account.id}/><input type="hidden" name="atualizado_em" value={account.atualizado_em}/></>}
 <div className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key,label])=><div key={key} className="space-y-2"><Label htmlFor={`conta-${key}`}>{label}</Label><Input id={`conta-${key}`} name={key} value={values[key]} onChange={event=>setValues(prev=>({...prev,[key]:event.target.value}))} type={key==="data_saldo_inicial"?"date":"text"} max={key==="data_saldo_inicial"?hojeBahia():undefined} required={!["codigo_banco","agencia"].includes(key)} maxLength={key==="nome"||key==="banco"?120:50}/></div>)}</div>
 <p className="text-sm text-muted-foreground">Saldo de abertura do início do dia escolhido. Importe somente movimentos dessa data em diante. Após uma prévia, saldo e identificação ficam preservados.</p><Button disabled={pending}>{pending?"Salvando…":"Salvar conta bancária"}</Button></form>;
}
function AccountStatus({empresa,account}:{empresa:string;account:BankAccount}){
 const [state,action,pending]=useActionState(archiveBank.bind(null,empresa),{});
 return <form action={action}><input type="hidden" name="id" value={account.id}/><input type="hidden" name="atualizado_em" value={account.atualizado_em}/><input type="hidden" name="ativo" value={String(!account.ativo)}/><Button variant="outline" size="sm" disabled={pending}>{account.ativo?"Arquivar":"Reativar"}</Button><BankNotice state={state}/></form>;
}
export function BankAccounts({empresa,accounts,canEdit}:{empresa:string;accounts:BankAccount[];canEdit:boolean}){
 const [selected,setSelected]=useState<BankAccount>(),[revision,setRevision]=useState(0),[saved,setSaved]=useState(false);
 return <div className="space-y-6">{canEdit&&<Card><CardHeader><CardTitle>{selected?"Editar conta bancária":"Nova conta bancária"}</CardTitle></CardHeader><CardContent className="space-y-4">{saved&&<BankNotice state={{success:"Conta bancária salva."}}/>}<AccountEditor key={`${selected?.id??"new"}-${revision}`} empresa={empresa} account={selected} onSaved={()=>{setSaved(true);setSelected(undefined);setRevision(value=>value+1);}}/>{selected&&<Button variant="outline" onClick={()=>setSelected(undefined)}>Fechar edição</Button>}</CardContent></Card>}
 {accounts.map(account=><Card key={account.id}><CardHeader><CardTitle>{account.nome}</CardTitle></CardHeader><CardContent className="space-y-4"><p>{account.banco} · {account.numero} · {account.ativo?"Ativa":"Arquivada"}</p><div className="flex flex-wrap gap-3"><Button asChild><Link href={`/empresas/${empresa}/bancos/${account.id}`}>Abrir extrato</Link></Button>{canEdit&&<><Button variant="outline" onClick={()=>{setSelected(account);setSaved(false);}}>Editar</Button><AccountStatus empresa={empresa} account={account}/></>}</div></CardContent></Card>)}{!accounts.length&&<p>Nenhuma conta bancária cadastrada.</p>}</div>;
}
export function UploadBankForm({empresa,conta}:{empresa:string;conta:string}){
 const router=useRouter();
 const [state,action,pending]=useActionState(async(previous:FormState,form:FormData):Promise<FormState>=>{
  void previous;
  try{
   const response=await fetch(`/empresas/${empresa}/bancos/${conta}/upload`,{method:"POST",body:form});
   const result=await response.json();
   if(!response.ok||typeof result.id!=="string")return {error:result.error??"Não foi possível ler o arquivo."};
   router.push(`/empresas/${empresa}/bancos/${conta}/importacoes/${encodeURIComponent(result.id)}`);
   return {success:"Prévia criada."};
  }catch{return {error:"Não foi possível enviar o arquivo. Atualize a página e tente novamente."};}
 },{});
 return <form action={action} className="space-y-4"><BankNotice state={state}/><Label htmlFor="arquivo-extrato">Arquivo CSV, XLSX ou OFX</Label><Input id="arquivo-extrato" name="arquivo" type="file" accept=".csv,.xlsx,.ofx" required/><p className="text-sm text-muted-foreground">Até 5 MB e 1.000 movimentos. CSV/XLSX seguem o modelo. OFX precisa corresponder ao número da conta e estar em BRL. A prévia não altera o saldo.</p><Button disabled={pending}>{pending?"Lendo arquivo…":"Gerar prévia"}</Button></form>;
}
export function ConfirmBankForm({empresa,id}:{empresa:string;id:string}){
 const [state,action,pending]=useActionState(confirmBankImport.bind(null,empresa,id),{});
 return <form action={action} className="space-y-4"><BankNotice state={state}/><Button disabled={pending}>{pending?"Importando…":"Confirmar importação"}</Button></form>;
}
export function ReconcileForm({empresa,movimento,tipo,options}:{empresa:string;movimento:string;tipo:"pagar"|"receber";options:{id:string;label:string}[]}){
 const [state,action,pending]=useActionState(reconcileBank.bind(null,empresa,movimento),{});
 return <form action={action} className="space-y-3"><BankNotice state={state}/><input type="hidden" name="tipo" value={tipo}/><Label htmlFor={`conciliar-${movimento}`}>Lançamento {tipo==="pagar"?"pago":"recebido"} compatível</Label><select id={`conciliar-${movimento}`} name="lancamento" required className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"><option value="">Selecione</option>{options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select><Button size="sm" disabled={pending||!options.length}>{pending?"Conciliando…":"Conciliar"}</Button></form>;
}
export function UndoReconcileForm({empresa,id}:{empresa:string;id:string}){
 const [state,action,pending]=useActionState(undoBankReconciliation.bind(null,empresa,id),{});
 return <form action={action} className="space-y-3"><BankNotice state={state}/><Label htmlFor={`desfazer-${id}`}>Motivo para desfazer conciliação</Label><Input id={`desfazer-${id}`} name="motivo" required minLength={5} maxLength={500}/><Button size="sm" variant="outline" disabled={pending}>Desfazer conciliação</Button></form>;
}
