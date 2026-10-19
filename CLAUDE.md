@AGENTS.md

# Finbast — instruções do projeto

Sistema financeiro que substitui um BPO financeiro: o empresário administra CPF e CNPJs
(sub-contas) num só lugar; o contador gerencia a carteira de clientes de graça, como canal de
aquisição. Não é ERP — sem CRM, estoque ou emissão de nota fiscal.

**Leia antes de codar:** `prd.md` (o que construir) e `plan.md` (em que ordem — e o que já está
feito). Este repo é o sistema real. O protótipo clicável (HTML estático, sem backend) vive em
`C:\Projetos Claude\finbast` e serve só de referência visual — não copie arquivo dele, use como
maquete.

## Stack

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth) + **shadcn/ui**. Tailwind v4 (CSS-first, `@theme`
em `globals.css`, sem `tailwind.config.ts`) por cima dos design tokens em `src/styles/tokens/`
— não redefina cor/espaçamento direto em Tailwind, aponte pro token.

**Esta versão do Next.js é mais nova que qualquer coisa que você tenha na memória.** Antes de
usar uma API ou convenção de arquivo que não tenha certeza, confira
`node_modules/next/dist/docs/` — o próprio framework fez esse aviso (ver `AGENTS.md`). Já
aconteceu de quebrar: `middleware.ts` virou `proxy.ts` nesta versão.

## Convenções

- **Dinheiro nunca em ponto flutuante.** Sempre `numeric`/`integer` (centavos) no Postgres,
  nunca `float`/`double`. Isso é erro grave, não estilo.
- **Multiempresa por `empresa_id` com RLS desde a criação da tabela** — nunca como retrofit.
  Cada sub-conta (CNPJ/CPF) é isolada; usuário só acessa o que está vinculado em
  `usuarios_empresas`.
- **Dois tipos de senha, não confundir:** a senha de login (Supabase Auth) e a "senha de
  aprovação" de 6 dígitos (criada pelo usuário, sem sequência/repetição, valida pagamentos) —
  tabela própria, hash, nunca no client.
- **Design system com shadcn/ui**, componentes em `src/components/ui/`, adicionados sob demanda.
  Novas telas usam a API do shadcn; componentes de negócio podem compor essas primitivas.
  Tokens Finbast permanecem em `src/styles/tokens/`; `globals.css` faz a ponte semântica.
  Não copiar componentes do protótipo. O port legado em `src/components/core/` serve de
  referência e será substituído gradualmente. Ver `docs/design-system.md` e `/styleguide`.
- **Server Components por padrão.** Só `"use client"` quando precisar de estado, evento de
  DOM ou hook — como o `Button` (tem `useState` para hover/press).

## Roteiro E2E obrigatório

`testes-e2e-completo.md` é o roteiro cumulativo de jornadas, inspirado no modelo do Nutrigg.
Leia-o junto de `prd.md` e `plan.md` antes de iniciar uma funcionalidade.
**Toda nova funcionalidade, correção de comportamento ou mudança de permissão exige atualizar
esse arquivo na mesma entrega.** Inclua ações, resultados esperados, casos negativos, isolamento,
concorrência e evidências; atualize também os cenários futuros que passaram a ser implementados.
Preserve IDs; acrescente novos casos sem renumerar os anteriores. Diferencie implementado,
planejado, decisão em aberto, teste automatizado e conferência manual. Não afirmar execução
manual ou integração externa que não ocorreu. Registre data, ambiente, comando/spec, resultados
e limitações da rodada no histórico. Não considerar a entrega pronta com roteiro desatualizado.
Nunca inclua credenciais, tokens, PIN real ou dados pessoais reais no roteiro. Ele deve permanecer
versionável; as restrições do Nutrigg para arquivos contendo segredos não se aplicam a este roteiro.

## Comandos de desenvolvimento e verificação

```
npm run dev      # servidor local, localhost:3000
npm run build    # build de produção — rodar antes de considerar algo pronto
npm run lint     # eslint
npx tsc --noEmit # typecheck isolado, mais rápido que build completo
```

## O que não fazer

- Não inventar preço, plano ou tela de cobrança — o MVP não tem cobrança nenhuma (ver `prd.md`).
- Não integrar Open Finance, BaaS, boleto/PIX ou gateway — tudo isso é fase 2, fora de escopo.
- Não mexer no protótipo (`C:\Projetos Claude\finbast`) a partir deste repo.
