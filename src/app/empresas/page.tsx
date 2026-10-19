import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { selectEmpresa } from "./actions";
import { EmpresaForm } from "@/components/empresas/empresa-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EmpresasPage() {
  const { supabase, user } = await requireUser();
  const { data: vinculos, error } = await supabase.from("usuarios_empresas").select("empresa_id, papel, empresas(id, nome, tipo, documento)").eq("usuario_id", user.id);
  if (error) throw new Error("Não foi possível carregar suas empresas.");
  const selected = (await cookies()).get("finbast_empresa")?.value;
  return <>
    <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Suas contas</p><h1 className="text-3xl font-bold tracking-tight">Escolha por onde começar</h1><p className="text-muted-foreground">Cada empresa ou conta pessoal tem seus próprios dados e acessos.</p></div>
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]"><section aria-label="Contas disponíveis" className="grid gap-4 sm:grid-cols-2">
      {vinculos?.length ? vinculos.map((vinculo) => {
        const empresa = vinculo.empresas as unknown as { id: string; nome: string; tipo: string; documento: string };
        if (!empresa) return null;
        return <Card key={empresa.id} className={selected === empresa.id ? "ring-2 ring-primary" : ""}><CardHeader>
          <div className="mb-3 flex items-center justify-between"><Badge variant="secondary">{empresa.tipo}</Badge>{selected === empresa.id && <span className="text-xs text-muted-foreground">Última conta</span>}</div>
          <CardTitle>{empresa.nome}</CardTitle><CardDescription>{empresa.documento}</CardDescription></CardHeader>
          <CardContent><form action={selectEmpresa}><input type="hidden" name="empresa_id" value={empresa.id} /><Button type="submit" variant="outline" className="w-full">Acessar conta</Button></form></CardContent>
        </Card>;
      }) : <div className="rounded-xl border border-dashed p-8 text-muted-foreground sm:col-span-2"><h2 className="mb-2 font-semibold text-foreground">Sua primeira conta começa aqui</h2><p>Cadastre uma empresa ou seu CPF para organizar os acessos.</p></div>}
    </section><Card><CardHeader><CardTitle>Nova conta</CardTitle><CardDescription>Cadastre uma empresa ou uma conta pessoal.</CardDescription></CardHeader><CardContent><EmpresaForm /></CardContent></Card></div>
  </>;
}
