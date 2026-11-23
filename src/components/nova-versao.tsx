"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const INTERVALO_MS = 5 * 60 * 1000;

/** Faixa "Nova versão disponível" quando o servidor foi publicado de novo. Nunca recarrega sozinha. */
export function NovaVersao() {
  const [nova, setNova] = useState(false);

  useEffect(() => {
    if (nova) return;
    const atual = process.env.FINBAST_BUILD_ID;
    const conferir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/versao", { cache: "no-store" });
        if (!res.ok) return;
        const { versao } = (await res.json()) as { versao?: string };
        if (versao && versao !== atual) setNova(true);
      } catch {
        // Sem conexão: tenta de novo no próximo ciclo.
      }
    };
    const timer = setInterval(conferir, INTERVALO_MS);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, [nova]);

  if (!nova) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-lg"
    >
      <span>Nova versão disponível. Salve o que estiver editando antes de atualizar.</span>
      <Button size="sm" onClick={() => window.location.reload()}>Atualizar</Button>
    </div>
  );
}
