import { z } from "zod";
import { validDocument } from "./validation.ts";

export const cadastroKinds = ["categorias", "centros-custo", "clientes", "fornecedores"] as const;
export type CadastroKind = typeof cadastroKinds[number];
export const cadastroKindSchema = z.enum(cadastroKinds);
export const cadastroConfig = {
  categorias: { table: "categorias", title: "Categorias", singular: "categoria", description: "Organize receitas, despesas e custos fixos para seus relatórios." },
  "centros-custo": { table: "centros_custo", title: "Centros de custo", singular: "centro de custo", description: "Separe áreas, unidades e projetos para comparar os resultados." },
  clientes: { table: "clientes", title: "Clientes", singular: "cliente", description: "Mantenha os dados usados nos seus recebimentos." },
  fornecedores: { table: "fornecedores", title: "Fornecedores", singular: "fornecedor", description: "Organize os contatos usados nas suas despesas." },
} as const;

export const categoryColors = { vermelho: "var(--red-500)", ambar: "var(--amber-500)", verde: "var(--green-500)", azul: "var(--blue-500)", escuro: "var(--ink-800)", cinza: "var(--gray-400)" } as const;
export const estados = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
export const canEditCadastros = (papel: string) => ["proprietario", "administrador", "operador", "contador_completo"].includes(papel);
const name = (max: number) => z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(max, `Use no máximo ${max} caracteres no nome.`);
const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).transform((value) => value || null);
export const categorySchema = z.object({
  nome: name(120), tipo: z.enum(["receita", "despesa"]), cor: z.enum(["vermelho","ambar","verde","azul","escuro","cinza"]),
  custo_fixo: z.boolean(), pai_id: z.union([z.string().uuid(), z.literal("")]).transform((value) => value || null),
}).refine((value) => !value.custo_fixo || value.tipo === "despesa", { path: ["custo_fixo"], message: "Custo fixo se aplica a categorias de despesa." });
export const centroSchema = z.object({ nome: name(120), descricao: optionalText(500) });
export const contactSchema = z.object({
  nome: name(160),
  documento: z.string().trim().max(24).regex(/^[\d ./-]*$/, "Informe somente CPF ou CNPJ, com ou sem pontuação.")
    .transform((value) => value.replace(/\D/g, "") || null)
    .refine((value) => value === null || validDocument(value), "Informe um CPF ou CNPJ válido."),
  email: z.union([z.string().trim().email("Informe um e-mail válido.").max(254), z.literal("")]).transform((value) => value.toLowerCase() || null),
  telefone: z.string().trim().max(30).regex(/^[\d()+ .-]*$/, "Informe um telefone válido.")
    .transform((value) => value.replace(/\D/g, "") || null).refine((value) => value === null || (value.length >= 8 && value.length <= 15), "Use de 8 a 15 dígitos no telefone."),
  cidade: optionalText(120), uf: z.union([z.enum(estados), z.literal("")]).transform((value) => value || null), observacoes: optionalText(500),
});

export type CadastroRecord = {
  id: string; nome: string; ativo: boolean; atualizado_em: string;
  tipo?: "receita" | "despesa"; cor?: keyof typeof categoryColors; custo_fixo?: boolean; pai_id?: string | null;
  pai?: { nome: string } | null; descricao?: string | null;
  documento?: string | null; email?: string | null; telefone?: string | null; cidade?: string | null; uf?: string | null; observacoes?: string | null;
};
export type CategoryParent = { id: string; nome: string; tipo: "receita" | "despesa"; custo_fixo: boolean; ativo: boolean };
