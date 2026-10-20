"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEmpresa } from "@/lib/empresa";
import { buscarAjuda } from "@/lib/ajuda";
import { assistenteConfigurado, perguntarAoAgente, propostaSchema, type PropostaVista } from "@/lib/assistente";
import { saveCadastro } from "@/app/empresas/[id]/cadastros/actions";
import { savePagar } from "@/app/empresas/[id]/pagar/actions";
import { saveReceber } from "@/app/empresas/[id]/receber/actions";

const TETO_DIARIO = 40;
export type Resposta = { texto: string; daAjuda?: boolean; link?: { href: string; rotulo: string }; proposta?: PropostaVista; erro?: boolean };

const entrada = z.object({
  pergunta: z.string().trim().min(1, "Escreva sua pergunta.").max(500, "Use até 500 caracteres."),
  semAjuda: z.boolean().default(false),
  historico: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) })).max(6).default([]),
});

// Ordem: 1) valida entrada e sessão; 2) base local (sem modelo, sem cota); 3) teto diário; 4) agente.
export async function perguntar(empresaId: string, dados: unknown): Promise<Resposta> {
  const parsed = entrada.safeParse(dados);
  if (!parsed.success) return { texto: parsed.error.issues[0]?.message ?? "Pergunta inválida.", erro: true };
  const { pergunta, semAjuda, historico } = parsed.data;
  const { supabase, empresa, canEdit } = await requireEmpresa(empresaId);

  if (!semAjuda) {
    const item = buscarAjuda(pergunta, !canEdit);
    if (item) return { texto: item.resposta, daAjuda: true, link: item.link && { href: `/empresas/${empresa.id}${item.link.href}`, rotulo: item.link.rotulo } };
  }
  if (!assistenteConfigurado()) return { texto: "O assistente de IA ainda não está configurado neste ambiente.", erro: true };

  const { data: dentro, error } = await supabase.rpc("registrar_pergunta_assistente", { p_empresa: empresa.id, p_limite: TETO_DIARIO });
  if (error) return { texto: "Não foi possível usar o assistente agora. Tente novamente.", erro: true };
  if (!dentro) return { texto: "Você chegou ao limite de perguntas por hoje. Amanhã ele volta a responder.", erro: true };

  try {
    const r = await perguntarAoAgente({ supabase, empresaId: empresa.id, canEdit, empresaNome: empresa.nome }, historico, pergunta);
    return { texto: r.texto, proposta: r.proposta };
  } catch {
    return { texto: "O assistente não conseguiu responder agora. Tente novamente em instantes.", erro: true };
  }
}

// Executa uma proposta já confirmada pelo usuário, pelas mesmas Server Actions das telas (permissão, validação e idempotência).
export async function confirmarProposta(empresaId: string, dados: unknown): Promise<{ ok?: true; mensagem: string }> {
  const parsed = propostaSchema.safeParse(dados);
  if (!parsed.success) return { mensagem: "Proposta inválida. Peça ao assistente de novo." };
  const p = parsed.data;
  const { empresa, canEdit } = await requireEmpresa(empresaId);
  if (!canEdit) return { mensagem: "Seu acesso não permite esta operação." };
  const form = new FormData();
  let r;
  if (p.tipo === "criar_fornecedor" || p.tipo === "criar_cliente") {
    form.set("nome", p.nome ?? "");
    r = await saveCadastro(empresa.id, p.tipo === "criar_fornecedor" ? "fornecedores" : "clientes", {}, form);
  } else {
    const pagar = p.tipo === "criar_pagar";
    const campos: Record<string, string> = { request_id: p.request_id, descricao: p.descricao ?? "", documento: "", [pagar ? "fornecedor_id" : "cliente_id"]: p.contraparte_id ?? "",
      categoria_id: p.categoria_id ?? "", centro_custo_id: p.centro_custo_id ?? "", valor_centavos: p.valor ?? "", vencimento: p.vencimento ?? "", modo: p.modo, parcelas: String(p.modo === "unica" ? 1 : p.parcelas) };
    if (pagar) campos.custo_fixo_override = "categoria";
    for (const [k, v] of Object.entries(campos)) form.set(k, v);
    r = pagar ? await savePagar(empresa.id, {}, form) : await saveReceber(empresa.id, {}, form);
  }
  if (r.error) return { mensagem: r.error };
  revalidatePath(`/empresas/${empresa.id}`, "layout");
  return { ok: true, mensagem: r.success ?? "Feito." };
}
