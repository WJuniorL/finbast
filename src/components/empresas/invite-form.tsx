"use client";
import { useActionState, useState } from "react";
import { createInvite, type InviteState } from "@/app/convites/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({ empresa }: { empresa: string }) {
  const [state, action, pending] = useActionState(createInvite, {} as InviteState);
  const [copyMessage, setCopyMessage] = useState("");
  return <div className="space-y-4"><form action={action} className="space-y-4">
    <input type="hidden" name="empresa" value={empresa} />
    <div className="space-y-2"><Label htmlFor="invite-email">E-mail do convidado</Label><Input id="invite-email" name="email" type="email" required maxLength={254} placeholder="pessoa@empresa.com.br" /></div>
    <div className="space-y-2"><Label htmlFor="invite-role">Nível de acesso</Label><select id="invite-role" name="papel" defaultValue="leitura" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
      <option value="leitura">Somente leitura</option><option value="operador">Operador</option><option value="administrador">Administrador</option><option value="contador_completo">Contador · completo</option><option value="contador_leitura">Contador · leitura</option>
    </select></div>
    <p className="text-xs text-muted-foreground">O destinatário precisa entrar com esse e-mail confirmado. Contadores não podem movimentar dinheiro.</p>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Criando…" : "Criar convite"}</Button>
  </form>{state.link && <div className="space-y-3 rounded-lg border bg-muted p-4">
    <p role="status" className="text-sm">{state.success}</p>
    <code className="block break-all text-xs">{state.link}</code>
    <Button type="button" variant="outline" size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(new URL(state.link!, window.location.origin).href); setCopyMessage("Link copiado."); }
      catch { setCopyMessage("Selecione o link acima e copie manualmente com o endereço deste site."); }
    }}>Copiar link</Button><span role="status" className="ml-3 text-xs">{copyMessage}</span>
  </div>}</div>;
}
