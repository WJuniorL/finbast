"use client";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">Algo deu errado</h1>
      <p className="text-muted-foreground">Não foi possível carregar esta página. Tente novamente em alguns instantes.</p>
      <Button onClick={reset} className="self-start">Tentar novamente</Button>
    </main>
  );
}
