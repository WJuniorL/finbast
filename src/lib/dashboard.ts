import {z} from "zod";
import type {CashDay,CashFlow} from "./fluxo-caixa";
export const dashboardMonthSchema=z.string().regex(/^(?:20\d{2}|2100)-(?:0[1-9]|1[0-2])$/,"Escolha um mês entre 2000 e 2100.");
export type Dashboard = {
 mes:string;fim:string;hoje:string;fluxo:CashFlow;pagar_aberto:string;receber_aberto:string;pagar_vencido:string;receber_vencido:string;
 pagar_vencidos:number;receber_vencidos:number;pagar_quantidade:number;receber_quantidade:number;
 titulos:{id:string;descricao:string;vencimento:string;valor:string;tipo:"pagar"|"receber"}[];
 custos_fixos:string;categorias_fixos:number;fixos:{categoria_id:string;categoria:string;valor:string}[];projecao_fixos:{mes:string;valor:string}[];
 pendentes:number;movimentos_pendentes:{id:string;conta_id:string;descricao:string;data:string;valor:string}[];
 quantidade_contas:number;contas:{id:string;nome:string;ativo:boolean;saldo:string}[];
};
// Dinheiro em BigInt; somente coordenadas inteiras limitadas viram Number.
export function cashChart(days:CashDay[]) {
 const values=days.flatMap(day=>[BigInt(day.saldo_realizado),BigInt(day.saldo_projetado)]);
 const min=values.reduce((a,b)=>a<b?a:b,0n),max=values.reduce((a,b)=>a>b?a:b,0n),range=max-min||1n;
 const y=(value:bigint)=>Number(176n-(value-min)*152n/range);
 return {zero:y(0n),points:days.map((day,i)=>({x:Number(32n+BigInt(i)*576n/BigInt(Math.max(1,days.length-1))),realizado:y(BigInt(day.saldo_realizado)),projetado:y(BigInt(day.saldo_projetado))}))};
}
