"use client";
import {useState} from "react";
import {cashChart} from "@/lib/dashboard";
import type {CashDay} from "@/lib/fluxo-caixa";
import {formatCentavos,formatDate} from "@/lib/financeiro";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
export function CashChart({days}:{days:CashDay[]}) {
 const [selected,setSelected]=useState(days[0]?.data??"");
 const day=days.find(item=>item.data===selected)??days[0];
 const chart=cashChart(days);if(!day)return null;
 const index=days.indexOf(day),point=chart.points[index];
 return <div className="space-y-4">
  <svg viewBox="0 0 640 200" className="w-full" role="img" aria-label="Evolução diária dos saldos realizado e projetado. Consulte os valores pelo campo de dia abaixo.">
   <line x1="32" x2="608" y1={chart.zero} y2={chart.zero} stroke="var(--border)"/>
   <polyline points={chart.points.map(p=>`${p.x},${p.realizado}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="3"/>
   <polyline points={chart.points.map(p=>`${p.x},${p.projetado}`).join(" ")} fill="none" stroke="var(--foreground)" strokeWidth="2" strokeDasharray="6 4"/>
   <line x1={point.x} x2={point.x} y1="16" y2="184" stroke="var(--muted-foreground)" strokeDasharray="2 4"/>
   <circle cx={point.x} cy={point.realizado} r="4" fill="var(--primary)"/>
   <circle cx={point.x} cy={point.projetado} r="4" fill="var(--foreground)"/>
  </svg>
  <div className="flex justify-between text-xs text-muted-foreground"><span>{formatDate(days[0].data)}</span><span>{formatDate(days.at(-1)!.data)}</span></div>
  <p className="text-sm">Linha contínua: realizado · Linha tracejada: projetado</p>
  <div className="max-w-64 space-y-2"><Label htmlFor="dashboard-dia">Dia para consultar</Label><Input id="dashboard-dia" type="date" value={day.data} min={days[0].data} max={days.at(-1)!.data} onChange={event=>setSelected(event.target.value)}/></div>
  <p aria-live="polite" data-testid="dashboard-dia-saldos">{formatDate(day.data)} · Realizado: {formatCentavos(day.saldo_realizado)} · Projetado: {formatCentavos(day.saldo_projetado)}</p>
 </div>;
}
