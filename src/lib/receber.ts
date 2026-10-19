import { z } from "zod";
import { moneySchema,dateSchema,optionalId,hojeBahia } from "./financeiro.ts";
export { formatCentavos,inputCentavos,hojeBahia,formatDate } from "./financeiro.ts";

export const receberSchema = z.object({
  descricao: z.string().trim().min(2).max(160), documento: z.string().trim().max(120).transform((value)=>value || null),
  cliente_id: z.string().uuid("Escolha um cliente."), categoria_id: z.string().uuid("Escolha uma categoria de receita."), centro_custo_id: optionalId,
  valor_centavos: moneySchema.refine((value)=>value>0,"O valor deve ser maior que zero."), vencimento: dateSchema,
  modo: z.enum(["unica","parcelado","recorrente"]), parcelas: z.coerce.number().int().min(1).max(120),
}).refine((value)=>value.modo !== "parcelado" || (value.parcelas>=2 && value.valor_centavos>=value.parcelas),{message:"Use de 2 a 120 parcelas, com pelo menos um centavo em cada.",path:["parcelas"]});
export const recebimentoSchema = z.object({
  id: z.string().uuid(), atualizado_em: z.iso.datetime({offset:true}),
  recebido_em: dateSchema.refine((value)=>value<=hojeBahia(),"A data do recebimento não pode estar no futuro."),
  juros_centavos: moneySchema, multa_centavos: moneySchema, desconto_centavos: moneySchema,
  observacao: z.string().trim().max(500).transform((value)=>value || null),
});
export type ReceberRecord = {
  id: string; empresa_id: string; serie_id: string; descricao: string; documento: string|null;
  cliente_id: string; categoria_id: string; centro_custo_id: string|null;
  valor_centavos: number|string; vencimento: string; parcela: number; status: "aberto"|"recebido"|"cancelado";
  atualizado_em: string;
  recebido_em: string|null; valor_recebido_centavos: number|string|null; modo: "unica"|"parcelado"|"recorrente"; parcelas: number|null; serie_ativa: boolean;
  cliente_nome: string; categoria_nome: string;
};
