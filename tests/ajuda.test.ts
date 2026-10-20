import assert from "node:assert/strict";
import test from "node:test";
import { AJUDA, buscarAjuda, guiaDoSistema } from "../src/lib/ajuda.ts";

// Uma pergunta realista por item: garante que nenhum item ficou inalcançável.
const casos: Record<string, string> = {
  "senha-login": "esqueci minha senha de login",
  "senha-aprovacao": "esqueci a senha de aprovação",
  "pagar-parcelar": "como lanço uma despesa parcelada",
  "pagar-lancar": "como lanço uma despesa",
  "pagar-baixar": "como dou baixa em um pagamento",
  "receber-lancar": "como crio uma conta a receber",
  "receber-baixar": "como dou baixa em um recebimento",
  "cadastro-pessoas": "como cadastrar um fornecedor",
  "cadastro-categoria": "como crio um centro de custo",
  "importar-extrato": "como importo o extrato",
  "conciliar": "como concilio o extrato",
  "fluxo-caixa": "onde vejo o fluxo de caixa",
  "dashboard": "onde fica o dashboard",
  "dre": "como vejo a DRE",
  "exportar": "como exporto o relatório para excel",
  "planejamento-lider": "como envio o link para o líder do setor",
  "planejamento": "como crio um cenário de planejamento",
  "produtos": "como calculo a margem do produto",
  "convidar": "como convido o contador",
  "acesso-remover": "como removo um acesso",
};

test("todo item da base tem uma pergunta de teste e é alcançável", () => {
  assert.deepEqual(Object.keys(casos).sort(), AJUDA.map((i) => i.id).sort());
  for (const [id, pergunta] of Object.entries(casos)) assert.equal(buscarAjuda(pergunta)?.id, id, pergunta);
});

test("conjugações, maiúsculas e acentos levam ao mesmo item", () => {
  for (const q of ["como cadastro um fornecedor", "quero cadastrar fornecedor", "COMO CADASTRAR FORNECEDOR", "cadastrei um fornecêdor"])
    assert.equal(buscarAjuda(q)?.id, "cadastro-pessoas", q);
  assert.equal(buscarAjuda("PLANEJAMENTO CENÁRIO")?.id, "planejamento");
});

test("perguntas genéricas ou sobre dados do usuário não casam (vão ao agente)", () => {
  for (const q of ["plano", "oi", "quantos clientes tenho hoje", "quanto gastei em setembro", "quantas parcelas tenho a pagar", "qual meu saldo", "cancele a despesa 12"])
    assert.equal(buscarAjuda(q), null, q);
});

test("perfil restrito só recebe itens restritos", () => {
  assert.equal(buscarAjuda("como lanço uma despesa", true), null);
  assert.equal(buscarAjuda("onde vejo o fluxo de caixa", true)?.id, "fluxo-caixa");
  for (const item of AJUDA) {
    const achado = buscarAjuda(casos[item.id], true);
    if (achado) assert.equal(achado.restrito, true, item.id);
  }
  assert.ok(!guiaDoSistema(true).includes("Criar convite"));
  assert.ok(guiaDoSistema(false).includes("Criar convite"));
});
