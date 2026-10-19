import { redirect } from "next/navigation";

export default async function CadastrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/empresas/${id}/cadastros/categorias`);
}
