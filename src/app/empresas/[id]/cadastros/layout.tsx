import Link from "next/link";
import { requireEmpresa } from "@/lib/empresa";
import { CadastroNav } from "@/components/cadastros/cadastro-nav";
import { Badge } from "@/components/ui/badge";

export default async function CadastrosLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresa, canEdit } = await requireEmpresa(id);
  return <>
    <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/empresas/${id}`} className="text-sm">← Voltar para {empresa.nome}</Link><Badge variant="secondary">{canEdit ? "Gerenciar cadastros" : "Somente consulta"}</Badge></div>
      <CadastroNav empresaId={id} />
    </div>
    {children}
  </>;
}
