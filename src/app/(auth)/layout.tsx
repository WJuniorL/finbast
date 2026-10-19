import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Link href="/login" className="text-2xl font-extrabold tracking-tight text-sidebar-foreground hover:text-sidebar-foreground">finbast<span className="text-red-400">.</span></Link>
        <div className="max-w-lg space-y-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/60">Controle e planejamento financeiro</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Clareza para cuidar do presente.<br />Planejamento para o próximo passo.</h1>
          <p className="max-w-md text-base leading-relaxed text-sidebar-foreground/70">Organize suas empresas em um só lugar, com acesso definido para cada conta.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Finbast · Seu financeiro, com perspectiva.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/login" className="text-2xl font-extrabold text-foreground lg:hidden">finbast<span className="text-primary">.</span></Link>
          {children}
          <p className="text-center text-xs text-muted-foreground">Uma conta, diferentes empresas. Cada acesso no seu lugar.</p>
        </div>
      </section>
    </main>
  );
}
