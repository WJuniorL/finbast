import {z} from "zod";
import {MONEY_MAX,parseCentavos,hojeBahia} from "./financeiro.ts";
export function signedCentavos(value:string):number {
  const trimmed=value.trim(),negative=trimmed.startsWith("-");
  return parseCentavos(negative?trimmed.slice(1):trimmed)*(negative?-1:1);
}
export const contaBancariaSchema=z.object({
  nome:z.string().trim().min(2).max(120),banco:z.string().trim().min(2).max(120),
  codigo_banco:z.string().regex(/^\d{1,10}$|^$/).transform(value=>value||null),
  agencia:z.string().trim().max(30).transform(value=>value||null),numero:z.string().trim().min(1).max(50),
  saldo_inicial_centavos:z.string().max(30).transform((value,ctx)=>{try{return signedCentavos(value);}catch{ctx.addIssue({code:"custom",message:"Saldo inválido. Use reais, como -1.234,56."});return z.NEVER;}}),
  data_saldo_inicial:z.iso.date().refine(value=>value>="2000-01-01"&&value<=hojeBahia(),"Informe a data do saldo de abertura até hoje."),
});
export const importRowSchema=z.object({chave:z.string().min(1).max(180),data_movimento:z.iso.date().refine(value=>value>="2000-01-01"&&value<=hojeBahia()),descricao:z.string().trim().min(1).max(500),valor_centavos:z.number().int().min(-MONEY_MAX).max(MONEY_MAX).refine(value=>value!==0)});
export type ImportRow=z.infer<typeof importRowSchema>;
export type BankAccount={id:string;empresa_id:string;nome:string;banco:string;codigo_banco:string|null;agencia:string|null;numero:string;saldo_inicial_centavos:number|string;data_saldo_inicial:string;ativo:boolean;atualizado_em:string};
export type BankMovement={id:string;data_movimento:string;descricao:string;valor_centavos:number|string;conciliacao_id:string|null;lancamento_id:string|null;tipo:"pagar"|"receber"|null};
