import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import { AcceptInviteForm } from "@/components/empresas/accept-invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const { user } = await requireUser(`/convites/${token}`);
  return <main className="flex min-h-svh items-center justify-center p-6"><Card className="w-full max-w-md">
    <CardHeader><CardTitle>Você recebeu um convite</CardTitle><CardDescription>Confirme para acessar a conta vinculada ao convite.</CardDescription></CardHeader>
    <CardContent className="space-y-6"><p className="text-sm">Você entrou como <strong>{user.email}</strong>. O convite precisa ter sido enviado para esse e-mail.</p><AcceptInviteForm token={token} />
      <div className="flex items-center justify-between"><Link href="/empresas" className="text-sm">Minhas contas</Link><form action={logout}><Button variant="ghost" size="sm">Sair</Button></form></div>
    </CardContent>
  </Card></main>;
}
