"use client";
import { useActionState, useState } from "react";
import { saveCadastro, setCadastroStatus } from "@/app/empresas/[id]/cadastros/actions";
import { cadastroConfig, categoryColors, estados, type CadastroKind, type CadastroRecord, type CategoryParent } from "@/lib/cadastros";
import type { FormState } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-ring";

function StatusForm({ empresaId, kind, record }: { empresaId: string; kind: CadastroKind; record: CadastroRecord }) {
  const [state, action, pending] = useActionState(setCadastroStatus.bind(null,empresaId,kind), {} as FormState);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="id" value={record.id} /><input type="hidden" name="atualizado_em" value={record.atualizado_em} /><input type="hidden" name="ativo" value={String(!record.ativo)} />
    <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label={`${record.ativo ? "Arquivar" : "Reativar"} ${record.nome}`}>{pending ? "Salvando…" : record.ativo ? "Arquivar" : "Reativar"}</Button>
    {state.error && <p role="alert" className="max-w-xs whitespace-normal text-xs text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-xs text-success">{state.success}</p>}
  </form>;
}

function CadastroForm({ empresaId, kind, record, parents, onSaved, onCancel }: {
  empresaId: string; kind: CadastroKind; record?: CadastroRecord; parents: CategoryParent[];
  onSaved: (message: string) => void; onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string,string>>({
    nome: record?.nome ?? "", tipo: record?.tipo ?? "despesa", cor: record?.cor ?? "vermelho", custo_fixo: record?.custo_fixo ? "on" : "", pai_id: record?.pai_id ?? "",
    descricao: record?.descricao ?? "", documento: record?.documento ?? "", email: record?.email ?? "", telefone: record?.telefone ?? "", cidade: record?.cidade ?? "", uf: record?.uf ?? "", observacoes: record?.observacoes ?? "",
  });
  const setField = (name: string, value: string) => setValues((previous) => ({ ...previous, [name]: value }));
  const [state, action, pending] = useActionState(async (previous: FormState, form: FormData) => {
    const result = await saveCadastro(empresaId,kind,previous,form);
    if (result.success) onSaved(result.success);
    return result;
  }, {} as FormState);
  const contact = kind === "clientes" || kind === "fornecedores";
  return <form action={action} className="space-y-5">
    {record && <><input type="hidden" name="id" value={record.id} /><input type="hidden" name="atualizado_em" value={record.atualizado_em} /></>}
    <div className="space-y-2"><Label htmlFor="cadastro-nome">Nome</Label><Input id="cadastro-nome" name="nome" value={values.nome} onChange={(event) => setField("nome",event.target.value)} required minLength={2} maxLength={contact ? 160 : 120} placeholder={contact ? "Nome ou razão social" : kind === "categorias" ? "Ex.: Salários" : "Ex.: Marketing"} /></div>
    {kind === "categorias" && <>
      <div className="space-y-2"><Label htmlFor="categoria-pai">Categoria principal</Label><select id="categoria-pai" name="pai_id" value={values.pai_id} className={selectClass} onChange={(event) => {
        const parent = parents.find((item) => item.id === event.target.value);
        setValues((previous) => ({ ...previous, pai_id: event.target.value, ...(parent ? { tipo: parent.tipo, custo_fixo: parent.custo_fixo ? "on" : "" } : {}) }));
      }}><option value="">Sem categoria principal</option>{parents.filter((parent) => parent.id !== record?.id).map((parent) => <option key={parent.id} value={parent.id} disabled={!parent.ativo && parent.id !== record?.pai_id}>{parent.nome}{!parent.ativo ? " (arquivada)" : ""}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="categoria-tipo">Tipo</Label><select id="categoria-tipo" name="tipo" className={selectClass} value={values.tipo} onChange={(event) => setValues((previous) => ({ ...previous, tipo: event.target.value, custo_fixo: event.target.value === "receita" ? "" : previous.custo_fixo }))}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></div>
      <fieldset className="space-y-3"><legend className="text-sm font-medium">Cor da categoria</legend><RadioGroup name="cor" value={values.cor} onValueChange={(value) => setField("cor",value)} className="grid grid-cols-2 gap-3">{Object.entries(categoryColors).map(([name,color]) => <div key={name} className="flex items-center gap-2"><RadioGroupItem value={name} id={`cor-${name}`} /><Label htmlFor={`cor-${name}`} className="capitalize"><span className="size-3 rounded-full" style={{ background: color }} />{name}</Label></div>)}</RadioGroup></fieldset>
      <div className="space-y-2"><Label htmlFor="custo-fixo" className="flex items-center gap-2"><input id="custo-fixo" name="custo_fixo" type="checkbox" checked={values.custo_fixo === "on"} disabled={values.tipo === "receita"} onChange={(event) => setField("custo_fixo",event.target.checked ? "on" : "")} className="size-4 accent-primary" />Custo fixo</Label><p className="text-xs text-muted-foreground">Marca despesas que compõem a base de custos. É independente de recorrência.</p></div>
    </>}
    {kind === "centros-custo" && <div className="space-y-2"><Label htmlFor="centro-descricao">Descrição <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="centro-descricao" name="descricao" value={values.descricao} onChange={(event) => setField("descricao",event.target.value)} maxLength={500} /></div>}
    {contact && <>
      <div className="space-y-2"><Label htmlFor="contato-documento">CPF ou CNPJ <span className="text-muted-foreground">(opcional)</span></Label><Input id="contato-documento" name="documento" value={values.documento} onChange={(event) => setField("documento",event.target.value)} inputMode="numeric" maxLength={24} placeholder="Com ou sem pontuação" /></div>
      <div className="space-y-2"><Label htmlFor="contato-email">E-mail <span className="text-muted-foreground">(opcional)</span></Label><Input id="contato-email" name="email" type="email" value={values.email} onChange={(event) => setField("email",event.target.value)} maxLength={254} /></div>
      <div className="space-y-2"><Label htmlFor="contato-telefone">Telefone <span className="text-muted-foreground">(opcional)</span></Label><Input id="contato-telefone" name="telefone" type="tel" value={values.telefone} onChange={(event) => setField("telefone",event.target.value)} maxLength={30} /></div>
      <div className="grid grid-cols-[1fr_90px] gap-3"><div className="space-y-2"><Label htmlFor="contato-cidade">Cidade</Label><Input id="contato-cidade" name="cidade" value={values.cidade} onChange={(event) => setField("cidade",event.target.value)} maxLength={120} /></div><div className="space-y-2"><Label htmlFor="contato-uf">UF</Label><select id="contato-uf" name="uf" value={values.uf} onChange={(event) => setField("uf",event.target.value)} className={selectClass}><option value="">—</option>{estados.map((uf) => <option key={uf}>{uf}</option>)}</select></div></div>
      <div className="space-y-2"><Label htmlFor="contato-observacoes">Observações <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="contato-observacoes" name="observacoes" value={values.observacoes} onChange={(event) => setField("observacoes",event.target.value)} maxLength={500} /></div>
    </>}
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : record ? "Salvar alterações" : "Salvar cadastro"}</Button>{record && <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>}</div>
  </form>;
}

export function CadastroManager({ empresaId, kind, records, parents, canEdit }: { empresaId: string; kind: CadastroKind; records: CadastroRecord[]; parents: CategoryParent[]; canEdit: boolean }) {
  const [selected, setSelected] = useState<CadastroRecord>();
  const [formVersion, setFormVersion] = useState(0);
  const [message, setMessage] = useState("");
  const contact = kind === "clientes" || kind === "fornecedores";
  const config = cadastroConfig[kind];
  return <div className="space-y-4">
    {message && <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm">{message}</p>}
    <div className={`grid grid-cols-1 items-start gap-6 ${canEdit ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <Card className="min-w-0"><CardHeader><CardTitle>{config.title} desta conta</CardTitle><CardDescription>Arquivar preserva o cadastro para consultas e histórico.</CardDescription></CardHeader><CardContent className="min-w-0">
        {records.length ? <Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>{kind === "categorias" ? "Classificação" : contact ? "Contato" : "Descrição"}</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead className="text-right">Ações</TableHead>}</TableRow></TableHeader><TableBody>
          {records.map((record) => <TableRow key={record.id} data-testid="cadastro-row"><TableCell className="min-w-40 whitespace-normal"><div className="flex items-center gap-2">{kind === "categorias" && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: categoryColors[record.cor ?? "vermelho"] }} />}<span className="font-semibold">{record.nome}</span></div>{record.pai && <p className="mt-1 text-xs text-muted-foreground">Subcategoria de {record.pai.nome}</p>}{record.documento && <p className="mt-1 text-xs text-muted-foreground">{record.documento}</p>}{record.cidade && <p className="mt-1 text-xs text-muted-foreground">{record.cidade}{record.uf ? ` · ${record.uf}` : ""}</p>}</TableCell>
            <TableCell className="max-w-60 whitespace-normal text-sm text-muted-foreground">{kind === "categorias" ? <div className="space-y-2"><span>{record.tipo === "receita" ? "Receita" : "Despesa"}</span>{record.custo_fixo && <Badge variant="secondary" className="ml-2">Custo fixo</Badge>}</div> : contact ? <div className="space-y-1 break-all"><p>{record.email ?? "—"}</p><p>{record.telefone}</p></div> : record.descricao ?? "—"}</TableCell>
            <TableCell><Badge variant={record.ativo ? "secondary" : "outline"}>{record.ativo ? "Ativo" : "Arquivado"}</Badge></TableCell>
            {canEdit && <TableCell><div className="flex justify-end gap-1"><Button type="button" variant="outline" size="sm" aria-label={`Editar ${record.nome}`} onClick={() => { setSelected(record); setMessage(""); }}>Editar</Button><StatusForm empresaId={empresaId} kind={kind} record={record} /></div></TableCell>}
          </TableRow>)}
        </TableBody></Table> : <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum cadastro encontrado. Ajuste os filtros{canEdit ? " ou crie o primeiro cadastro." : "."}</div>}
      </CardContent></Card>
      {canEdit && <Card className="min-w-0 lg:sticky lg:top-6"><CardHeader><CardTitle>{selected ? `Editar ${config.singular}` : `Cadastrar ${config.singular}`}</CardTitle><CardDescription>{selected ? selected.nome : "Os dados pertencem somente a esta conta."}</CardDescription></CardHeader><CardContent><CadastroForm key={`${kind}-${selected?.id ?? "new"}-${formVersion}`} empresaId={empresaId} kind={kind} record={selected} parents={parents} onCancel={() => setSelected(undefined)} onSaved={(success) => { setSelected(undefined); setFormVersion((version) => version+1); setMessage(success); }} /></CardContent></Card>}
    </div>
  </div>;
}
