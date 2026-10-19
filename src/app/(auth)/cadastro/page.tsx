import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { authDestination } from "@/lib/auth-redirect";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = authDestination((await searchParams).next);
  return <>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">Crie sua conta</h1><p className="text-muted-foreground">Depois de entrar, cadastre sua primeira empresa.</p></div>
    <AuthForm mode="signup" next={next} />
    <p className="text-center text-sm text-muted-foreground">Já tem conta? <Link href={`/login?next=${encodeURIComponent(next)}`}>Entrar</Link></p>
  </>;
}
