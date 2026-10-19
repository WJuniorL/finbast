"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, recoverPassword, updatePassword } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/form-state";

const modes = {
  login: { action: login, label: "Entrar", pending: "Entrando…" },
  signup: { action: signup, label: "Criar conta", pending: "Criando conta…" },
  recover: { action: recoverPassword, label: "Enviar link", pending: "Enviando…" },
  update: { action: updatePassword, label: "Salvar nova senha", pending: "Salvando…" },
};

export function AuthForm({ mode, next = "/empresas" }: { mode: keyof typeof modes; next?: string }) {
  const config = modes[mode];
  const [state, action, pending] = useActionState(config.action, {} as FormState);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {mode !== "update" && <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="voce@empresa.com.br" />
      </div>}
      {mode !== "recover" && <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">{mode === "update" ? "Nova senha" : "Senha"}</Label>
          {mode === "login" && <Link href="/recuperar-senha" className="text-xs text-muted-foreground hover:text-foreground">Esqueci minha senha</Link>}
        </div>
        <Input id="password" name="password" type="password" required maxLength={128}
          minLength={mode === "login" ? 1 : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode !== "login" && <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres.</p>}
      </div>}
      {mode === "update" && <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      </div>}
      {state.error && <Alert variant="destructive" role="alert"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.success && <Alert role="status"><AlertDescription>{state.success}</AlertDescription></Alert>}
      <Button type="submit" disabled={pending} className="w-full rounded-full" aria-busy={pending}>{pending ? config.pending : config.label}</Button>
    </form>
  );
}
