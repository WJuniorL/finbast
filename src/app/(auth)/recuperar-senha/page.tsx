import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function RecuperarSenhaPage() {
  return <>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">Recupere seu acesso</h1><p className="text-muted-foreground">Enviaremos um link para você escolher uma nova senha.</p></div>
    <AuthForm mode="recover" />
    <p className="text-center text-sm"><Link href="/login">Voltar para o login</Link></p>
  </>;
}
