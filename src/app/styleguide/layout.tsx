"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { navigation } from "./navigation";

export default function StyleguideLayout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  return <div className={dark ? "dark" : ""}>
    <div className="min-h-svh bg-background text-foreground md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-sidebar-border bg-sidebar p-6 text-sidebar-foreground md:sticky md:top-0 md:h-svh md:overflow-y-auto md:border-r">
        <Link href="/styleguide" className="text-xl font-extrabold text-sidebar-foreground">finbast<span className="text-red-400">.</span></Link>
        <p className="mb-8 mt-1 text-xs text-sidebar-foreground/60">Design system · shadcn/ui</p>
        <nav aria-label="Guia visual" className="flex flex-wrap gap-8 md:block md:space-y-8">{navigation.map((section) => <div key={section.title}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{section.title}</p>
          <ul className="space-y-2">{section.items.map((item) => <li key={item.href}><Link href={item.href} className="block rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent">{item.name}</Link></li>)}</ul>
        </div>)}</nav>
      </aside>
      <div className="min-w-0"><header className="flex items-center justify-between gap-4 border-b bg-card px-6 py-4 sm:px-10">
        <span className="text-xs text-muted-foreground">Identidade Finbast / Biblioteca de interface</span>
        <Button variant="outline" size="sm" onClick={() => setDark(!dark)} aria-pressed={dark}>{dark ? "Tema claro" : "Tema escuro"}</Button>
      </header><main className="mx-auto max-w-6xl space-y-12 p-6 sm:p-10">{children}</main></div>
    </div>
  </div>;
}
