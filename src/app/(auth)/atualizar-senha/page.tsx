import { AuthForm } from "@/components/auth/auth-form";
import { requireUser } from "@/lib/auth";

export default async function AtualizarSenhaPage() {
  await requireUser();
  return <>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">Escolha uma nova senha</h1><p className="text-muted-foreground">Atualize a senha usada para entrar no Finbast.</p></div>
    <AuthForm mode="update" />
  </>;
}
