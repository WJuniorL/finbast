import { z } from "zod";

export const MONEY_MAX = 1_000_000_000_000;
export function parseCentavos(input: string): number {
  const value = input.trim();
  if (!/^(?:\d{1,12}|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) throw new Error("Informe um valor em reais, como 1.234,56.");
  const [whole, fraction = ""] = value.replace(/\./g,"").split(",");
  const cents = BigInt(whole)*100n + BigInt(fraction.padEnd(2,"0"));
  if (cents > BigInt(MONEY_MAX)) throw new Error("Valor acima do limite permitido.");
  return Number(cents);
}
export function formatCentavos(input: number | string | bigint): string {
  const value = BigInt(input);
  const positive = value < 0n ? -value : value;
  return `${value < 0n ? "− " : ""}R$ ${new Intl.NumberFormat("pt-BR").format(positive/100n)},${String(positive%100n).padStart(2,"0")}`;
}
export function inputCentavos(input: number | string): string {
  const value = BigInt(input);
  return `${value/100n},${String(value%100n).padStart(2,"0")}`;
}
export const hojeBahia = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bahia",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function formatDate(value: string): string { return value.split("-").reverse().join("/"); }
export function monthlyDate(base: string, offset: number): string {
  const [year,month,day] = base.split("-").map(Number);
  const target = new Date(Date.UTC(year,month-1+offset,1));
  const last = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth()+1).padStart(2,"0")}-${String(Math.min(day,last)).padStart(2,"0")}`;
}
export function splitCentavos(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || !Number.isInteger(count) || count < 1 || count > 120 || total < count || total > MONEY_MAX) throw new Error("Parcelamento inválido.");
  const base = BigInt(total)/BigInt(count), remainder = BigInt(total)%BigInt(count);
  return Array.from({length:count},(_,index)=>Number(base + (BigInt(index)<remainder ? 1n : 0n)));
}
export const moneySchema = z.string().max(30).transform((value,context)=>{
  try { return parseCentavos(value); } catch(error) { context.addIssue({code:"custom",message:error instanceof Error ? error.message : "Valor inválido."}); return z.NEVER; }
});
export const dateSchema = z.iso.date().refine((value)=>value >= "2000-01-01" && value <= "2100-12-31","Use uma data entre 2000 e 2100.");
export const optionalId = z.union([z.string().uuid(),z.literal("")]).transform((value)=>value || null);
