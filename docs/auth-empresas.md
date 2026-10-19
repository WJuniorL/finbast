# Autenticação, empresas e permissões

## Fluxos

- `/login`, `/cadastro`, `/recuperar-senha` e `/atualizar-senha`: Supabase Auth com e-mail/senha.
- `/auth/callback`: troca o código PKCE por sessão. `/auth/confirm`: aceita token_hash dos
  templates de e-mail para confirmação e recuperação em outro navegador.
- `/empresas`: lista as contas vinculadas ao usuário e permite criar uma conta CPF/CNPJ.
- `/empresas/[id]`: verifica vínculo no servidor e apresenta os acessos da conta.
- Proprietário gera convite individual para um e-mail e compartilha o link manualmente.
  `/convites/[token]` exige sessão e o e-mail confirmado correspondente para aceitar.
  Convites expiram em 7 dias, podem ser revogados e só funcionam uma vez. O banco guarda
  apenas SHA-256 do token aleatório de 256 bits. Não há envio automático de convite nesta etapa.

## Permissões

| Papel | Acesso previsto para os módulos financeiros |
|---|---|
| Proprietário | Gerencia a conta, convites, permissões e operações financeiras |
| Administrador | Gerencia operações financeiras, sem transferir propriedade |
| Operador | Lança/edita dados; aprovação de pagamento depende da credencial específica |
| Somente leitura | Consulta |
| Contador completo | Lança/edita/concilia/fecha; nunca movimenta dinheiro |
| Contador leitura | Consulta; nunca movimenta dinheiro |

Nesta entrega, criação e seleção de conta, convites e alteração de papel estão implementados.
Somente o proprietário gerencia vínculos. Os módulos financeiros deverão consultar os papéis
ao implementar cada operação; a matriz acima não significa que esses módulos já existam.
Usuários comuns veem o próprio vínculo, enquanto o proprietário vê os vínculos da sua conta.

## Banco

Migration: `supabase/migrations/20261013135519_auth_empresas.sql`.
Tabelas: `empresas`, `usuarios_empresas`, `convites_empresas`; todas com RLS e grants explícitos.
`criar_empresa` é uma RPC invoker: cria conta e vínculo proprietário atomicamente com RLS.
Consultas de autorização e aceitação de convite usam funções definer no schema `private`,
com `search_path` vazio, checagem de `auth.uid()` e execução restrita. Não adicionar `private`
à lista de schemas expostos na Data API. A RPC pública de aceitação é invoker.

O cookie `finbast_empresa` só lembra a seleção; não autoriza acesso. Cada página e action
revalida usuário e vínculo. Chaves administrativas não são usadas pelos fluxos da aplicação.

## Configuração do ambiente

1. Definir `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
   `NEXT_PUBLIC_SITE_URL` (origem da aplicação, localhost no desenvolvimento, HTTPS em produção).
2. Em Supabase Auth, definir Site URL e permitir redirects para `/auth/callback` (incluindo
   seus parâmetros). Manter confirmação de e-mail habilitada e configurar SMTP para uso real.
3. Templates podem apontar para `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
   ou `type=recovery`. Para cadastro por convite, preservar o `next` de `.RedirectTo`;
   o fluxo PKCE padrão já usa a URL de callback enviada pela aplicação.
4. Validar limites de Auth e configurar CAPTCHA antes de abrir cadastro público.
5. Provisionar o banco por migrations antes de testar `/empresas`.

Scripts locais leem `SUPABASE_DB_URL` sem imprimir credenciais e verificam o projeto esperado.
`node scripts/db-check.mjs` inspeciona tabelas; `node scripts/db-migrate.mjs --dry-run` verifica
o push; `node scripts/db-migrate.mjs` aplica via CLI e registra o histórico remoto.

## Validação

`npm test` cobre CPF/CNPJ e redirecionamentos; `npm run test:db` testa isolamento, escalada
de privilégio, grants, convites e acesso anônimo em uma transação revertida. Precisa de Node
com suporte a strip-types e conexão Postgres configurada. Antes de deploy, validar também
cadastro/confirmação e recuperação com a caixa de e-mail do ambiente.

O teste de navegador está em `tests/e2e/app.spec.ts` e roda com `npm run test:e2e`.
Iniciar a aplicação na porta 3100 (ou definir `E2E_BASE_URL`); o runner usa Microsoft Edge.
Requer chave administrativa server-only para criar usuários temporários com e-mail confirmado
e conexão Postgres para remover as empresas desses usuários. Não envia e-mail; as fixtures
são removidas em `finally`. Capturas ficam em `test-results/`, ignorado pelo Git.

Checkpoint de 13/10/2026: lint, TypeScript, build, quatro testes unitários, 33 verificações
de banco e fluxo de navegador passaram. Advisors de segurança sem alertas; nenhuma
vulnerabilidade nas dependências de produção. Permanecem nove alertas altos nas ferramentas
de desenvolvimento e suas dependências; acompanhar atualizações compatíveis. As correções
automáticas sugeridas pelo npm incluem downgrades incompatíveis com a configuração atual.
