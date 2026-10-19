"use client";
import {useActionState,useState} from "react";
import {requestLeaderCode,verifyLeaderCode,submitContribution,type OtpState} from "@/app/contribuicoes/[token]/actions";
import type {LeaderData} from "@/lib/planejamento";
import type {FormState} from "@/lib/form-state";
import {inputCentavos} from "@/lib/financeiro";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Button} from "@/components/ui/button";
import {Alert,AlertDescription} from "@/components/ui/alert";
function Status({state}:{state:FormState}){return <>{state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}{state.success&&<Alert><AlertDescription>{state.success}</AlertDescription></Alert>}</>;}
export function LeaderLogin({token}:{token:string}){
 const [email,setEmail]=useState(""),[confirmEmail,setConfirmEmail]=useState(""),[code,setCode]=useState("");
 const [request,requestAction,pending]=useActionState<OtpState,FormData>(requestLeaderCode.bind(null,token),{}),[verified,verifyAction,verifying]=useActionState<FormState,FormData>(verifyLeaderCode.bind(null,token),{});
 return <div className="space-y-6"><p>Informe o e-mail que recebeu este link individual. O código confirma o acesso somente ao formulário do seu setor.</p>
 <form action={requestAction} className="space-y-3"><Label>E-mail do líder<Input name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></Label><Status state={request}/><Button disabled={pending}>Enviar código por e-mail</Button></form>
 <form action={verifyAction} className="space-y-3"><Label>E-mail para confirmar<Input name="email" type="email" value={confirmEmail||request.email||""} onChange={e=>setConfirmEmail(e.target.value)} required/></Label><Label>Código recebido por e-mail<Input name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} value={code} onChange={e=>setCode(e.target.value)} required/></Label><Status state={verified}/><Button disabled={verifying}>Confirmar código</Button></form>
 <p className="text-xs text-muted-foreground">Se o link foi revogado, expirou ou o cenário foi arquivado, solicite orientação ao financeiro. Para editar novamente, a confirmação por e-mail precisa ser recente.</p></div>;
}
export function ContributionForm({token,data}:{token:string;data:LeaderData}){
 const [rows,setRows]=useState(()=>data.linhas.length?data.linhas.map(l=>({...l,mes:l.mes.slice(0,7),valor_centavos:inputCentavos(l.valor_centavos)})):[{categoria_id:"",mes:`${data.ano}-01`,descricao:"",valor_centavos:""}]);
 const [version]=useState(data.versao),[state,action,pending]=useActionState<FormState,FormData>(submitContribution.bind(null,token),{});
 const change=(i:number,key:string,value:string)=>setRows(rows.map((r,n)=>n===i?{...r,[key]:value}:r));
 return <form action={action} className="space-y-4"><input type="hidden" name="versao" value={version}/><input type="hidden" name="linhas" value={JSON.stringify(rows)}/>
 <p>Setor: <strong>{data.setor}</strong> · Ano {data.ano} · Revisão {data.revisao}</p><p className="text-sm text-muted-foreground">Suas estimativas serão revisadas pelo financeiro. O envio não cria pagamentos nem altera o cenário automaticamente.</p>
 {rows.map((row,i)=><fieldset className="space-y-3 rounded-lg border p-4" key={i}><legend className="text-sm">Estimativa {i+1}</legend><Label>Descrição da estimativa<Input value={row.descricao} onChange={e=>change(i,"descricao",e.target.value)} required minLength={2} maxLength={160}/></Label><Label>Categoria da estimativa<select aria-label="Categoria da estimativa" className="h-9 w-full rounded-md border bg-background px-3" value={row.categoria_id} onChange={e=>change(i,"categoria_id",e.target.value)} required><option value="">Selecione</option>{data.categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Label><Label>Mês da estimativa<Input type="month" min={`${data.ano}-01`} max={`${data.ano}-12`} value={row.mes} onChange={e=>change(i,"mes",e.target.value)} required/></Label><Label>Valor estimado (R$)<Input inputMode="decimal" value={row.valor_centavos} onChange={e=>change(i,"valor_centavos",e.target.value)} required/></Label>{rows.length>0&&<Button type="button" variant="outline" onClick={()=>setRows(rows.filter((_,n)=>n!==i))}>Remover estimativa {i+1}</Button>}</fieldset>)}
 <p className="text-sm text-muted-foreground">Para declarar que não há custos previstos, remova todas as estimativas e envie a contribuição vazia.</p><Button type="button" variant="outline" disabled={rows.length>=120} onClick={()=>setRows([...rows,{categoria_id:"",mes:`${data.ano}-01`,descricao:"",valor_centavos:""}])}>Adicionar estimativa</Button><Status state={state}/><Button disabled={pending||!!state.success}>Enviar contribuição</Button>
 {state.success&&<p className="text-sm"><a className="underline" href={`/contribuicoes/${token}`}>Atualizar para editar a revisão enviada</a></p>}
 </form>;
}
