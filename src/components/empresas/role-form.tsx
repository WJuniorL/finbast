"use client";
import { useActionState } from "react";
import { changeRole } from "@/app/empresas/actions";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
const roles: Record<string, string> = { administrador: "Administrador", operador: "Operador", leitura: "Somente leitura", contador_completo: "Contador · completo", contador_leitura: "Contador · leitura" };

export function RoleForm({ empresa, usuario, papel }: { empresa: string; usuario: string; papel: string }) {
  const [state, action, pending] = useActionState(changeRole, {} as FormState);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="empresa" value={empresa} /><input type="hidden" name="usuario" value={usuario} />
    <div className="flex flex-wrap gap-2"><select name="papel" defaultValue={papel} aria-label="Nível de acesso" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
      {Object.entries(roles).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
    </select><Button variant="outline" type="submit" size="sm" disabled={pending}>{pending ? "Salvando…" : "Salvar acesso"}</Button></div>
    {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-xs text-success">{state.success}</p>}
  </form>;
}
