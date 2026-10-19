import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { authDestination } from "@/lib/auth-redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; next?: string }> }) {
  const { erro, next: requested } = await searchParams;
  const next = authDestination(requested);
  return <>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">Entre na sua conta</h1><p className="text-muted-foreground">Acesse suas empresas e continue de onde parou.</p></div>
    {erro === "link" && <p role="alert" className="text-destructive">O link é inválido ou expirou. Solicite um novo link.</p>}
    <AuthForm mode="login" next={next} />
    <p className="text-center text-sm text-muted-foreground">Ainda não tem conta? <Link href={`/cadastro?next=${encodeURIComponent(next)}`}>Criar conta</Link></p>
  </>;
}
