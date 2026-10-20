# Assistente de IA

Tela `/empresas/[id]/assistente`. Decisões de 19/10/2026: entra no MVP; faz perguntas e propõe ações;
provedor OpenAI; pode enviar dados detalhados ao provedor, com aviso na tela.

## Ordem de decisão (um ponto só: `perguntar` em `assistente/actions.ts`)

1. Valida entrada (1–500 caracteres, histórico de até 6 mensagens) e sessão/empresa (`requireEmpresa`).
2. Base local (`src/lib/ajuda.ts`): achou → resposta pronta e link da tela, **sem modelo e sem cota**.
   Perfil só-consulta (leitura / contador leitura) só vê itens `restrito`.
3. Sem base: se `OPENAI_API_KEY`/`OPENAI_MODEL` faltam, avisa e para (sem consumir cota).
4. Teto diário: RPC `registrar_pergunta_assistente` (40 por conta/dia, fuso America/Bahia, atômica).
   Estourou: mensagem fixa; a base local continua respondendo.
5. Agente (`src/lib/assistente.ts`): Chat Completions da OpenAI, até 6 voltas de ferramentas.

O botão **Perguntar ao assistente** reenvia a mesma pergunta com `semAjuda: true` (vale só para ela).

## Base local

Lista tipada em `ajuda.ts`; casamento por raiz de 5 letras, sem acento, `minimo` de palavras distintas.
Na dúvida devolve `null` e o agente resolve. `guiaDoSistema()` alimenta o prompt do agente (fonte única).
Item novo exige pergunta em `tests/ajuda.test.ts`. Ao mudar tela, preço ou limite, revisar a base.

## Agente

- Leitura: `buscar_cadastros`, `listar_titulos`, `resumo_mes` (RPC `resumo_dashboard`), sempre pela sessão
  do usuário (RLS), nunca service role. Não saem: documentos, e-mails, telefones, senhas, outras empresas.
- Proposta: `propor_acao` (`criar_pagar`, `criar_receber`, `criar_fornecedor`, `criar_cliente`) só monta o
  cartão de confirmação; ids são conferidos na empresa. Só para quem pode editar.
- Execução: `confirmarProposta` chama as mesmas Server Actions das telas (`savePagar`, `saveReceber`,
  `saveCadastro`): permissão, validação, versão e idempotência (`request_id` por proposta) valem.
- Fora do escopo do agente: baixa, estorno, aprovação, cancelamento, edição e qualquer movimentação de
  dinheiro. A senha de aprovação nunca passa pelo assistente.
- Textos vindos de ferramentas são tratados como dados (instrução no prompt contra injeção).

## Configuração

`OPENAI_API_KEY` e `OPENAI_MODEL` no `.env.local` (somente servidor). Sem elas, só a base local responde.

## Limites conhecidos

- O teto é por conta (compartilhado entre usuários) e conta também chamadas que falham no provedor.
- Injeção de prompt em textos do usuário pode fazer o modelo *propor* algo; a confirmação do usuário é a barreira.
- Edição de lançamentos por conversa não existe (só criação).
- Histórico da conversa vive no navegador; não é gravado.
- O texto livre da pergunta e dados consultados vão à OpenAI; revisar política/contrato antes de abrir a clientes.
- Respostas do modelo variam; o roteiro valida o fluxo (proposta, confirmação, isolamento), não o texto.
