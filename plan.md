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

## Fase 1 — Design system (sob demanda, conforme os módulos da Fase 3 precisarem)

Ordem de dependência: **core → forms → feedback → data → navigation → financial**. Portar
`Component.jsx` + `Component.d.ts` do protótipo (`finbast/components/`) para `.tsx` tipado,
mesma API de props.

- ✅ `core`: FinbastIcons, Icon, Button — comparado lado a lado em `/design-system`
- ⬜ `core`: Badge, IconButton, Tag
- ⬜ `forms`, `feedback`, `data`, `navigation`, `financial` — ainda não começados

## Fase 2 — Schema inicial no Supabase ⬜

**Antes de aplicar:** confirmar que o conector Supabase deste Claude Code está apontando para
`ilgfcujtprcrugrnrsdh.supabase.co` — hoje ele aponta pra outro projeto
(`cxulrqowdjuiaqanivas.supabase.co`), usado só pra testar conexão na Fase 0. Trocar em
claude.ai → configurações do conector Supabase antes de rodar qualquer migration daqui.

Tabelas centrais (uma migration por módulo da Fase 3, não tudo de uma vez): `empresas`,
`usuarios_empresas`, `senhas_aprovacao`, `categorias`, `centros_custo`, `clientes`,
`fornecedores`, `produtos`, `contas_bancarias`, `lancamentos_pagar`, `lancamentos_receber`,
`lancamentos_importados` + `conciliacoes`, `cenarios_planejamento`, `plano_linhas`,
`contribuicoes_lideres`, `eventos_uso`, `interesses_demanda`. RLS por `empresa_id` desde a
criação de cada tabela.

## Fase 3 — Módulos, em fatias verticais (schema + Server Actions + UI, testável ponta a ponta)

1. ⬜ Auth + Empresas (sub-contas) + Usuários/permissões
2. ⬜ Cadastros base (categorias, centros de custo, clientes, fornecedores)
3. ⬜ Contas a Pagar
4. ⬜ Contas a Receber
5. ⬜ Contas bancárias + importação CSV/XLSX/OFX + conciliação
6. ⬜ Fluxo de caixa
7. ⬜ Dashboard
8. ⬜ Planejamento e Simulador (inclui link do líder de setor)
9. ⬜ Custo e precificação de produto
10. ⬜ DRE e Relatórios + exportação
11. ⬜ Medição de uso + botões de demanda (transversal, entra junto de cada módulo acima)
12. ⬜ Perfil/Usuários (ajustes finos)
13. ⬜ Painel do Contador — só depois do núcleo (1–10); confirmar que entra no MVP antes de começar

## Decisões em aberto (não travar sessão por causa delas, mas não presumir resposta)

- Painel do Contador e Assistente de IA entram no MVP?
- O que conta como "um lançamento" pro limite mensal da fase 2 (uso importado? parcela conta
  como 1 ou N?)
- Prazo e critério de "pronto" do MVP
