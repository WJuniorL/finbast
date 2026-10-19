"use client";
import { useActionState, useState } from "react";
import { createEmpresa } from "@/app/empresas/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/form-state";

export function EmpresaForm() {
  const [state, action, pending] = useActionState(createEmpresa, {} as FormState);
  const [fields, setFields] = useState({ nome: "", tipo: "CNPJ", documento: "" });
  return <form action={action} className="space-y-5">
    <div className="space-y-2"><Label htmlFor="nome">Nome da conta</Label><Input id="nome" name="nome" required minLength={2} maxLength={120} placeholder="Nome da empresa ou conta pessoal" value={fields.nome} onChange={(event) => setFields({ ...fields, nome: event.target.value })} /></div>
    <fieldset className="space-y-3"><legend className="text-sm font-medium">Tipo de conta</legend><RadioGroup name="tipo" value={fields.tipo} onValueChange={(tipo) => setFields({ ...fields, tipo })} className="flex gap-6">
      <div className="flex items-center gap-2"><RadioGroupItem value="CNPJ" id="cnpj" /><Label htmlFor="cnpj">Empresa · CNPJ</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="CPF" id="cpf" /><Label htmlFor="cpf">Pessoal · CPF</Label></div>
    </RadioGroup></fieldset>
    <div className="space-y-2"><Label htmlFor="documento">CPF ou CNPJ</Label><Input id="documento" name="documento" required inputMode="numeric" maxLength={24} placeholder="Com ou sem pontuação" value={fields.documento} onChange={(event) => setFields({ ...fields, documento: event.target.value })} /><p className="text-xs text-muted-foreground">Os acessos desta conta são definidos separadamente.</p></div>
    {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
    <Button type="submit" disabled={pending} aria-busy={pending} className="rounded-full">{pending ? "Criando…" : "Criar conta"}</Button>
  </form>;
}
