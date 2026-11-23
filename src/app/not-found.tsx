import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">O endereço não existe ou você não tem acesso a ele.</p>
      <Button asChild className="self-start"><Link href="/">Voltar ao início</Link></Button>
    </main>
  );
}
