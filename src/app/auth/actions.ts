"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { emailSchema, loginSchema, passwordSchema, signupSchema } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";
import { authDestination } from "@/lib/auth-redirect";

function siteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin;
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Confira o e-mail e a senha informados." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Não foi possível entrar. Confira as credenciais e a confirmação do e-mail." };
  redirect(authDestination(form.get("next")));
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e uma senha de 8 a 128 caracteres." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data, options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(authDestination(form.get("next")))}` },
  });
  if (error) return { error: "Não foi possível criar a conta. Tente novamente mais tarde." };
  if (data.session) redirect(authDestination(form.get("next")));
  return { success: "Confira seu e-mail para confirmar o cadastro e depois entre na sua conta." };
}

export async function recoverPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/atualizar-senha`,
  });
  if (error) return { error: "Não foi possível enviar o pedido agora. Tente novamente mais tarde." };
  return { success: "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(form.get("password"));
  if (!parsed.success) return { error: "Use uma senha de 8 a 128 caracteres." };
  if (parsed.data !== form.get("confirmPassword")) return { error: "As senhas não coincidem." };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: "Não foi possível atualizar a senha. Solicite um novo link e tente novamente." };
  redirect("/empresas");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  redirect("/login");
}
