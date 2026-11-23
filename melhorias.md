# Lista de melhorias — Finbast

Backlog vivo do que vale construir ou corrigir depois. `plan.md` diz o que está sendo
construído; aqui fica o que foi encontrado e não coube na tarefa. Cada item: id estável, o
problema (não a solução), origem, impacto e área. Datas sempre absolutas.

## Abertas

- [M-002] Cadastro, login e recuperação de senha não têm proteção contra robôs (captcha/Turnstile).
  O rate limit depende só dos limites padrão do Supabase Auth, não conferidos no painel.
  Bloqueio (23/11/2026): exige criar site no Cloudflare Turnstile (ou hCaptcha), ligar no painel
  do Supabase Auth e pôr a chave do site no `.env.local`; com as chaves, o código é pequeno
  (widget no `AuthForm` + `captchaToken` no `signIn`/`signUp`/`resetPassword`).
  Origem: checklist de 20 pontos do security-reviewer (23/11/2026) · Impacto: médio · Área: auth
- [M-004] Proteção de senha vazada do Supabase Auth desativada (advisor de 19/10/2026). É
  configuração do painel, não código — conferir antes da produção. Caminho: Supabase →
  Authentication → Sign In / Providers → Email → "Prevent use of leaked passwords" (só nos
  planos pagos do Supabase).
  Origem: histórico de execuções de 19/10/2026 · Impacto: médio · Área: auth/produção
- [M-007] O hook de Stop (`.claude/hooks/build.sh`) roda `npm run build` no mesmo `.next` de um
  `next start` em execução; o servidor de teste passa a responder 500 nos chunks e os specs de
  navegador falham sem relação com o código.
  Origem: regressão de 23/11/2026 · Impacto: baixo · Área: ferramentas
- [M-009] `scripts/db-test-produtos.mjs` cria série recorrente com vencimento fixo 10/01/2027;
  quando o mês corrente passar de janeiro/2027 o total gerado deixa de ser 12 e o teste quebra
  (mesma causa corrigida em pagar/receber em 23/11/2026).
  Origem: regressão de 23/11/2026 · Impacto: baixo · Área: testes

## Feitas

- [M-008] Telas autenticadas não verificadas sob a CSP. Feito em 23/11/2026: regressão completa
  (13 specs de navegador, 1.314 verificações de banco) passou com o Supabase reativado.
- [M-001] Sem Content-Security-Policy. Feito em 23/11/2026: CSP com nonce por requisição no
  `src/proxy.ts` (script-src com nonce + strict-dynamic; style-src mantém 'unsafe-inline' por
  causa dos atributos style do React) e layout raiz dinâmico (`connection()`).
- [M-003] Sem aviso de nova versão durante deploy. Feito em 23/11/2026: `/api/versao` sem
  cache + faixa "Nova versão disponível" (`src/components/nova-versao.tsx`), conferida a cada
  5 min e ao voltar à aba, sem recarregar sozinha.
- [M-005] Headers de segurança ausentes (HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy). Feito em 23/11/2026 (`next.config.ts`).
- [M-006] Rota inexistente ou erro fora de `/empresas` caíam nas telas padrão do Next, em inglês.
  Feito em 23/11/2026 (`src/app/not-found.tsx`, `src/app/error.tsx`).

## Descartadas ou adiadas

(nenhuma)
