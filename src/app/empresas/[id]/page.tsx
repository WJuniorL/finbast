import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { RoleForm } from "@/components/empresas/role-form";
import { InviteForm } from "@/components/empresas/invite-form";
import { revokeInvite } from "@/app/convites/actions";
import { leaveEmpresa, removeMember } from "@/app/empresas/actions";
import { RenameForm } from "@/components/empresas/rename-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
const labels: Record<string, string> = { proprietario: "Proprietário", administrador: "Administrador", operador: "Operador", leitura: "Somente leitura", contador_completo: "Contador · completo", contador_leitura: "Contador · leitura" };

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const { data: vinculo, error: vinculoError } = await supabase.from("usuarios_empresas").select("papel").eq("empresa_id", id).eq("usuario_id", user.id).maybeSingle();
  if (vinculoError) throw new Error("Não foi possível verificar seu acesso.");
  if (!vinculo) notFound();
  const { data: empresa, error } = await supabase.from("empresas").select("id, nome, tipo, documento, dono_id").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a empresa.");
  if (!empresa) notFound();
  const owner = empresa.dono_id === user.id;
  const { data: membros, error: membrosError } = owner
    ? await supabase.rpc("listar_acessos", { p_empresa: id })
    : await supabase.from("usuarios_empresas").select("usuario_id, papel").eq("empresa_id", id);
  if (membrosError) throw new Error("Não foi possível carregar os acessos.");
  const { data: convites, error: convitesError } = owner
    ? await supabase.from("convites_empresas").select("id,email,papel,expira_em").eq("empresa_id", id).is("aceito_em", null).gt("expira_em", new Date().toISOString())
    : { data: [], error: null };
  if (convitesError) throw new Error("Não foi possível carregar os convites.");
  return <>
    <Link href="/empresas" className="text-sm">← Trocar de conta</Link>
    <div className="space-y-3"><Badge variant="secondary">{empresa.tipo}</Badge><h1 className="text-3xl font-bold tracking-tight">{empresa.nome}</h1><p className="text-muted-foreground">{empresa.documento} · Seu acesso: {labels[vinculo.papel]}</p></div>
    <Card><CardHeader><CardTitle>Dashboard</CardTitle><CardDescription>Acompanhe caixa, títulos abertos, custos fixos e conciliação desta empresa.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/dashboard`}>Abrir Dashboard</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Planejamento e Simulador</CardTitle><CardDescription>Compare cenários e revise contribuições dos setores sem criar lançamentos reais.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/planejamento`}>Abrir Planejamento</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Custo e precificação</CardTitle><CardDescription>Analise margens por produto, regras de rateio e simule preço e volume.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/produtos`}>Abrir produtos e custos</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>DRE e Relatórios</CardTitle><CardDescription>Consulte resultados, detalhe origens e exporte CSV ou XLSX por período e dimensão.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/relatorios`}>Abrir DRE e Relatórios</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Cadastros base</CardTitle><CardDescription>Prepare categorias, centros de custo, clientes e fornecedores desta conta.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/cadastros`}>Abrir cadastros</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Contas a Pagar</CardTitle><CardDescription>Lance despesas únicas, parceladas ou recorrentes e registre pagamentos realizados.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/pagar`}>Abrir Contas a Pagar</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Contas a Receber</CardTitle><CardDescription>Registre receitas por cliente, parcelas, recorrências e recebimentos realizados.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/receber`}>Abrir Contas a Receber</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Contas bancárias e conciliação</CardTitle><CardDescription>Importe extratos CSV, XLSX ou OFX e confira os pagamentos e recebimentos registrados.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/bancos`}>Abrir contas bancárias</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Fluxo de caixa</CardTitle><CardDescription>Compare entradas, saídas e saldos realizados e previstos por período.</CardDescription></CardHeader><CardContent><Button asChild><Link href={`/empresas/${id}/fluxo-caixa`}>Abrir fluxo de caixa</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Acessos desta conta</CardTitle><CardDescription>{owner ? "Gerencie os níveis de acesso dos usuários vinculados." : "Seu acesso é definido pelo proprietário desta conta."}</CardDescription></CardHeader>
      <CardContent className="space-y-5">{(membros as { usuario_id: string; papel: string; email?: string }[] | null)?.map((membro) => <div key={membro.usuario_id} className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 last:border-0 last:pb-0">
        <div><p className="font-medium">{membro.usuario_id === user.id ? "Você" : membro.email || "Usuário vinculado"}</p><p className="text-sm text-muted-foreground">{labels[membro.papel]}</p></div>
        {owner && membro.papel !== "proprietario" && <div className="flex flex-wrap items-start gap-2"><RoleForm empresa={id} usuario={membro.usuario_id} papel={membro.papel} /><form action={removeMember}><input type="hidden" name="empresa" value={id} /><input type="hidden" name="usuario" value={membro.usuario_id} /><Button type="submit" variant="outline" size="sm">Remover acesso</Button></form></div>}
      </div>)}</CardContent>
    </Card>
    {owner && <Card><CardHeader><CardTitle>Dados da conta</CardTitle><CardDescription>Documento e tipo não podem ser alterados.</CardDescription></CardHeader><CardContent><RenameForm empresa={id} nome={empresa.nome} /></CardContent></Card>}
    {!owner && <Card><CardHeader><CardTitle>Sair desta conta</CardTitle><CardDescription>Você perde o acesso até receber um novo convite. Os registros da conta permanecem.</CardDescription></CardHeader><CardContent><form action={leaveEmpresa}><input type="hidden" name="empresa" value={id} /><Button type="submit" variant="outline">Sair desta conta</Button></form></CardContent></Card>}
    {owner && <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Convidar usuário</CardTitle><CardDescription>Defina o acesso e compartilhe um link individual.</CardDescription></CardHeader><CardContent><InviteForm empresa={id} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Convites pendentes</CardTitle><CardDescription>Links válidos que ainda não foram aceitos.</CardDescription></CardHeader><CardContent className="space-y-4">
        {convites?.length ? convites.map((convite) => <div key={convite.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 last:border-0">
          <div><p className="font-medium">{convite.email}</p><p className="text-xs text-muted-foreground">{labels[convite.papel]} · até {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia" }).format(new Date(convite.expira_em))}</p></div>
          <form action={revokeInvite}><input type="hidden" name="empresa" value={id} /><input type="hidden" name="convite" value={convite.id} /><Button type="submit" variant="outline" size="sm">Revogar</Button></form>
        </div>) : <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>}
      </CardContent></Card>
    </div>}
  </>;
}
