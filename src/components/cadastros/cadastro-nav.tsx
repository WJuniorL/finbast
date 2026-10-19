"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cadastroConfig, cadastroKinds } from "@/lib/cadastros";

export function CadastroNav({ empresaId }: { empresaId: string }) {
  const pathname = usePathname();
  return <nav aria-label="Tipos de cadastro" className="flex flex-wrap gap-2 rounded-xl border bg-card p-2">
    {cadastroKinds.map((kind) => {
      const href = `/empresas/${empresaId}/cadastros/${kind}`;
      const current = pathname === href;
      return <Link key={kind} href={href} aria-current={current ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${current ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{cadastroConfig[kind].title}</Link>;
    })}
  </nav>;
}
