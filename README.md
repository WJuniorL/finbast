# Finbast

Sistema financeiro que substitui um BPO financeiro: o empresário administra CPF e CNPJs num só
lugar; o contador gerencia a carteira de clientes de graça, como canal de aquisição.

Em construção — ver [`prd.md`](./prd.md) (o que) e [`plan.md`](./plan.md) (em que ordem, e o
que já está pronto).

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Supabase](https://supabase.com) (Postgres, Auth)
- Tailwind v4 + **shadcn/ui**, sobre os design tokens em `src/styles/tokens/`

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do projeto Supabase
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). `/design-system` mostra os componentes
legados. `/styleguide` é o guia do design system com shadcn/ui, tokens Finbast e temas claro/escuro.

## Interface

Novas telas usam componentes shadcn/ui em `src/components/ui/`. Cores, fontes, espaçamento e
raios seguem a identidade Finbast; o protótipo continua sendo referência visual. Consulte
[`docs/design-system.md`](./docs/design-system.md) para a configuração e as convenções.

## Autenticação e empresas

`/login` e `/cadastro` iniciam o acesso; `/empresas` permite criar e selecionar contas CPF/CNPJ.
O proprietário gerencia permissões e gera convites por link para e-mails confirmados.
Configuração de Auth, SMTP, callbacks e migrations em
[`docs/auth-empresas.md`](./docs/auth-empresas.md).

Dentro de uma conta, **Abrir cadastros** acessa categorias/subcategorias, centros de custo,
clientes e fornecedores, com busca, edição e arquivamento. Regras e permissões em
[`docs/cadastros.md`](./docs/cadastros.md).

**Abrir Contas a Pagar** acessa despesas únicas, parceladas e recorrentes, com baixa manual,
senha de aprovação e histórico de estornos. Regras e permissões em
[`docs/contas-pagar.md`](./docs/contas-pagar.md). Todas essas telas usam shadcn/ui.

**Abrir Contas a Receber** acessa receitas por cliente, parcelas, recorrências, recebimento
manual e histórico de estornos. Regras e permissões em
[`docs/contas-receber.md`](./docs/contas-receber.md).

**Abrir contas bancárias** permite cadastrar contas, gerar prévias de CSV/XLSX/OFX e conciliar
movimentos com baixas existentes, com deduplicação e histórico. Consulte
[`docs/contas-bancarias.md`](./docs/contas-bancarias.md).

**Abrir fluxo de caixa** compara realizados e previstos por período,
com agrupamento diário/mensal, bancos e origens sem conta definida. Regras em
[`docs/fluxo-caixa.md`](./docs/fluxo-caixa.md).

**Abrir Dashboard** reúne indicadores do mês, evolução do caixa, custos fixos, vencidos e
pendências de conciliação. Consulte [`docs/dashboard.md`](./docs/dashboard.md).

O roteiro cumulativo [`testes-e2e-completo.md`](./testes-e2e-completo.md) cobre funcionalidades
implementadas e futuras. Sua atualização em cada entrega é obrigatória no `CLAUDE.md`.

**Abrir Planejamento** permite cenários anuais, simulação de receita/despesa, comparação,
fechamento mensal e contribuições de líderes por link/OTP com importação explícita.
Regras e configuração de e-mail em [`docs/planejamento.md`](./docs/planejamento.md).

**Abrir produtos e custos** reúne custos diretos/compartilhados/gerais, margens por produto,
regras de rateio, custos avulsos e simulação de preço/volume com envio ao Planejamento.
Regras e limites em [`docs/produtos.md`](./docs/produtos.md).

**Abrir DRE e Relatórios** oferece DRE gerencial, filtros e origens por dimensão, encargos,
planejado × realizado e exportação integral CSV/XLSX. Bases e critérios em
[`docs/relatorios.md`](./docs/relatorios.md).

```bash
npm test
npm run test:db # usa SUPABASE_DB_URL; fixtures revertidas ou removidas ao final
npm run test:e2e # build servido em localhost:3100; Microsoft Edge instalado
```

Para os testes de navegador, execute `npm run build` e mantenha
`npm run start -- -p 3100` em outro terminal. Os testes criam usuários/empresas temporários,
usam Auth real e removem suas fixtures ao final; não enviam e-mails.

## Verificação antes de qualquer entrega

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Protótipo de referência

As telas e o design system têm origem num protótipo clicável (HTML estático, sem backend) em
`C:\Projetos Claude\finbast` — usado como maquete visual, não como código a copiar.
