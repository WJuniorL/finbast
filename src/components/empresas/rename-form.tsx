"use client";
import { useActionState } from "react";
import { renameEmpresa } from "@/app/empresas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/form-state";

export function RenameForm({ empresa, nome }: { empresa: string; nome: string }) {
  const [state, action, pending] = useActionState(renameEmpresa, {} as FormState);
  return <form action={action} className="flex flex-wrap items-end gap-3">
    <input type="hidden" name="empresa" value={empresa} />
    <div className="space-y-2"><Label htmlFor="empresa-nome">Nome da conta</Label><Input id="empresa-nome" name="nome" defaultValue={nome} required maxLength={120} /></div>
    <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Renomear"}</Button>
    {state.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="w-full text-sm text-success">{state.success}</p>}
  </form>;
}
