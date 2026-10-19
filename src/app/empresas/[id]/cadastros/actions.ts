"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEmpresa } from "@/lib/empresa";
import { cadastroConfig, cadastroKindSchema, categorySchema, centroSchema, contactSchema, type CadastroKind } from "@/lib/cadastros";
import type { FormState } from "@/lib/form-state";

const recordSchema = z.object({ id: z.string().uuid(), atualizado_em: z.iso.datetime({ offset: true }) });
const field = (form: FormData, key: string) => form.get(key) ?? "";
function databaseError(code: string, kind: CadastroKind) {
  if (code === "23505") return "Já existe um cadastro com esse nome ou documento. Confira também os arquivados.";
  if (code === "23514" || code === "23503") return kind === "categorias"
    ? "Confira a categoria principal: deve ser da mesma empresa, do mesmo tipo e estar ativa. Categorias com subcategorias ou lançamentos financeiros não podem mudar de tipo; categorias com subcategorias não podem mudar de nível. Para arquivar a principal, arquive as subcategorias antes."
    : "Confira os dados informados.";
  return "Não foi possível salvar o cadastro agora. Tente novamente.";
}

export async function saveCadastro(empresaId: string, kind: CadastroKind, _: FormState, form: FormData): Promise<FormState> {
  const validKind = cadastroKindSchema.safeParse(kind);
  if (!validKind.success) return { error: "Cadastro inválido." };
  const { supabase, empresa, canEdit } = await requireEmpresa(empresaId);
  if (!canEdit) return { error: "Seu acesso permite somente consultar os cadastros." };
  const parsed = kind === "categorias"
    ? categorySchema.safeParse({ nome: field(form,"nome"), tipo: field(form,"tipo"), cor: field(form,"cor"), custo_fixo: form.get("custo_fixo") === "on", pai_id: field(form,"pai_id") })
    : kind === "centros-custo" ? centroSchema.safeParse({ nome: field(form,"nome"), descricao: field(form,"descricao") })
    : contactSchema.safeParse({ nome: field(form,"nome"), documento: field(form,"documento"), email: field(form,"email"), telefone: field(form,"telefone"), cidade: field(form,"cidade"), uf: field(form,"uf"), observacoes: field(form,"observacoes") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados informados." };
  const id = form.get("id");
  const table = cadastroConfig[validKind.data].table;
  if (id) {
    const record = recordSchema.safeParse({ id, atualizado_em: form.get("atualizado_em") });
    if (!record.success) return { error: "Reabra o cadastro antes de editar." };
    const { data, error } = await supabase.from(table).update(parsed.data).eq("empresa_id", empresa.id).eq("id", record.data.id).eq("atualizado_em", record.data.atualizado_em).select("id").maybeSingle();
    if (error) return { error: databaseError(error.code, kind) };
    if (!data) return { error: "Este cadastro mudou ou não está disponível. Atualize a página antes de editar." };
  } else {
    const { error } = await supabase.from(table).insert({ ...parsed.data, empresa_id: empresa.id });
    if (error) return { error: databaseError(error.code, kind) };
  }
  revalidatePath(`/empresas/${empresa.id}/cadastros`, "layout");
  return { success: id ? "Cadastro atualizado." : "Cadastro criado." };
}

export async function setCadastroStatus(empresaId: string, kind: CadastroKind, _: FormState, form: FormData): Promise<FormState> {
  const validKind = cadastroKindSchema.safeParse(kind);
  if (!validKind.success) return { error: "Cadastro inválido." };
  const { supabase, empresa, canEdit } = await requireEmpresa(empresaId);
  if (!canEdit) return { error: "Seu acesso permite somente consultar os cadastros." };
  const parsed = recordSchema.extend({ ativo: z.enum(["true", "false"]).transform((value) => value === "true") }).safeParse({ id: form.get("id"), atualizado_em: form.get("atualizado_em"), ativo: form.get("ativo") });
  if (!parsed.success) return { error: "Atualize a página antes de alterar este cadastro." };
  const { data, error } = await supabase.from(cadastroConfig[validKind.data].table).update({ ativo: parsed.data.ativo })
    .eq("empresa_id", empresa.id).eq("id", parsed.data.id).eq("atualizado_em", parsed.data.atualizado_em).select("id").maybeSingle();
  if (error) return { error: databaseError(error.code, kind) };
  if (!data) return { error: "Este cadastro mudou ou não está disponível. Atualize a página." };
  revalidatePath(`/empresas/${empresa.id}/cadastros`, "layout");
  return { success: parsed.data.ativo ? "Cadastro reativado." : "Cadastro arquivado." };
}
