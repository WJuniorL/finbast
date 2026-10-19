import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canEditCadastros } from "@/lib/cadastros";

export async function requireEmpresa(id: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const { data: vinculo, error } = await supabase.from("usuarios_empresas").select("papel").eq("empresa_id", id).eq("usuario_id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível verificar seu acesso.");
  if (!vinculo) notFound();
  const { data: empresa, error: empresaError } = await supabase.from("empresas").select("id,nome,tipo").eq("id", id).maybeSingle();
  if (empresaError) throw new Error("Não foi possível carregar a empresa.");
  if (!empresa) notFound();
  return { supabase, user, empresa, papel: vinculo.papel as string, canEdit: canEditCadastros(vinculo.papel) };
}
