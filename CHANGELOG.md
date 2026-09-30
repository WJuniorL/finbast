# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com). Datas em dd/mm/aaaa.

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
