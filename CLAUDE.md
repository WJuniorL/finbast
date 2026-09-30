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

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth). Tailwind v4 (CSS-first, `@theme`
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
- **Design system portado sob demanda** (`src/components/core/…`), não tudo de uma vez. Ordem:
  core → forms → feedback → data → navigation → financial (mesma hierarquia do protótipo).
  Mantenha os mesmos nomes de prop já validados no protótipo (`variant`, `size`, `icon`…).
- **Server Components por padrão.** Só `"use client"` quando precisar de estado, evento de
  DOM ou hook — como o `Button` (tem `useState` para hover/press).

## Comandos

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
