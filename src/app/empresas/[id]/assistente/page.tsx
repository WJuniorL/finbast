import Link from "next/link";
import { requireEmpresa } from "@/lib/empresa";
import { Chat } from "@/components/assistente/chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AssistentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresa, canEdit } = await requireEmpresa(id);
  return <>
    <Link href={`/empresas/${id}`}>← Voltar para {empresa.nome}</Link>
    <div><h1 className="text-3xl font-bold">Assistente</h1><p className="text-muted-foreground">Dúvidas de uso, consultas e lançamentos por conversa em {empresa.nome}</p></div>
    <Alert><AlertDescription>Privacidade: dúvidas simples de uso são respondidas pelo próprio Finbast. Nas demais, sua pergunta e os dados desta conta que ela exigir (nomes, descrições e valores; nunca documentos, e-mails ou senhas) são enviados à OpenAI para gerar a resposta. O assistente só cria algo depois da sua confirmação, e nunca paga, baixa nem movimenta dinheiro.</AlertDescription></Alert>
    <Card><CardHeader><CardTitle><h2>Conversa</h2></CardTitle><CardDescription>{canEdit ? "Você pode pedir para criar contas a pagar e a receber, fornecedores e clientes." : "Seu acesso é somente leitura: o assistente responde, mas não cria registros."}</CardDescription></CardHeader><CardContent><Chat empresaId={id} somenteLeitura={!canEdit} /></CardContent></Card>
  </>;
}
