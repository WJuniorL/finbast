export type CashDay = {data:string;abertura:string;entradas:string;saidas:string;previstas_entradas:string;previstas_saidas:string;saldo_realizado:string;saldo_projetado:string};
export type CashMovement = {id:string;data:string;descricao:string;valor:string;origem:"abertura"|"extrato"|"pagar"|"receber";tipo:"realizado"|"previsto";conta_id:string|null};
export type CashFlow = {saldo_inicial:string;vencidos_entradas:string;vencidos_saidas:string;total:number;pagina:number;dias:CashDay[];movimentos:CashMovement[]};
const sumFields = ["abertura","entradas","saidas","previstas_entradas","previstas_saidas"] as const;
// Saldos são posições finais, não valores a somar. Centavos permanecem BigInt.
export function groupCashDays(days:CashDay[],monthly:boolean):CashDay[] {
 if(!monthly)return days;
 const groups=new Map<string,CashDay>();
 for(const day of days){const key=day.data.slice(0,7),previous=groups.get(key);
  if(!previous){groups.set(key,{...day,data:key});continue;}
  for(const field of sumFields)previous[field]=String(BigInt(previous[field])+BigInt(day[field]));
  previous.saldo_realizado=day.saldo_realizado;previous.saldo_projetado=day.saldo_projetado;
 }
 return [...groups.values()];
}
export function cashTotals(days:CashDay[]) {
 return Object.fromEntries(sumFields.map(field=>[field,days.reduce((total,day)=>total+BigInt(day[field]),0n)])) as Record<(typeof sumFields)[number],bigint>;
}
