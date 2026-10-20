// Base local de ajuda "como faço X no sistema". Responde sem chamar o modelo.
// Mantida à mão: cada item precisa de uma pergunta de teste em tests/ajuda.test.ts.
// Só perguntas de USO e estáveis. Dado do usuário ("quanto gastei?") e ação ("crie...") vão ao agente.
export type ItemAjuda = {
  id: string;
  palavras: string[]; // minúsculas, sem acento
  minimo: number; // palavras distintas (por raiz) que precisam casar
  resposta: string;
  link?: { href: string; rotulo: string }; // relativo à empresa: "/pagar" vira /empresas/{id}/pagar
  restrito?: boolean; // true = também visível para quem só consulta (leitura / contador leitura)
};

export const AJUDA: ItemAjuda[] = [
  { id: "senha-login", palavras: ["senha", "login", "esqueci", "recuperar", "redefinir", "entrar", "acessar"], minimo: 2, restrito: true,
    resposta: "Na tela de entrada, use \"Esqueci minha senha\": enviamos um link para o seu e-mail para você criar uma nova senha de login." },
  { id: "senha-aprovacao", palavras: ["aprovacao", "senha", "esqueci", "trocar", "redefinir"], minimo: 2,
    resposta: "A senha de aprovação tem 6 dígitos (sem sequência nem repetição) e é diferente da senha de login. Você a cria no primeiro pagamento e valida cada baixa com ela. Para trocar, o sistema pede um código enviado ao seu e-mail.",
    link: { href: "/pagar", rotulo: "Abrir Contas a Pagar" } },
  { id: "pagar-parcelar", palavras: ["parcelar", "parcelado", "recorrente", "recorrencia", "repetir", "mensal", "lancamento", "lancar", "lanco", "criar", "crio"], minimo: 2,
    resposta: "Em Contas a Pagar (ou a Receber), ao criar o lançamento escolha o modo: única, parcelado (2 a 120 parcelas, valor dividido sem perder centavos) ou recorrente (gera as próximas ocorrências mensais).",
    link: { href: "/pagar", rotulo: "Abrir Contas a Pagar" } },
  { id: "pagar-lancar", palavras: ["despesa", "pagar", "lancar", "lanco", "criar", "crio", "cadastrar", "registrar"], minimo: 2,
    resposta: "Abra Contas a Pagar, preencha descrição, fornecedor, categoria de despesa, valor e vencimento e salve. Fornecedor e categoria precisam estar cadastrados antes.",
    link: { href: "/pagar", rotulo: "Abrir Contas a Pagar" } },
  { id: "pagar-baixar", palavras: ["baixa", "baixar", "pagamento", "quitar", "estornar", "estorno", "aprovacao"], minimo: 2,
    resposta: "Em Contas a Pagar, abra o lançamento e registre a baixa com a data do pagamento e, se houver, juros, multa ou desconto. A baixa é confirmada com a sua senha de aprovação de 6 dígitos. O Finbast não movimenta dinheiro: ele só registra o pagamento que você fez.",
    link: { href: "/pagar", rotulo: "Abrir Contas a Pagar" } },
  { id: "receber-lancar", palavras: ["receita", "receber", "lancar", "lanco", "criar", "crio", "cadastrar", "registrar"], minimo: 2,
    resposta: "Abra Contas a Receber, informe descrição, cliente, categoria de receita, valor e vencimento e salve. Cliente e categoria precisam estar cadastrados antes.",
    link: { href: "/receber", rotulo: "Abrir Contas a Receber" } },
  { id: "receber-baixar", palavras: ["baixa", "baixar", "recebimento", "recebi", "recebido", "estornar", "estorno"], minimo: 2,
    resposta: "Em Contas a Receber, abra o lançamento e registre o recebimento com a data e, se houver, juros, multa ou desconto. Para corrigir, use o estorno, que guarda o histórico.",
    link: { href: "/receber", rotulo: "Abrir Contas a Receber" } },
  { id: "cadastro-pessoas", palavras: ["cadastrar", "criar", "crio", "novo", "fornecedor", "cliente"], minimo: 2,
    resposta: "Em Cadastros, escolha Fornecedores ou Clientes, preencha o nome (documento e contato são opcionais) e use \"Salvar cadastro\".",
    link: { href: "/cadastros/fornecedores", rotulo: "Abrir cadastros" } },
  { id: "cadastro-categoria", palavras: ["categoria", "subcategoria", "centro", "custo", "cadastrar", "criar", "crio"], minimo: 2,
    resposta: "Em Cadastros, abra Categorias (receita ou despesa, com subcategorias) ou Centros de custo. Em categorias de despesa você marca se é custo fixo.",
    link: { href: "/cadastros/categorias", rotulo: "Abrir categorias" } },
  { id: "importar-extrato", palavras: ["importar", "extrato", "ofx", "csv", "xlsx", "planilha", "arquivo"], minimo: 2,
    resposta: "Em Contas bancárias, abra a conta, escolha o arquivo CSV, XLSX ou OFX do extrato e use \"Gerar prévia\". Confira e confirme a importação. Movimentos repetidos são reconhecidos e não duplicam.",
    link: { href: "/bancos", rotulo: "Abrir contas bancárias" } },
  { id: "conciliar", palavras: ["conciliar", "extrato", "vincular", "movimento", "pendente"], minimo: 2,
    resposta: "Em Contas bancárias, abra um movimento importado e vincule-o a uma baixa já registrada em Pagar ou Receber. Cada movimento concilia uma baixa inteira; dá para desfazer a conciliação.",
    link: { href: "/bancos", rotulo: "Abrir contas bancárias" } },
  { id: "fluxo-caixa", palavras: ["fluxo", "caixa", "previsto", "realizado", "projetado", "evolucao"], minimo: 2, restrito: true,
    resposta: "O Fluxo de caixa mostra, por período de até 366 dias, o realizado (baixas e extrato) e o previsto (títulos abertos), diário ou mensal, com filtro por conta bancária.",
    link: { href: "/fluxo-caixa", rotulo: "Abrir fluxo de caixa" } },
  { id: "dashboard", palavras: ["dashboard", "indicadores"], minimo: 1, restrito: true,
    resposta: "O Dashboard resume o mês escolhido: caixa realizado e projetado, títulos em aberto, vencidos, custos fixos e conciliação pendente, com atalhos para cada origem.",
    link: { href: "/dashboard", rotulo: "Abrir Dashboard" } },
  { id: "dre", palavras: ["dre"], minimo: 1, restrito: true,
    resposta: "Em DRE e Relatórios, escolha o período e a base (registrado por vencimento ou realizado por liquidação). A DRE é gerencial, não contábil. Classifique as categorias para a DRE ficar correta.",
    link: { href: "/relatorios", rotulo: "Abrir DRE e Relatórios" } },
  { id: "exportar", palavras: ["exportar", "relatorio", "csv", "xlsx", "excel", "planilha", "baixar"], minimo: 2, restrito: true,
    resposta: "Em DRE e Relatórios, aplique os filtros e use os links de exportação CSV ou XLSX. O arquivo traz todos os registros do filtro, não só a página visível.",
    link: { href: "/relatorios", rotulo: "Abrir DRE e Relatórios" } },
  { id: "planejamento-lider", palavras: ["lider", "setor", "link", "contribuicao", "convidar", "enviar"], minimo: 2,
    resposta: "Em Planejamento, gere o link individual do líder do setor. Ele confirma o e-mail com um código, envia as estimativas e você decide o que importar para o cenário. O líder não tem acesso ao financeiro.",
    link: { href: "/planejamento", rotulo: "Abrir Planejamento" } },
  { id: "planejamento", palavras: ["planejamento", "planejar", "cenario", "simulador", "simular", "orcamento"], minimo: 2, restrito: true,
    resposta: "Em Planejamento, crie um cenário anual (real + camada de plano), preencha a grade por setor e categoria e use o simulador para ver o efeito no caixa. Planejado nunca vira lançamento em Contas a Pagar.",
    link: { href: "/planejamento", rotulo: "Abrir Planejamento" } },
  { id: "produtos", palavras: ["produto", "custo", "margem", "preco", "precificacao", "rateio"], minimo: 2, restrito: true,
    resposta: "Em Produtos e custos, vincule custos diretos, compartilhados (com regra de rateio) e gerais. A margem de contribuição não inclui custos gerais, que aparecem separados. Dá para simular preço e volume.",
    link: { href: "/produtos", rotulo: "Abrir produtos e custos" } },
  { id: "convidar", palavras: ["convidar", "convite", "usuario", "acesso", "permissao", "contador", "funcionario"], minimo: 2,
    resposta: "Na página da conta, em \"Convidar usuário\", informe o e-mail e o nível de acesso e use \"Criar convite\". Compartilhe o link gerado: ele vale 7 dias e só funciona com o e-mail convidado. Só o proprietário convida.",
    link: { href: "", rotulo: "Abrir a conta" } },
  { id: "acesso-remover", palavras: ["remover", "excluir", "sair", "acesso", "usuario", "renomear", "nome"], minimo: 2, restrito: true,
    resposta: "Na página da conta, o proprietário altera o nível de acesso, remove acessos e renomeia a conta. Quem não é proprietário pode usar \"Sair desta conta\".",
    link: { href: "", rotulo: "Abrir a conta" } },
];

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
// Raiz de 5 letras: "cadastro", "cadastrar" e "cadastrei" viram "cadas". Palavra curta casa inteira.
const raiz = (p: string) => (p.length > 5 ? p.slice(0, 5) : p);

// null = sem confiança: o agente resolve (mais seguro que uma resposta errada com cara de oficial).
export function buscarAjuda(pergunta: string, restrito = false): ItemAjuda | null {
  const termos = new Set(normalizar(pergunta).split(/[^a-z0-9]+/).filter(Boolean).map(raiz));
  let melhor: ItemAjuda | null = null;
  let pontos = 0;
  for (const item of AJUDA) {
    if (restrito && !item.restrito) continue;
    const casou = new Set(item.palavras.map(raiz).filter((p) => termos.has(p))).size;
    if (casou >= item.minimo && casou > pontos) { melhor = item; pontos = casou; }
  }
  return melhor;
}

// Mesma fonte para o prompt do agente: ele nunca contradiz a base.
export const guiaDoSistema = (restrito = false) =>
  AJUDA.filter((i) => !restrito || i.restrito).map((i) => `- ${i.resposta}`).join("\n");
