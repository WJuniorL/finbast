import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export default async function EmpresasLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return <div className="min-h-svh"><header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
    <Link href="/empresas" className="text-xl font-extrabold tracking-tight text-foreground">finbast<span className="text-primary">.</span></Link>
    <div className="flex items-center gap-4"><span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span><form action={logout}><Button type="submit" variant="ghost" size="sm">Sair</Button></form></div>
  </div></header><main className="mx-auto max-w-6xl space-y-8 px-6 py-10">{children}</main></div>;
}
