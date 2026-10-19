"use client";
import { useActionState } from "react";
import { acceptInvite } from "@/app/convites/actions";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, {} as FormState);
  return <form action={action} className="space-y-4"><input type="hidden" name="token" value={token} />
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Confirmando…" : "Aceitar convite"}</Button>
  </form>;
}
