"use client";
import {useState} from "react";
import {REPORT_VIEWS,DRE_GROUPS,type ReportFilters} from "@/lib/relatorios";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
type Option={id:string;nome:string};
const cls="h-9 w-full rounded-md border bg-background px-3";
export function ReportFiltersForm({initial,categories,centers,products,suppliers,scenarios}:{initial:Partial<ReportFilters>;categories:(Option&{pai_id:string|null;ativo:boolean})[];centers:Option[];products:Option[];suppliers:Option[];scenarios:(Option&{ano:number})[]}){
 const [view,setView]=useState(initial.vista??"dre"),[base,setBase]=useState(initial.base??"registrado"),compare=view==="comparativo";
 return <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Label>Relatório<select aria-label="Relatório" className={cls} name="vista" value={view} onChange={e=>{setView(e.target.value as ReportFilters["vista"]);if(e.target.value==="encargos")setBase("realizado");}}>{Object.entries(REPORT_VIEWS).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></Label>
 <Label>Base<select aria-label="Base" className={cls} name="base" value={base} onChange={e=>setBase(e.target.value as ReportFilters["base"])}><option value="registrado">Registrado por vencimento</option><option value="realizado">Realizado por liquidação</option></select></Label>
 <Label>Início<Input name="inicio" type="date" defaultValue={initial.inicio} required/></Label><Label>Fim<Input name="fim" type="date" defaultValue={initial.fim} required/></Label>
 <Label>Categoria<select aria-label="Categoria" className={cls} name="categoria" defaultValue={initial.categoria??""}><option value="">Todas</option>{categories.map(c=><option key={c.id} value={c.id}>{c.pai_id?"↳ ":""}{c.nome}{c.ativo?"":" · arquivada"}</option>)}</select></Label>
 <Label>Subcategorias<select aria-label="Subcategorias" className={cls} name="subcategorias" defaultValue={initial.subcategorias===false?"0":"1"}><option value="1">Incluir descendentes</option><option value="0">Somente a categoria</option></select></Label>
 <Label>Centro de custo<select aria-label="Centro de custo" className={cls} name="centro" defaultValue={initial.centro??""}><option value="">Todos</option><option value="sem">Sem centro</option>{centers.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Label>
 <Label>Fornecedor / funcionário<select aria-label="Fornecedor / funcionário" className={cls} name="fornecedor" defaultValue={initial.fornecedor??""} disabled={compare}><option value="">Todos</option><option value="sem">Sem fornecedor</option>{suppliers.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Label>
 <Label>Produto<select aria-label="Produto" className={cls} name="produto" defaultValue={initial.produto??""} disabled={compare}><option value="">Todos</option><option value="sem">Sem produto</option>{products.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></Label>
 <Label>Grupo DRE<select aria-label="Grupo DRE" className={cls} name="grupo" defaultValue={initial.grupo??""} disabled={compare}><option value="">Todos</option>{Object.entries(DRE_GROUPS).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></Label>
 <Label>Componente<select aria-label="Componente" className={cls} name="componente" defaultValue={initial.componente??""} disabled={compare}><option value="">Todos</option><option value="principal">Principal</option><option value="juros">Juros</option><option value="multa">Multa</option><option value="desconto">Desconto</option></select></Label>
 <Label>Cenário<select aria-label="Cenário" className={cls} name="cenario" defaultValue={initial.cenario??""} required={compare}><option value="">Selecione para comparar</option>{scenarios.map(s=><option key={s.id} value={s.id}>{s.nome} · {s.ano}</option>)}</select></Label>
 <div className="sm:col-span-2 xl:col-span-4 space-y-3"><p className="text-sm text-muted-foreground">{compare?"Comparativo usa meses completos do cenário e sua grade R + P × executado, inclusive fotografias fechadas. A escolha de base acima não altera essa grade; filtros de produto, fornecedor, grupo e componente não se aplicam.":"Fornecedor consulta despesas; funcionários devem estar cadastrados como fornecedores. Use categoria/subcategoria para analisar tarifas e antecipação, sem deduzir a classificação pelo nome."}</p><Button>Consultar relatório</Button></div></form>;
}
