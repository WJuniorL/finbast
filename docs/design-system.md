# Design system Finbast

Decisão de 13/10/2026: **shadcn/ui** é a base de componentes da aplicação.

## Identidade

- Marca: vermelho `#E8232A`, escala `--red-50` a `--red-900` já existente.
- Neutros: escala fria `--gray-50` a `--gray-900`; painéis escuros usam a escala `--ink-*`.
- Fontes: Manrope para interface e JetBrains Mono para exemplos técnicos; valores financeiros
  usam numerais tabulares. Fontes variáveis locais fornecidas por Fontsource, carregadas por
  `next/font/local` no layout raiz; build não depende de Google Fonts.
- Espaçamento: ritmo de 4 px, com tokens em `src/styles/tokens/spacing.css`.
- Raios: 8, 12, 16 e 20 px; botões podem usar formato pill.
- Sombras: suaves em cards, mais elevadas em overlays.
- Aparência: interface financeira limpa, superfícies neutras e vermelho nos pontos de ação.

## Implementação

`components.json` configura shadcn/ui, TypeScript, Server Components e aliases `@/`.
Primitivas ficam em `src/components/ui/`; `src/lib/utils.ts` fornece `cn`.
Os tokens originais permanecem em `src/styles/tokens/`; `src/app/globals.css` mapeia-os
para variáveis semânticas shadcn (`--background`, `--primary`, `--border`, etc.) e Tailwind v4.
O tema escuro troca os papéis semânticos, mantendo as escalas da marca.

Novas telas usam a API shadcn/ui. Não exigir compatibilidade com props do protótipo.
O Button legado e os ícones em `src/components/core/` ficam como referência até a migração
de seus consumidores. Adicionar componentes sob demanda, sem instalar toda a biblioteca.

## Guia visual

`/styleguide` reúne paletas, tipografia, espaçamento, raios, sombras e demonstrações dos
componentes. A navegação fica em `src/app/styleguide/navigation.ts`. A alternância de tema
é uma prévia local do guia. `/design-system` continua disponível como referência legada.

## Acessibilidade

Usar labels associados aos campos, mensagens anunciadas, foco visível e estados de envio.
O vermelho de marca fica preservado na paleta; ações com texto branco usam o vermelho 600
para melhorar contraste. Texto auxiliar usa gray 600 em superfícies claras.
Validar contraste ao adicionar combinações, especialmente gráficos e estados semânticos.
