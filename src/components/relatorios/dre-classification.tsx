"use client";
import {useActionState,useState} from "react";
import {classifyDre} from "@/app/empresas/[id]/relatorios/actions";
import {DRE_GROUPS} from "@/lib/relatorios";
import type {FormState} from "@/lib/form-state";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Alert,AlertDescription} from "@/components/ui/alert";
export type CategoryDre={id:string;nome:string;tipo:string;pai_id:string|null;ativo:boolean;grupo:string|null;versao:number};
export function DreClassification({empresa,categories}:{empresa:string;categories:CategoryDre[]}){
 const [edit,setEdit]=useState<{category:CategoryDre;request:string}|null>(null),[stateRequest,setStateRequest]=useState(""),[state,action,pending]=useActionState<FormState,FormData>(async(prev,form)=>{const result=await classifyDre(empresa,prev,form);setStateRequest(String(form.get("request_id")));return result;},{});
 return <div className="space-y-4"><p className="text-sm text-muted-foreground">Subcategoria herda o grupo do ancestral mais próximo. Sem classificação: receita bruta para receitas, operacional para despesas. Alterar recalcula consultas; não altera títulos nem fotografias do Planejamento. Categorias arquivadas também podem ser classificadas.</p>
 {categories.map(c=><div className="flex flex-wrap items-center justify-between gap-3 border-b py-3" key={c.id}><p>{c.pai_id?"↳ ":""}{c.nome} · {c.tipo}{c.ativo?"":" · arquivada"} · {c.grupo?DRE_GROUPS[c.grupo as keyof typeof DRE_GROUPS]:"Herdar / padrão"}</p><Button variant="outline" onClick={()=>setEdit({category:{...c},request:crypto.randomUUID()})}>Classificar DRE {c.nome}</Button></div>)}
 {edit&&<form key={edit.request} action={action} className="space-y-3 rounded-lg border p-4"><input type="hidden" name="categoria_id" value={edit.category.id}/><input type="hidden" name="versao" value={edit.category.versao}/><input type="hidden" name="request_id" value={edit.request}/><p>{edit.category.nome}</p><Label>Grupo da categoria<select aria-label="Grupo da categoria" className="h-9 w-full rounded-md border bg-background px-3" name="grupo" defaultValue={edit.category.grupo??""}><option value="">Herdar / padrão</option>{Object.entries(DRE_GROUPS).filter(([id])=>edit.category.tipo==="receita"?["receita","financeiro"].includes(id):id!=="receita").map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></Label>{!pending&&stateRequest===edit.request&&state.error&&<Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}{!pending&&stateRequest===edit.request&&state.success&&<Alert><AlertDescription>{state.success}</AlertDescription></Alert>}<div className="flex gap-3"><Button disabled={pending}>Salvar classificação DRE</Button><Button type="button" variant="outline" onClick={()=>setEdit(null)}>Fechar classificação DRE</Button></div></form>}
 </div>;
}
