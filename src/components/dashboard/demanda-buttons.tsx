"use client";
import {useState,useTransition} from "react";
import {registrarInteresse} from "@/app/empresas/[id]/demanda-actions";
import {Button} from "@/components/ui/button";

const itens=[
 {recurso:"open_finance",label:"Conectar bancos automaticamente"},
 {recurso:"boleto_pix",label:"Pagar boletos e PIX pelo Finbast"},
 {recurso:"assistente_ia",label:"Assistente de IA"},
 {recurso:"painel_contador",label:"Painel do Contador"},
];

export function DemandaButtons({empresaId}:{empresaId:string}) {
 const [done,setDone]=useState<string[]>([]),[error,setError]=useState(""),[pending,start]=useTransition();
 return <div className="space-y-3"><div className="flex flex-wrap gap-2">{itens.map(i=>{const marked=done.includes(i.recurso);
  return <Button key={i.recurso} variant="outline" disabled={pending||marked} onClick={()=>start(async()=>{setError("");const r=await registrarInteresse(empresaId,i.recurso,"dashboard");if(r.ok)setDone(d=>[...d,i.recurso]);else setError(r.error??"Erro.");})}>{marked?`Interesse registrado: ${i.label}`:`Quero: ${i.label}`}</Button>;})}</div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
