# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com). Datas em dd/mm/aaaa.

## [Não lançado] — 19/10/2026

### Adicionado
- Assistente de IA: base local de ajuda antes do modelo, consulta de dados, propostas de ação com confirmação e teto diário.
- Botões de demanda no Dashboard (interesse idempotente por usuário/recurso, sem painel de gestão).
- Eventos de uso dos cadastros (categorias, centros, clientes, fornecedores), sem cotas.

- Perfil da conta: e-mails dos acessos, renomear, remover acesso e sair da conta.

### Segurança
- Revogado o EXECUTE público de `rls_auto_enable()` (função do event trigger de RLS).

## [Não lançado] — 15/10/2026

### Adicionado
- DRE gerencial com classificação por categoria, herança de subcategorias e separação de encargos.
- Relatórios por categoria, centro, fornecedor/funcionário e produto; comparativo de cenário com fotografias.
- Exportação integral CSV/XLSX, bruto consolidado por origem e medição idempotente de formatados, sem cotas.
- RLS, histórico, testes de concorrência, arquivos e jornada de relatórios.
- Custo e precificação de produtos com regras de rateio por categoria/fornecedor e custos avulsos.
- Margem de contribuição por produto, gerais separados e rateio opcional por receita.
- Simulação de preço/volume, margem alvo e equilíbrio; envio explícito ao Planejamento sem duplicação.
- RLS, histórico, idempotência e testes de regras, concorrência e jornada de produtos.

## [Não lançado] — 14/10/2026

### Adicionado
- Planejamento anual com cenários nomeados, duplicação, simulação e comparação por mês.
- Linhas de receitas/despesas por setor/categoria, valor unitário × quantidade e custos fixos como base.
- Fotografia de fechamento mensal, desvio e reabertura por motivo com histórico preservado.
- Link individual de líder por e-mail/OTP, revisão e importação explícita com espelhos de versões.
- RLS/RPCs do planejamento, controle de versão e testes de concorrência e jornada de contribuição.
- Vínculo explícito entre estimativa e título real, preservando orçamento/desvio sem duplicar projeção.
- Confirmação do líder preserva o e-mail após erro e aceita o tamanho de OTP configurado no Auth.
- Dashboard por empresa e mês com caixa realizado/projetado, títulos e atalhos para origens.
- Custos fixos por categoria e projeção de ocorrências abertas nos próximos três meses.
- Gráfico diário consultável, saldos bancários, vencidos e pendências de conciliação.
- RPC de consulta com RLS e centavos exatos, testes e documentação do Dashboard.

## [Não lançado] — 13/10/2026

### Adicionado
- Fluxo de caixa diário/mensal com realizados, previsões, aberturas e vencidos anteriores.
- Filtros por período, banco e origens sem conta definida, com detalhes paginados e links.
- Consulta financeira com RLS e centavos exatos, sem duplicar baixas conciliadas no extrato.
- Testes de fluxo de caixa no banco, navegador e agrupamento monetário; documentação do módulo.
- Roteiro `testes-e2e-completo.md` com jornadas implementadas/futuras e atualização obrigatória no CLAUDE.md.
- Contas bancárias com saldo de abertura, arquivamento, extrato e modelos CSV/XLSX.
- Prévia e confirmação de CSV/XLSX/OFX, limites de arquivo e deduplicação por conta.
- Conciliação integral com baixas existentes, desfazer com motivo e histórico preservado.
- Migration bancária com RLS, RPCs autorizadas e proteção de baixas conciliadas contra estorno.
- Testes de parsers, permissões, saldo, importação/estorno concorrentes e navegador bancário.
- Contas a Receber por cliente/categoria de receita, com parcelas, recorrência e recebimento manual.
- Estorno com motivo e histórico que preserva valor original, encargos, desconto e valor recebido.
- Migration de receitas com RLS, RPCs autorizadas e proteção contra operações simultâneas.
- Testes de receitas, concorrência, permissões do contador e navegação com shadcn/ui.
- Contas a Pagar com lançamentos únicos, parcelas exatas em centavos e recorrência mensal.
- Baixa manual com encargos/desconto, estorno com motivo e histórico por ocorrência.
- Senha pessoal de aprovação com bcrypt, bloqueio de tentativas e troca por OTP de e-mail.
- Migration financeira com RLS, RPCs autorizadas, idempotência e registro de eventos de uso.
- Testes de regras financeiras, operações simultâneas e fluxo de navegador com shadcn/ui.
- Cadastros de categorias/subcategorias, centros de custo, clientes e fornecedores por empresa.
- Busca, filtros, paginação, arquivamento/reativação e proteção contra edição de versão antiga.
- Flag de custo fixo nas categorias de despesa; regras de hierarquia no servidor e no banco.
- Migration dos quatro cadastros com RLS por papel/empresa e grants por coluna.
- Proteção e teste de concorrência entre criação de subcategoria e arquivamento da principal.
- Table e Textarea do shadcn/ui; 285 verificações de banco dos cadastros e testes de seus fluxos.
- shadcn/ui com Radix, tokens Finbast e guia `/styleguide` com temas claro/escuro.
- Primitivas Button, Card, Badge, Alert, RadioGroup, Input e Label.
- Login, cadastro, logout, confirmação de e-mail e recuperação/atualização de senha.
- Criação e seleção de contas CPF/CNPJ, validação de documentos e gestão de papéis.
- Convites por link, vinculados ao e-mail confirmado, com validade de 7 dias e revogação.
- Migration de empresas, vínculos e convites com RLS e grants; scripts de migração e advisors.
- Testes de validação e de isolamento/permissões no banco, com fixtures revertidas.

### Alterado
- Formulários financeiros consultam a versão atual ao abrir uma operação, mantendo proteção contra concorrência.
- Helpers de centavos e datas mensais compartilhados entre Contas a Pagar e Receber.
- Novas telas usam shadcn/ui; componentes portados manualmente ficam como referência legada.
- Next.js e eslint-config-next atualizados de 16.3.7 para 16.3.8 por correções de segurança.
- Manrope e JetBrains Mono fornecidas localmente por Fontsource com `next/font/local`.
- Diagnóstico legado de conexão não presume mais que o banco esteja vazio.

## [0.1.0] — 30/09/2026

Primeira sessão de trabalho. Sai do protótipo estático e começa o sistema real.

### Adicionado
- Scaffold Next.js (App Router, TypeScript, Tailwind v4, ESLint)
- Design tokens portados do protótipo (`src/styles/tokens/`), fontes Manrope + JetBrains Mono
  via `next/font`
- Cliente Supabase (browser, server, proxy de sessão) conectado ao projeto do Finbast
- Primeiro componente do design system portado com tipos reais: `FinbastIcons` → `Icon` →
  `Button`, comparável em `/design-system`
- Estrutura de projeto do Claude Code: `CLAUDE.md`, `prd.md`, `plan.md`, hooks de validação e
  subagentes de revisão

### Notas
- Deploy na Vercel ainda não feito (sem CLI logada nesta sessão)
- Nenhuma tabela criada no Supabase ainda — schema é a próxima fase
