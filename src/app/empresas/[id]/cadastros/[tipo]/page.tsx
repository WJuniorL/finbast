import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireEmpresa } from "@/lib/empresa";
import { cadastroConfig, cadastroKindSchema, type CadastroRecord, type CategoryParent } from "@/lib/cadastros";
import { CadastroManager } from "@/components/cadastros/cadastro-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function CadastroPage({ params, searchParams }: {
  params: Promise<{ id: string; tipo: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { id, tipo } = await params;
  const parsedKind = cadastroKindSchema.safeParse(tipo);
  if (!parsedKind.success) notFound();
  const kind = parsedKind.data;
  const { empresa, supabase, canEdit } = await requireEmpresa(id);
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0,120) : "";
  const status = query.status === "todos" || query.status === "arquivados" ? query.status : "ativos";
  const page = /^\d+$/.test(query.page ?? "") ? Math.max(1, Math.min(1000, Number(query.page))) : 1;
  const config = cadastroConfig[kind];
  const columns = kind === "categorias" ? "id,nome,ativo,atualizado_em,tipo,cor,custo_fixo,pai_id"
    : kind === "centros-custo" ? "id,nome,ativo,atualizado_em,descricao" : "id,nome,ativo,atualizado_em,documento,email,telefone,cidade,uf,observacoes";
  let request = supabase.from(config.table).select(columns, { count: "exact" }).eq("empresa_id", empresa.id);
  if (status !== "todos") request = request.eq("ativo", status === "ativos");
  if (q) request = request.ilike("nome", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await request.order("nome").order("id").range((page-1)*50, page*50-1);
  if (error) throw new Error("Não foi possível carregar os cadastros.");
  const { data: parents, error: parentsError } = kind === "categorias" && canEdit
    ? await supabase.from("categorias").select("id,nome,tipo,custo_fixo,ativo").eq("empresa_id", empresa.id).is("pai_id",null).order("nome").limit(1000)
    : { data: [], error: null };
  if (parentsError) throw new Error("Não foi possível carregar as categorias principais.");
  const records = (data ?? []) as unknown as CadastroRecord[];
  const parentNames = new Map((parents ?? []).map((parent) => [parent.id,parent.nome]));
  // A chave composta garante isolamento no banco; nomes vêm de uma consulta explícita,
  // sem depender do reconhecimento de relação autorreferente no cache da Data API.
  const missingParents = [...new Set(records.map((record) => record.pai_id).filter((parentId): parentId is string => !!parentId && !parentNames.has(parentId)))];
  if (kind === "categorias" && missingParents.length) {
    const { data: referenced, error: referencedError } = await supabase.from("categorias").select("id,nome").eq("empresa_id",empresa.id).in("id",missingParents);
    if (referencedError) throw new Error("Não foi possível carregar as categorias principais.");
    referenced?.forEach((parent) => parentNames.set(parent.id,parent.nome));
  }
  const displayRecords = records.map((record) => ({ ...record, pai: record.pai_id && parentNames.has(record.pai_id) ? { nome: parentNames.get(record.pai_id)! } : null }));
  const pages = Math.max(1, Math.ceil((count ?? 0)/50));
  const pageHref = (number: number) => `?${new URLSearchParams({ q, status, page: String(number) })}`;
  if (page > pages) redirect(`/empresas/${id}/cadastros/${kind}${pageHref(pages)}`);
  return <>
    <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">{config.title}</h1><p className="text-muted-foreground">{config.description}</p></div>
    <form className="flex flex-wrap items-end gap-3" method="get">
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="buscar-cadastro">Buscar por nome</Label><Input id="buscar-cadastro" name="q" maxLength={120} defaultValue={q} placeholder={`Buscar em ${config.title.toLowerCase()}`} /></div>
      <div className="space-y-2"><Label htmlFor="status-cadastro">Mostrar</Label><select id="status-cadastro" name="status" defaultValue={status} className="h-9 rounded-md border border-input bg-card px-3 text-sm"><option value="ativos">Ativos</option><option value="arquivados">Arquivados</option><option value="todos">Todos</option></select></div>
      <Button type="submit" variant="outline">Filtrar</Button>
    </form>
    <CadastroManager key={`${id}-${kind}`} empresaId={id} kind={kind} records={displayRecords} parents={(parents ?? []) as CategoryParent[]} canEdit={canEdit} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{count ?? 0} cadastro(s) · Página {page} de {pages}</p><div className="flex gap-4">{page > 1 && <Link href={pageHref(page-1)}>← Anterior</Link>}{page < pages && <Link href={pageHref(page+1)}>Próxima →</Link>}</div></div>
  </>;
}
