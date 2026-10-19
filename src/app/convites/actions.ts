"use server";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { emailSchema, papelSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

export type InviteState = FormState & { link?: string };
export async function createInvite(_: InviteState, form: FormData): Promise<InviteState> {
  const { supabase, user } = await requireUser();
  const parsed = z.object({ empresa: z.string().uuid(), email: emailSchema, papel: papelSchema }).safeParse({ empresa: form.get("empresa"), email: form.get("email"), papel: form.get("papel") });
  if (!parsed.success) return { error: "Confira o e-mail e o nível de acesso." };
  if (parsed.data.email.toLowerCase() === user.email?.toLowerCase()) return { error: "Você já tem acesso a esta conta." };
  const { data: empresa, error: empresaError } = await supabase.from("empresas").select("dono_id").eq("id", parsed.data.empresa).maybeSingle();
  if (empresaError || empresa?.dono_id !== user.id) return { error: "Você não pode convidar usuários para esta conta." };
  const token = randomBytes(32).toString("hex");
  const { error } = await supabase.from("convites_empresas").insert({
    empresa_id: parsed.data.empresa, email: parsed.data.email.toLowerCase(), papel: parsed.data.papel,
    token_hash: createHash("sha256").update(token).digest("hex"), criado_por: user.id,
  });
  if (error) return { error: "Não foi possível criar o convite agora." };
  revalidatePath(`/empresas/${parsed.data.empresa}`);
  return { success: "Convite criado. Compartilhe o link com o destinatário; ele vale por 7 dias.", link: `/convites/${token}` };
}

export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.string().regex(/^[a-f0-9]{64}$/).safeParse(form.get("token"));
  if (!parsed.success) return { error: "Convite inválido." };
  const { supabase } = await requireUser(`/convites/${parsed.data}`);
  const { data, error } = await supabase.rpc("aceitar_convite", { p_hash: createHash("sha256").update(parsed.data).digest("hex") });
  if (error) return { error: "Não foi possível aceitar. Confira se entrou com o e-mail confirmado do convite, se ele ainda é válido e se você já tem acesso à conta." };
  revalidatePath("/empresas");
  redirect(`/empresas/${data}`);
}

export async function revokeInvite(form: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = z.object({ empresa: z.string().uuid(), convite: z.string().uuid() }).safeParse({ empresa: form.get("empresa"), convite: form.get("convite") });
  if (!parsed.success) throw new Error("Convite inválido.");
  const { data: empresa } = await supabase.from("empresas").select("dono_id").eq("id", parsed.data.empresa).maybeSingle();
  if (empresa?.dono_id !== user.id) throw new Error("Você não pode revogar esse convite.");
  const { error } = await supabase.from("convites_empresas").delete().eq("id", parsed.data.convite).eq("empresa_id", parsed.data.empresa).is("aceito_em", null);
  if (error) throw new Error("Não foi possível revogar o convite.");
  revalidatePath(`/empresas/${parsed.data.empresa}`);
}
