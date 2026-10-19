import { z } from "zod";
import { moneySchema,dateSchema,optionalId,hojeBahia } from "./financeiro.ts";
export { MONEY_MAX,parseCentavos,formatCentavos,inputCentavos,hojeBahia,formatDate,monthlyDate,splitCentavos } from "./financeiro.ts";

export function strongPin(value: string): boolean {
  if (!/^\d{6}$/.test(value) || new Set(value).size !== 6) return false;
  return !["012345678901234","987654321098765"].some((sequence)=>sequence.includes(value));
}
export const pinSchema = z.string().refine(strongPin,"Use seis dígitos diferentes, sem sequência crescente ou decrescente.");
export const canSettlePagar = (papel: string) => ["proprietario","administrador","operador"].includes(papel);
export const pagarSchema = z.object({
  descricao: z.string().trim().min(2).max(160), documento: z.string().trim().max(120).transform((value)=>value || null),
  fornecedor_id: z.string().uuid("Escolha um fornecedor."), categoria_id: z.string().uuid("Escolha uma categoria de despesa."), centro_custo_id: optionalId,
  valor_centavos: moneySchema.refine((value)=>value>0,"O valor deve ser maior que zero."), vencimento: dateSchema,
  modo: z.enum(["unica","parcelado","recorrente"]), parcelas: z.coerce.number().int().min(1).max(120),
  custo_fixo_override: z.enum(["categoria","sim","nao"]).transform((value)=>value === "categoria" ? null : value === "sim"),
}).refine((value)=>value.modo !== "parcelado" || (value.parcelas>=2 && value.valor_centavos>=value.parcelas),{message:"Use de 2 a 120 parcelas, com pelo menos um centavo em cada.",path:["parcelas"]});
export const baixaSchema = z.object({
  id: z.string().uuid(), atualizado_em: z.iso.datetime({offset:true}), senha: z.string().regex(/^\d{6}$/,"Informe a senha de aprovação de seis dígitos."),
  pago_em: dateSchema.refine((value)=>value<=hojeBahia(),"A data do pagamento não pode estar no futuro."),
  juros_centavos: moneySchema, multa_centavos: moneySchema, desconto_centavos: moneySchema,
  observacao: z.string().trim().max(500).transform((value)=>value || null),
});
export type PagarRecord = {
  id: string; empresa_id: string; serie_id: string; descricao: string; documento: string|null;
  fornecedor_id: string; categoria_id: string; centro_custo_id: string|null;
  valor_centavos: number|string; vencimento: string; parcela: number; status: "aberto"|"pago"|"cancelado";
  custo_fixo: boolean; custo_fixo_override: boolean|null; atualizado_em: string;
  pago_em: string|null; valor_pago_centavos: number|string|null; modo: "unica"|"parcelado"|"recorrente"; parcelas: number|null; serie_ativa: boolean;
  fornecedor_nome: string; categoria_nome: string;
};
