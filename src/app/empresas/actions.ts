"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { empresaSchema, papelSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

export async function createEmpresa(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const parsed = empresaSchema.safeParse({ nome: form.get("nome"), tipo: form.get("tipo"), documento: form.get("documento") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados da empresa." };
  const { data, error } = await supabase.rpc("criar_empresa", { p_nome: parsed.data.nome, p_tipo: parsed.data.tipo, p_documento: parsed.data.documento });
  if (error) return { error: error.code === "23505" ? "Você já cadastrou uma conta com esse documento." : "Não foi possível criar a empresa agora. Tente novamente." };
  (await cookies()).set("finbast_empresa", data, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  revalidatePath("/empresas");
  redirect(`/empresas/${data}`);
}

export async function selectEmpresa(form: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = z.string().uuid().safeParse(form.get("empresa_id"));
  if (!parsed.success) redirect("/empresas");
  const { data, error } = await supabase.from("usuarios_empresas").select("empresa_id").eq("empresa_id", parsed.data).eq("usuario_id", user.id).maybeSingle();
  if (error || !data) redirect("/empresas");
  (await cookies()).set("finbast_empresa", data.empresa_id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  redirect(`/empresas/${data.empresa_id}`);
}

export async function changeRole(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const parsed = z.object({ empresa: z.string().uuid(), usuario: z.string().uuid(), papel: papelSchema }).safeParse({ empresa: form.get("empresa"), usuario: form.get("usuario"), papel: form.get("papel") });
  if (!parsed.success) return { error: "Confira o usuário e o nível de acesso." };
  const { data: empresa, error: empresaError } = await supabase.from("empresas").select("dono_id").eq("id", parsed.data.empresa).maybeSingle();
  if (empresaError || empresa?.dono_id !== user.id || parsed.data.usuario === user.id) return { error: "Você não pode alterar esse acesso." };
  const { data, error } = await supabase.from("usuarios_empresas").update({ papel: parsed.data.papel }).eq("empresa_id", parsed.data.empresa).eq("usuario_id", parsed.data.usuario).neq("papel", "proprietario").select("usuario_id").maybeSingle();
  if (error || !data) return { error: "Não foi possível atualizar esse acesso." };
  revalidatePath(`/empresas/${parsed.data.empresa}`);
  return { success: "Permissão atualizada." };
}

export async function renameEmpresa(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const parsed = z.object({ empresa: z.string().uuid(), nome: empresaSchema.shape.nome }).safeParse({ empresa: form.get("empresa"), nome: form.get("nome") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o nome." };
  // RLS: só o proprietário atualiza; zero linhas significa sem permissão.
  const { data, error } = await supabase.from("empresas").update({ nome: parsed.data.nome }).eq("id", parsed.data.empresa).select("id").maybeSingle();
  if (error || !data) return { error: "Não foi possível renomear esta conta." };
  revalidatePath("/empresas", "layout");
  return { success: "Nome atualizado." };
}

export async function removeMember(form: FormData) {
  const { supabase } = await requireUser();
  const parsed = z.object({ empresa: z.string().uuid(), usuario: z.string().uuid() }).safeParse({ empresa: form.get("empresa"), usuario: form.get("usuario") });
  if (!parsed.success) redirect("/empresas");
  await supabase.from("usuarios_empresas").delete().eq("empresa_id", parsed.data.empresa).eq("usuario_id", parsed.data.usuario);
  revalidatePath(`/empresas/${parsed.data.empresa}`);
}

export async function leaveEmpresa(form: FormData) {
  const { supabase } = await requireUser();
  const parsed = z.string().uuid().safeParse(form.get("empresa"));
  if (!parsed.success) redirect("/empresas");
  await supabase.rpc("sair_da_empresa", { p_empresa: parsed.data });
  const store = await cookies();
  if (store.get("finbast_empresa")?.value === parsed.data) store.delete("finbast_empresa");
  redirect("/empresas");
}
