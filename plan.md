# Finbast — Plano de execução

Como construir, em que ordem. O que construir está em `prd.md`. Marque ✅/🔄 conforme avança —
uma fase por sessão, escopo pequeno.

## Fase 0 — Fundação ✅

- ✅ Scaffold Next.js (App Router, TypeScript, Tailwind v4, ESLint)
- ✅ Design tokens portados verbatim (`src/styles/tokens/`), fontes via `next/font`
- ✅ Cliente Supabase (browser + server + proxy de sessão)
- ✅ Repositório no GitHub (`estallosolucoes/finbast`), primeiro commit
- ✅ `.env.local` com as credenciais do projeto Supabase certo
  (`ilgfcujtprcrugrnrsdh.supabase.co`)
- ⬜ Deploy vazio na Vercel (não feito — sem CLI logada na sessão; fazer via dashboard)

## Fase 1 — Base do design system com shadcn/ui ✅

Decisão de 13/10/2026: adotar **shadcn/ui** para novas telas, mantendo os tokens Finbast.
O protótipo é referência visual; não continuar portando todas as primitivas manualmente.
Adicionar componentes conforme os módulos precisarem, em `src/components/ui/`.

- ✅ `core`: FinbastIcons, Icon, Button — comparado lado a lado em `/design-system`
- ✅ Configuração shadcn/ui, ponte de tokens e `/styleguide` com temas claro/escuro
- ✅ Primitivas: Button, Card, Badge, Alert, RadioGroup, Input e Label
- ✅ Table e Textarea para os cadastros base
- ⬜ Componentes de dados, navegação e financeiros — sob demanda

## Fase 2 — Schema inicial de Auth + Empresas ✅

**Antes de aplicar:** confirmar a conexão e o estado real do projeto
`ilgfcujtprcrugrnrsdh.supabase.co`. Em 13/10/2026, `.mcp.json` e `.env.local` já apontam
para esse projeto; o aviso anterior sobre outro projeto estava desatualizado.

Aplicada e registrada em 13/10/2026: `20261013135519_auth_empresas.sql`.
`empresas`, `usuarios_empresas` e `convites_empresas` com RLS, grants, criação atômica e
convites de uso único. 33 verificações de banco passaram; advisors de segurança sem alertas.
As demais tabelas abaixo serão criadas junto do módulo correspondente.

Tabelas centrais (uma migration por módulo da Fase 3, não tudo de uma vez): `empresas`,
`usuarios_empresas`, `senhas_aprovacao`, `categorias`, `centros_custo`, `clientes`,
`fornecedores`, `produtos`, `contas_bancarias`, `lancamentos_pagar`, `lancamentos_receber`,
`lancamentos_importados` + `conciliacoes`, `cenarios_planejamento`, `plano_linhas`,
`contribuicoes_lideres`, `eventos_uso`, `interesses_demanda`. RLS por `empresa_id` desde a
criação de cada tabela.

## Fase 3 — Módulos, em fatias verticais (schema + Server Actions + UI, testável ponta a ponta)

1. ✅ Auth + Empresas (sub-contas) + Usuários/permissões — convites por link
2. ✅ Cadastros base (categorias/subcategorias, centros de custo, clientes, fornecedores)
3. ✅ Contas a Pagar — lançamentos, parcelas, recorrência, baixa/estorno e aprovação
4. ✅ Contas a Receber — clientes, parcelas, recorrência, recebimento/estorno e histórico
5. ✅ Contas bancárias + importação CSV/XLSX/OFX + conciliação integral de baixas existentes
6. ✅ Fluxo de caixa — realizado/previsto, bancos/sem conta, evolução diária/mensal
7. ✅ Dashboard — caixa, custos fixos, títulos, conciliação e atalhos por empresa/mês
8. ✅ Planejamento e Simulador (inclui link do líder de setor)
9. ✅ Custo e precificação de produto
10. ✅ DRE e Relatórios + exportação
11. 🔄 Medição de uso + botões de demanda — eventos de Pagar, Receber, bancos, Planejamento e Produtos registrados; cotas e demais módulos pendentes
12. ⬜ Perfil/Usuários (ajustes finos)
13. ⬜ Painel do Contador — só depois do núcleo (1–10); confirmar que entra no MVP antes de começar

## Checkpoint de 13/10/2026

- ✅ Build, TypeScript, lint, 27 testes unitários e cinco fluxos de navegador ponta a ponta.
- ✅ Login/logout, contas CPF/CNPJ, convite, troca de papel e isolamento verificados no navegador.
- ✅ Auditoria de dependências de produção sem vulnerabilidades.
- ⬜ Validar confirmação de cadastro e recuperação de senha com e-mail real; configurar Site URL,
  redirects e SMTP do ambiente (ver `docs/auth-empresas.md`).
- ⬜ Acompanhar nove alertas altos em dependências de desenvolvimento (shadcn/ESLint e transitivas).
- ✅ Migrations `20261013144244_cadastros_base.sql` e `20261013164700_categorias_concorrencia.sql`
  aplicadas e registradas no Supabase. As quatro tabelas têm RLS por papel/empresa.
- ✅ 285 verificações de cadastros, 33 da fundação e cinco de concorrência; advisors sem alertas.
- ✅ Criação, edição, busca, paginação, arquivamento/reativação, subcategorias, versão desatualizada,
  consulta por leitor e escrita por operador verificados no navegador. Fixtures removidas.
- ✅ Migration `20261013173410_contas_pagar.sql` aplicada e registrada; RLS, grants de consulta
  e mutações por RPC autorizada, com histórico e eventos de uso. Advisors sem alertas.
- ✅ 93 verificações de Contas a Pagar e 15 de concorrência.
  Pedido duplicado, baixa simultânea e geração de recorrências não duplicam registros.
- ✅ Contas a Pagar com shadcn/ui: parcelas em centavos, vencimentos mensais, recorrência,
  baixa com encargos/desconto, estorno, histórico, aprovação/OTP, filtros e paginação.
  Fluxo de navegador e largura móvel verificados; fixtures removidas.
- ⬜ Verificar template com `{{ .Token }}` e entrega real do OTP para troca da senha de
  aprovação. A confirmação por Auth real já foi testada com OTP gerado sem envio de e-mail.
- ✅ Migration `20261013182723_contas_receber.sql` aplicada e registrada; três tabelas de
  receitas com RLS, RPCs autorizadas e histórico detalhado de encargos/estornos.
- ✅ 111 verificações de receitas e 19 de concorrência; total de 561 verificações de banco.
  Advisors de segurança sem alertas. Contador completo registra recebimentos manuais sem
  movimentar dinheiro; aprovação por senha permanece exclusiva dos pagamentos.
- ✅ Interface shadcn/ui de Contas a Receber: cliente/categoria de receita, valores em centavos,
  parcelas, recorrência, recebimento, estorno, conflito de edição, histórico, filtros e paginação.
  Fluxo de navegador e largura móvel verificados; fixtures removidas.
- ✅ Formulários de Pagar e Receber carregam a ocorrência atual ao abrir e mantêm a versão
  capturada até confirmar, recusando alterações concorrentes no servidor e no banco.
- ✅ Roteiro `testes-e2e-completo.md` com 97 cenários cumulativos (implementados e futuros),
  inspirado no Nutrigg. Atualização em cada funcionalidade obrigatória no `CLAUDE.md`.
- ✅ Migration `20261013190759_contas_bancarias_conciliacao.sql` aplicada e registrada; cinco
  tabelas bancárias com RLS, RPCs autorizadas, deduplicação e proteção das baixas conciliadas.
- ✅ Banco: 92 verificações de regras/permissões e 18 de concorrência; total geral de 671.
  CSV/XLSX/OFX, prévia, saldo, reimportação, histórico, contador/leitor, rota POST de upload,
  origem inválida, conta alheia, paginação e largura móvel verificados no navegador.
- ✅ Conciliação/estorno serializados nas duas ordens. Nenhuma movimentação bancária real;
  vínculo integral de um movimento a uma baixa existente. Advisors sem alertas.
- ✅ Migration `20261013210457_fluxo_caixa.sql` aplicada e registrada; consulta somente leitura
  com RLS das origens, vínculo atual e centavos agregados no banco em um snapshot.
- ✅ Fluxo de caixa com período inclusivo de até 366 dias, diário/mensal, aberturas separadas,
  vencidos anteriores, realizado e projetado, origens paginadas e links para os históricos.
  Conciliação ativa usa só o extrato. Bancos arquivados mantêm seus valores.
- ✅ 58 verificações de fluxo; total geral de 729 verificações de banco e 27 unidades passaram.
  Agrupamento preserva a posição final do saldo; mais de 1.000 origens sem truncamento.
  Advisors sem alertas. Cinco specs de navegador aprovados, incluindo o fluxo de caixa;
  três na rodada completa e Auth/fluxo reexecutados após ajustes nos testes. Fixtures removidas.
- **Limite atual:** Pagar/Receber não têm conta bancária atribuída; previsões e baixas sem
  conciliação ficam em “Sem conta definida” e no consolidado. Filtro de banco consulta seu
  extrato/abertura. A consulta usa estado atual dos títulos, não snapshot histórico.
- **Próxima entrega:** Dashboard — indicadores e atalhos sobre as fontes financeiras validadas.

## Checkpoint de 14/10/2026 — Dashboard

- ✅ Migration `20261013221251_dashboard.sql` aplicada e registrada; RPC somente leitura,
  `SECURITY INVOKER`, mesma fonte do fluxo e RLS das origens. Advisors sem alertas.
- ✅ Caixa realizado/projetado, variação, títulos do mês, vencidos globais, conciliação
  pendente e saldos bancários com contas arquivadas. Atalhos mantêm o período aplicável.
- ✅ Custos fixos por flag da ocorrência, por categoria e projeção de abertos já gerados
  nos próximos três meses. Recorrência não define fixo nem gera previsão automaticamente.
- ✅ Gráfico diário com consulta por dia, centavos exatos e diferenciação de linha/cor.
- ✅ Build, TypeScript, lint, 30 unidades e 777 verificações de banco passaram (48 novas).
- ✅ Seis specs de navegador aprovados: Dashboard (29,9s) e cinco regressões anteriores
  (3,8min), em duas execuções. Leitor/revogação, empresa vazia, importação, filtros, gráfico
  e largura móvel verificados. Roteiro com 101 cenários atualizado (T080, T098–T101).
- **Próxima entrega:** Planejamento e Simulador — real + camada de plano, sem criar Pagar.

## Checkpoint de 14/10/2026 — Planejamento e Simulador

- ✅ Migrations `20261014111152_planejamento.sql` e `20261014115150_planejamento_execucao.sql`
  aplicadas e registradas. Seis tabelas novas com RLS, RPCs autorizadas e histórico.
  Advisors de segurança sem alertas; as 26 tabelas públicas têm RLS ativo.
- ✅ Cenários anuais, cópia independente, comparação, grade por setor/categoria e simulação
  acumulada em centavos. Custos fixos registrados não são somados novamente.
- ✅ Vínculo explícito com título real conserva estimativa/desvio e evita duplicar orçamento
  e caixa. Cópia no mesmo ano preserva vínculos; para outro ano começa com estimativas novas.
- ✅ Fechamento de mês passado congela grade/caixa/adicionais; reabertura exige motivo e
  preserva fotografia anterior. Nenhuma ação do módulo altera os títulos financeiros.
- ✅ Líder com link individual e OTP recente, sem associação à empresa ou acesso financeiro.
  Revisões têm espelhos imutáveis; importar é explícito e substitui a revisão anterior.
- ✅ Build, TypeScript, lint, 34 unidades e 949 verificações de banco passaram (146 novas
  de planejamento e 26 de concorrência). Os oito specs de navegador passaram no build final
  em 4,3 minutos: seis regressões anteriores, planejamento e OTP. Captura móvel em 390px
  conferida; fixtures revertidas/removidas. Roteiro atualizado para 107 cenários.
- ✅ Corrigido limite do campo OTP: o ambiente gera oito dígitos; tela/servidor aceitam 6–10
  sem alterar a configuração global do Auth nem a senha de aprovação de pagamentos.
- ⬜ Conferir SMTP/template `{{ .Token }}` e entrega real de e-mail. Testes geram códigos
  sem envio e confirmam via Auth real. Integração de valores/quantidades com produtos depende
  da próxima etapa; estimativas atuais são manuais. Documentação: `docs/planejamento.md`.
- **Próxima entrega:** Custo e precificação de produto (etapa 9).

## Checkpoint de 15/10/2026 — Custo e precificação de produto

- ✅ Migration `20261014134626_produtos_custeio.sql` aplicada e registrada. Oito tabelas com
  RLS/SELECT para membros e mutações por RPC autorizada; as 34 tabelas públicas têm RLS ativo.
  Advisors de segurança sem alertas. Aplicação usa apenas cliente autenticado, sem service role.
- ✅ Produtos com premissas de preço/volume, alvo de margem e equilíbrio em centavos/unidades.
  Custeio registrado por vencimento ou realizado por liquidação, com custos avulsos analíticos.
- ✅ Direto por ocorrência, regras nomeadas por categoria/fornecedor e aplicação automática
  em parcelas/recorrências geradas. Rateios somam 100% e distribuem resíduos sem perder centavos.
- ✅ Margem de contribuição separada dos gerais; quadro opcional de gerais por receita,
  preservando parcela sem produto/não alocada e mostrando o resultado separado da margem.
- ✅ Envio explícito da projeção de produto ao Planejamento, com até três partes identificadas.
  Reenvio e cópia não duplicam linhas; mês fechado ou execução vinculada bloqueiam substituição.
  Nenhuma operação do módulo altera/cria títulos, baixas ou movimentações de caixa.
- ✅ Versão por empresa, pedidos idempotentes, histórico e eventos de uso. Edição concorrente,
  troca atômica de pesos, arquivamento e fechamento/projeção nas duas ordens verificados.
- ✅ 38 testes unitários, build e TypeScript passaram. Cobertura de banco aprovada: 1.119
  verificações (949 anteriores + 148 regras de Produtos + 22 de concorrência). Regressão completa
  passou com 1.115 antes de acrescentar quatro verificações de recorrência; o módulo atualizado
  passou novamente. Jornada de Produtos passou isoladamente, incluindo leitura/revogação e 390px.
- ✅ Os nove specs de navegador passaram no build final em 5,2 minutos, com Produtos em
  31,8 segundos. Lint dos últimos ajustes passou. Fixtures revertidas/removidas; 390px conferidos.
- Documentação em `docs/produtos.md`; roteiro cumulativo com 114 cenários. Limite: custeio
  consulta estado atual, sem fechamento próprio. SMTP/entrega real de OTP segue pendente.
- **Próxima entrega:** DRE e Relatórios + exportação (etapa 10).

## Checkpoint de 19/10/2026 — DRE e Relatórios

- ✅ Migration `20261015123917_dre_relatorios.sql` confirmada como aplicada no Supabase.
- ✅ Build, TypeScript, lint (`src`, `tests`, `scripts`) e 43 testes unitários passaram.
- ✅ Banco: 135 verificações de relatórios e 16 de concorrência passaram; demais módulos
  reexecutados até Produtos sem falha. A regressão foi interrompida por ECONNRESET ao
  alternar para relatórios e este módulo foi rodado isoladamente.
- ✅ Spec `tests/e2e/relatorios.spec.ts` passou (1,6 min) em build local na porta 3100.
- ⚠️ Advisors: `public.rls_auto_enable()` (SECURITY DEFINER) executável por anon/authenticated,
  proteção contra senhas vazadas desativada (painel Auth). Não vieram desta entrega; revisar.
- **Próxima entrega:** etapa 11 (cotas de uso e demais módulos) e etapa 12.

## Decisões em aberto (não travar sessão por causa delas, mas não presumir resposta)

- Painel do Contador e Assistente de IA entram no MVP?
- O que conta como "um lançamento" pro limite mensal da fase 2 (uso importado? parcela conta
  como 1 ou N?)
- Prazo e critério de "pronto" do MVP
