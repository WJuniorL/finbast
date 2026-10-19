# Roteiro de testes E2E completo — Finbast

Jornada sequencial: comece em **T001**; reutilize conta, cadastros e lançamentos nas jornadas
seguintes. Não use contas ou documentos de clientes reais. Remoção de fixtures fica por último.

**Atualizado em 16/10/2026.** Fonte de escopo financeiro: `prd.md` e `plan.md`.
Este roteiro cobre o implementado e o planejado; não comprova execução manual por si só.

## Como registrar uma rodada

Cada teste tem **Implementação**, **Automação**, **Status**, **Última rodada** e **Resultado**.
Ao executar, registre data, ambiente, resultado, evidência e ID do bug, se houver. Preserve IDs;
adicione sufixos ou novos IDs ao fim, sem renumerar testes existentes. Ao mudar comportamento,
marque **🔁 refazer** e mantenha o registro da rodada anterior no histórico de execuções.

Legenda: 🤖 coberto por automação, conferência manual pendente · ⬜ manual pendente ·
🌐 depende de configuração/entrega real de e-mail · 📋 planejado, não implementado ·
🧭 decisão de produto em aberto · ✅ passou · ❌ falhou · ⚠️ passou com ressalva.

A automação indicada pode ser de navegador, banco ou unidade. Cobertura de banco/unidade
não equivale a execução E2E no navegador; não marcar uma jornada manual como concluída por isso.

## Preparação

- Local: `npm run dev`, normalmente http://localhost:3000.
- Automação: `npm run build`; em outro terminal, `npm run start -- -p 3100`; depois `npm run test:e2e`.
- Regressões: `npm test`, `npm run test:db`, `npm run lint`, `npx tsc --noEmit`.
- Supabase: projeto configurado em .env.local; chaves administrativas apenas nos scripts de fixtures.
- Proprietário em janela normal; convidado/leitor/contador em janela anônima; segunda aba para concorrência.
- Dados fictícios: Finbast Teste, CPF 529.982.247-25, CNPJ 11.222.333/0001-81,
  Cliente Teste, Fornecedor Teste, categoria Vendas (receita), Serviços (despesa), Centro Comercial.
- E-mails e senhas de teste devem ser fornecidos fora deste documento; nunca registrar credenciais,
  tokens, PIN real, URLs com senha ou dados pessoais reais aqui.
- Conferir cabeçalho/contexto da empresa antes de cada jornada. Datas financeiras usam America/Bahia.
- Só enviar e-mail real na rodada explícita de validação da entrega; a automação atual gera OTP sem envio.

## Checkpoint anterior à etapa bancária

Em 13/10/2026: build, TypeScript e lint passaram; **16 testes unitários**, **561 verificações de banco**
e **3 jornadas automatizadas de navegador** passaram. Fonte: testes/e2e/app.spec.ts,
pagar.spec.ts, receber.spec.ts e scripts db-test*.mjs. Fixtures revertidas/removidas.
Advisors de segurança sem alertas. Isso não substitui a rodada manual nem valida SMTP.
Contas bancárias/importação/conciliação ainda não implementadas neste checkpoint.

## Jornada — Entrada, design system e autenticação

### T001 — Guia visual e temas

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Abra /styleguide; alterne claro/escuro; confira em 390 px.

**Esperado:** Tokens Finbast e componentes shadcn/ui; sem rolagem horizontal da página.

### T002 — Referência visual legada

**Implementação:** Implementado · **Automação:** Sem cobertura completa

**Status:** ⬜ conferência manual pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Abra /design-system e compare com /styleguide.

**Esperado:** Página de referência disponível; novas telas seguem shadcn/ui.

### T003 — Rota protegida sem sessão

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Acesse /empresas e uma rota de conta sem login.

**Esperado:** Redireciona para /login; dados financeiros não aparecem.

### T004 — Login inválido

**Implementação:** Implementado · **Automação:** Sem cobertura completa

**Status:** ⬜ conferência manual pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Informe e-mail ou senha inválidos.

**Esperado:** Erro genérico, sem revelar se o e-mail existe.

### T005 — Login válido

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Entre com o proprietário de teste.

**Esperado:** Acesso ao seletor /empresas.

### T006 — Cadastro com confirmação

**Implementação:** Implementado; configuração/entrega real pendente · **Automação:** Sem cobertura completa

**Status:** 🌐 validação real pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Cadastre um novo e-mail de teste e confirme a mensagem recebida.

**Esperado:** Confirmação pelo Auth; conta acessível após autenticação.

### T007 — Recuperação de senha

**Implementação:** Implementado; configuração/entrega real pendente · **Automação:** Sem cobertura completa

**Status:** 🌐 validação real pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Solicite recuperação; abra o link; defina nova senha; repita com token expirado.

**Esperado:** Senha atualizada com sessão de recuperação válida; token inválido recusado.

### T008 — Retorno de autenticação

**Implementação:** Implementado · **Automação:** tests/validation.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente URLs externas nos parâmetros de redirecionamento.

**Esperado:** Somente destinos internos permitidos; sem redirect aberto.

### T009 — Logout

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Saia; tente acessar a conta novamente.

**Esperado:** Sessão encerrada e rota protegida redireciona para login.

### T010 — Callbacks de Auth

**Implementação:** Implementado; configuração/entrega real pendente · **Automação:** Sem cobertura completa

**Status:** 🌐 validação real pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Confirme signup, convite e recuperação usando os callbacks configurados.

**Esperado:** Fluxos PKCE/token_hash funcionam no ambiente configurado.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Contas CPF/CNPJ, convites e papéis

### T011 — Criar conta CNPJ

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie Finbast Teste com CNPJ 11.222.333/0001-81.

**Esperado:** Empresa e vínculo de proprietário criados atomicamente.

### T012 — Criar conta CPF

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie Conta Pessoal Teste com CPF 529.982.247-25.

**Esperado:** Nova conta independente das demais.

### T013 — Documento inválido

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente CPF/CNPJ repetido ou com dígitos verificadores inválidos.

**Esperado:** Formulário recusa o documento e mantém os dados.

### T014 — Trocar conta

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Volte ao seletor e abra outra conta.

**Esperado:** Contexto muda sem misturar cadastros ou lançamentos.

### T015 — Convite por link

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Convide outro e-mail confirmado para leitura e aceite em janela anônima.

**Esperado:** Vínculo criado com o papel escolhido e acesso à conta correta.

### T016 — Convite de outro e-mail

**Implementação:** Implementado · **Automação:** scripts/db-test.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Abra um convite com usuário diferente do destinatário.

**Esperado:** Aceite recusado, sem conceder acesso.

### T017 — Convite expirado/revogado/usado

**Implementação:** Implementado · **Automação:** scripts/db-test.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Revogue ou expire um convite; tente reutilizar um já aceito.

**Esperado:** Nenhuma nova concessão indevida.

### T018 — Mudar papel

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Como proprietário, altere leitura para operador.

**Esperado:** Novas permissões aparecem e ações passam a respeitá-las.

### T019 — Privilégios de proprietário

**Implementação:** Implementado · **Automação:** tests/validation.test.ts; scripts/db-test.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente atribuir proprietário ou gerenciar acessos sem ser dono.

**Esperado:** Servidor e banco recusam.

### T020 — Isolamento e revogação

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts; pagar.spec.ts; receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente abrir conta alheia; revogue escrita com formulário já aberto.

**Esperado:** 404 para conta alheia; mutações recusadas sem exigir novo login.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Cadastros base

### T021 — Categorias de despesa/receita

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts; scripts/db-test-cadastros.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie uma categoria de cada tipo.

**Esperado:** Classificação preservada por empresa.

### T022 — Subcategorias

**Implementação:** Implementado · **Automação:** scripts/db-test-cadastros.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie subcategoria e tente terceiro nível ou principal de outra empresa/tipo.

**Esperado:** Dois níveis; referências inválidas recusadas.

### T023 — Custo fixo

**Implementação:** Implementado · **Automação:** tests/cadastros.test.ts; scripts/db-test-cadastros.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Marque custo fixo em despesa e troque para receita.

**Esperado:** Flag exclusiva de despesa; não cria recorrência.

### T024 — Arquivar categoria principal

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Com subcategoria ativa, tente arquivar principal; depois arquive subcategoria antes.

**Esperado:** Recusa inicial com orientação; ordem correta funciona.

### T025 — Criar cliente e fornecedor

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts; tests/cadastros.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Cadastre contatos com nome e depois dados opcionais válidos.

**Esperado:** Cadastros separados, valores vazios normalizados.

### T026 — Criar centro de custo

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Cadastre e edite um centro de custo.

**Esperado:** Nome e descrição preservados por empresa.

### T027 — Validar contato

**Implementação:** Implementado · **Automação:** tests/cadastros.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente CPF/CNPJ, telefone, e-mail ou UF inválidos.

**Esperado:** Recusa entradas inválidas, sem gravar parcialmente.

### T028 — Unicidade

**Implementação:** Implementado · **Automação:** scripts/db-test-cadastros.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Repita nome/documento considerando caixa e espaços externos.

**Esperado:** Duplicações proibidas conforme regras do cadastro.

### T029 — Arquivar e reativar

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Arquive e reative cada tipo de cadastro.

**Esperado:** Filtros refletem situação; dados preservados.

### T030 — Buscar e paginar

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie mais de 50 registros; busque por nome; navegue nas páginas.

**Esperado:** Sem perda silenciosa ou mistura entre empresas.

### T031 — Edição concorrente

**Implementação:** Implementado · **Automação:** tests/e2e/app.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Abra registro em duas abas; salve versões diferentes.

**Esperado:** Versão antiga recusada.

### T032 — Papéis de cadastros

**Implementação:** Implementado · **Automação:** scripts/db-test-cadastros.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Repita operações com todos os papéis e sem vínculo.

**Esperado:** Quatro papéis escrevem; leitores só consultam; externo não vê registros.

### T033 — Corrida de arquivamento

**Implementação:** Implementado · **Automação:** scripts/db-test-concorrencia.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie/reative subcategoria enquanto outra conexão arquiva principal.

**Esperado:** Locks preservam regra de hierarquia nas duas ordens.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Contas a Pagar

### T034 — Despesa única

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie lançamento com fornecedor e categoria de despesa.

**Esperado:** Em aberto, vinculado somente à empresa atual.

### T035 — Valores em reais

**Implementação:** Implementado · **Automação:** tests/pagar.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Use 1.234,56; tente negativo, formato ambíguo e valor acima do limite.

**Esperado:** Centavos exatos; inválidos recusados.

### T036 — Parcelas exatas

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Divida R$ 100,00 em três parcelas.

**Esperado:** R$ 33,34 + R$ 33,33 + R$ 33,33.

### T037 — Vencimentos mensais

**Implementação:** Implementado · **Automação:** tests/pagar.test.ts; pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Use 31/01 e teste ano bissexto.

**Esperado:** 28/02 ou 29/02 e depois 31/03.

### T038 — Recorrência e expansão

**Implementação:** Implementado · **Automação:** scripts/db-test-pagar.mjs; scripts/db-test-pagar-concorrencia.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie mensal; atualize duas vezes.

**Esperado:** 12 iniciais; horizonte estendido sem duplicar.

### T039 — Interromper recorrência

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Interrompa série com ocorrências futuras, vencidas e pagas.

**Esperado:** Cancela futuras abertas e preserva histórico/ocorrências anteriores.

### T040 — Custo fixo por ocorrência

**Implementação:** Implementado · **Automação:** scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Herde categoria e sobrescreva a flag no lançamento.

**Esperado:** Snapshot independente de recorrência.

### T041 — Editar/cancelar

**Implementação:** Implementado · **Automação:** scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Edite ocorrência aberta; tente editar paga; cancele uma aberta.

**Esperado:** Edição individual; estados incompatíveis recusados.

### T042 — Configurar aprovação

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts; scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente PIN sequencial/repetido e configure 193750.

**Esperado:** Senha separada do login, somente hash privado.

### T043 — Erros e bloqueio do PIN

**Implementação:** Implementado · **Automação:** scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Erre cinco vezes e tente a senha correta durante bloqueio.

**Esperado:** Tentativas persistem; bloqueio de 15 minutos.

### T044 — Trocar PIN por OTP

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts; scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Solicite código; confirme e troque PIN; tente prova antiga/reutilizada.

**Esperado:** OTP assinado recente e de uso único; metadata do usuário não autoriza.

### T045 — Entrega real do OTP

**Implementação:** Implementado; configuração/entrega real pendente · **Automação:** Sem cobertura completa

**Status:** 🌐 validação real pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Solicite código com SMTP/template real contendo {{ .Token }}.

**Esperado:** Código chega e permite trocar senha; validar entrega separadamente do Auth.

### T046 — Baixa com encargos

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Registre pagamento externo com juros, multa e desconto.

**Esperado:** Valor líquido correto, data e autor preservados; nenhuma transferência.

### T047 — Baixa inválida/duplicada

**Implementação:** Implementado · **Automação:** scripts/db-test-pagar.mjs; scripts/db-test-pagar-concorrencia.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Use data futura, líquido não positivo ou duas baixas simultâneas.

**Esperado:** Recusa inválidos; somente uma baixa.

### T048 — Desfazer baixa e histórico

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Estorne com PIN/motivo; consulte histórico.

**Esperado:** Reabre lançamento e preserva baixa/estorno.

### T049 — Papéis e escrita direta

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts; scripts/db-test-pagar.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente baixar como contador completo e forjar status pela API.

**Esperado:** Só proprietário/admin/operador baixam; escrita direta financeira recusada.

### T050 — Filtros e paginação

**Implementação:** Implementado · **Automação:** tests/e2e/pagar.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Busque descrição e filtre situações, datas e custo fixo com mais de 50 itens.

**Esperado:** Listagem paginada; cartões mostram totais da conta inteira.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Contas a Receber

### T051 — Receita única

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie receita com cliente e categoria de receita.

**Esperado:** Em aberto; categorias de despesa não aparecem.

### T052 — Parcelas e datas

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Divida R$ 100,00 em três, começando em 31/01.

**Esperado:** Centavos e datas preservados como em Pagar.

### T053 — Recorrência

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie mensal, receba uma ocorrência e interrompa.

**Esperado:** Recebimento preservado e futuras abertas canceladas.

### T054 — Arquivos de referência

**Implementação:** Implementado · **Automação:** scripts/db-test-receber.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Arquive cliente/categoria; tente criar/expandir e editar referência existente.

**Esperado:** Novas ocorrências bloqueadas; histórico e referência mantida continuam disponíveis.

### T055 — Recebimento com encargos

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Receba R$ 100,00 com R$ 2,00 juros, R$ 3,00 multa e R$ 1,25 desconto.

**Esperado:** R$ 103,75, sem PIN de pagamento.

### T056 — Recebimento inválido

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts; tests/receber.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Use desconto maior que total, valor negativo ou data futura.

**Esperado:** Recusa e preserva campos do formulário.

### T057 — Estorno detalhado

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Desfaça com motivo e consulte histórico.

**Esperado:** Preserva original, encargos, desconto, líquido, data e autor.

### T058 — Editar/cancelar/conflito

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Edite em duas abas; cancele uma ocorrência aberta.

**Esperado:** Versão antiga recusada; cancelamento preserva histórico.

### T059 — Contador completo

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Registre e desfaça recebimento com contador completo.

**Esperado:** Registro contábil permitido; sem movimentação real de dinheiro.

### T060 — Revogação e leitura

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Revogue acesso com formulário aberto; recarregue como leitor.

**Esperado:** Servidor recusa escrita e UI permite somente consulta.

### T061 — Operações rápidas sucessivas

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Receba e abra imediatamente outra operação.

**Esperado:** Formulário captura versão atual; confirmação ainda recusa mudanças concorrentes.

### T062 — Duplicidade e concorrência

**Implementação:** Implementado · **Automação:** scripts/db-test-receber-concorrencia.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Reenvie pedido; receba/expanda simultaneamente; arquive cliente durante criação.

**Esperado:** Sem duplicação; referências serializadas.

### T063 — Totais, filtros e paginação

**Implementação:** Implementado · **Automação:** tests/e2e/receber.spec.ts; scripts/db-test-receber.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Filtre recebidos/datas/descrição e navegue com mais de 50 registros.

**Esperado:** Totais da conta inteira; previsto do mês inclui só abertos do mês.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Contas bancárias, importação e conciliação

### T064 — Cadastro bancário

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Crie conta com instituição, identificação e saldo inicial/data.

**Esperado:** Conta isolada por empresa; saldo em centavos.

### T065 — Editar e arquivar conta

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Edite uma conta com versão antiga; tente alterar saldo/identificação após prévia; arquive e reative conta com extratos.

**Esperado:** Versão antiga recusada (banco); só nome muda após prévia; histórico preservado; novos imports impedidos em arquivada.

### T066 — Modelo de planilha

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Baixe modelo CSV/XLSX e preencha com entradas/saídas fictícias.

**Esperado:** Colunas e formatos documentados; modelo abre corretamente.

### T067 — Prévia CSV

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Envie CSV com delimitador brasileiro, acentos, entrada e saída.

**Esperado:** Prévia correta antes de persistir movimentos; linhas normalizadas ficam no lote de prévia e o saldo permanece intacto.

### T068 — Prévia XLSX

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Envie planilha com datas Excel e valores numéricos.

**Esperado:** Conversão exata e validação por linha.

### T069 — Prévia OFX

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Envie OFX XML e SGML com FITID e sinais de débito/crédito.

**Esperado:** OFX XML/SGML de uma conta em BRL; data, descrição, valor e FITID interpretados; conta/banco incompatível e entidades recusados.

### T070 — Arquivo inválido

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; tests/bank-import.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente arquivo grande, formato errado, linha inválida ou conta OFX diferente.

**Esperado:** Erro claro, sem importação parcial ou mistura de contas.

### T071 — Confirmação e deduplicação

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Confirme prévia e reimporte o mesmo arquivo/extrato sobreposto.

**Esperado:** Movimentos identificados não duplicados; relatório de importados/ignorados. Sem identificador há aviso de sobreposição ambígua; conferir manualmente.

### T072 — Movimentos e saldo

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Consulte extrato por período e saldo após importação.

**Esperado:** Saldo inicial mais movimentos importados, sem contar conciliados duas vezes.

### T073 — Conciliar pagamento existente

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Vincule saída a lançamento pago de valor compatível.

**Esperado:** Vínculo por empresa/conta; não cria pagamento bancário nem repete baixa.

### T074 — Conciliar recebimento existente

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Vincule entrada a receita recebida.

**Esperado:** Vínculo compatível e histórico preservado.

### T075 — Incompatibilidade

**Implementação:** Implementado · **Automação:** scripts/db-test-bancos.mjs; tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente cruzar empresas, sinal, valor ou vincular duas vezes.

**Esperado:** Banco recusa vínculos inválidos.

### T076 — Desfazer conciliação

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Tente estornar baixa conciliada; desvincule com motivo; consulte o histórico e então estorne a baixa.

**Esperado:** Estorno bloqueado enquanto conciliado. Desvincular volta movimento a pendente sem apagar a baixa; histórico preservado e estorno posterior permitido.

### T077 — Conciliação concorrente

**Implementação:** Implementado · **Automação:** scripts/db-test-bancos-concorrencia.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Duas sessões tentam vincular o mesmo movimento/lançamento.

**Esperado:** Somente um vínculo ativo; sem corrupção de saldo.

### T078 — Papéis bancários

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts; scripts/db-test-bancos.mjs

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 (automação) · **Resultado:** ✅ automação indicada; manual não executado

**Ações:** Repita importação/conciliação como contador completo, leitor e externo.

**Esperado:** Contador registra/concilia sem movimentar dinheiro; leitores só consultam.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.

## Jornada — Fluxo de caixa e próximos módulos

### T079 — Fluxo de caixa

**Implementação:** Implementado · **Automação:** Navegador, banco e unidade

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Abra a empresa → Abrir fluxo de caixa. Registre abertura de R$ 1.000,00 em um
banco e −R$ 50,00 em outro; recebimento anterior de R$ 4,00; recebimento sem conciliação
de R$ 30,00; extrato de −R$ 105,00 e +R$ 200,00 conciliados com baixas. Filtre 29/01–02/02.
Crie previsão de −R$ 25,00 e +R$ 80,00 no período e vencidos anteriores de −R$ 7,00/+R$ 9,00.

**Esperado:** Inicial realizado R$ 954,00; final realizado R$ 1.079,00; projetado R$ 1.136,00.
Baixas conciliadas não reaparecem na data da baixa (30/01); extrato conta em 31/01. Filtro
do banco principal: R$ 1.095,00 e nenhuma previsão atribuída. Sem conta definida:
realizado R$ 34,00, projetado R$ 91,00. Links levam ao histórico do título ou do movimento.
Cancelados não participam. Recorrências ainda não geradas não são inventadas.

**Evidência:** `tests/e2e/fluxo-caixa.spec.ts`, `scripts/db-test-fluxo.mjs`,
`tests/fluxo-caixa.test.ts`. Regras e limites em `docs/fluxo-caixa.md`; consulta do estado atual,
sem reconstrução histórica ou distribuição automática de previsões por banco.

### T080 — Dashboard

**Implementação:** Implementado · **Automação:** Banco, unidade e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 14/10/2026 · **Resultado:** passou na automação; ver checkpoint da entrega

**Ações:** Abra Abrir Dashboard na empresa. Selecione janeiro/2026 usando as fixtures de
fluxo: aberturas de R$ 1.000,00/−R$ 50,00; recebido anterior R$ 4,00; recebido não conciliado
R$ 30,00; extrato conciliado −R$ 105,00/+R$ 200,00; abertos a pagar R$ 32,00 e receber R$ 9,00.
Consulte os indicadores, o gráfico por dia, custos fixos e os links para módulos/origens.

**Esperado:** Realizado final R$ 1.079,00; projetado R$ 1.056,00; variação de caixa R$ 129,00.
Custos fixos marcados nas ocorrências: R$ 125,00 (originais, por vencimento). Extrato confirmado
entra uma vez; aberturas não viram receita. Caixa segue as mesmas regras do módulo de fluxo.
Vencidos usam hoje em America/Bahia e todos os períodos, independente do mês de referência.

**Evidência:** `scripts/db-test-dashboard.mjs`, `tests/dashboard.test.ts`,
`tests/e2e/dashboard.spec.ts`. Definições/limites em `docs/dashboard.md`.

### T081 — Planejamento e cenários

**Implementação:** Implementado · **Automação:** Banco, unidade e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Abra Planejamento, crie cenário anual e adicione despesa de R$ 1,01 × 3 e receita
de R$ 5,00 × 2 em janeiro. Duplique, altere o original, compare e arquive/reative a cópia.

**Esperado:** Adicionais de R$ 3,03/R$ 10,00, sem arredondar centavos. Cópias independentes.
Nome/ano/pedidos válidos; custos fixos registrados já entram em R, sem repetição. Quantidades
e valores podem ser manuais ou enviados explicitamente pelo produto (T112). Nenhuma
operação cria/baixa/estorna/cancela Pagar/Receber; contagem dos títulos reais permanece igual.

**Evidência:** `tests/e2e/planejamento.spec.ts`, `scripts/db-test-planejamento.mjs`,
`tests/planejamento.test.ts`. Regras em `docs/planejamento.md`.

### T082 — Contribuição de líder

**Implementação:** Implementado · **Automação:** Banco e navegador; e-mail real pendente

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Crie link individual por e-mail/setor/prazo (1–7 dias). Abra em outro contexto,
informe e-mail diferente e código incorreto, confirme OTP correto e envie estimativa. Reabra
e edite; tente acessar contas e informações de outros setores; revogue e recarregue.
Confirme também que uma tentativa inválida preserva o e-mail e que o código completo chega
ao formulário enviado, inclusive com oito dígitos na configuração atual do Auth.

**Esperado:** Só o destinatário com OTP recente vê o formulário do próprio setor. Não recebe
acesso às contas ou vínculo em usuarios_empresas. Código/e-mail incorreto, sessão por senha,
OTP antigo, link revogado/expirado e cenário arquivado não autorizam envio. Nenhum valor é
importado automaticamente. O código automatizado é gerado pelo Admin sem enviar e-mail;
entrega real depende de SMTP/template `{{ .Token }}` e precisa de conferência específica.

**Evidência:** `tests/e2e/planejamento.spec.ts`, `scripts/db-test-planejamento.mjs`,
`scripts/db-test-planejamento-concorrencia.mjs`, `tests/e2e/planejamento-otp.spec.ts`.
Não registrar links, códigos ou tokens reais. O formulário aceita códigos de 6–10 dígitos,
conforme a configuração do Auth; a senha de aprovação de pagamentos permanece com seis.

### T083 — Simulador

**Implementação:** Implementado · **Automação:** Unidade e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Ligue/desligue o plano na grade e compare cenários. Na fixture de janeiro/2026,
o caixa base é R$ 1.056,00; adicione R$ 10,00 de receita e R$ 3,03 de despesa.

**Esperado:** Com plano, janeiro fica R$ 1.062,97; desligado volta a R$ 1.056,00. Efeito do
plano é acumulado nos meses seguintes, com BigInt. Comparação não destrói o outro cenário.
Leitor pode simular localmente e não pode persistir alterações. Valores da grade por vencimento
são distintos do caixa por movimento/liquidação; labels e legendas deixam isso explícito.

**Evidência:** `tests/planejamento.test.ts`, `tests/e2e/planejamento.spec.ts`.

### T084 — Produto e custos

**Implementação:** Implementado · **Automação:** Unidade, banco, concorrência e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Abra Produtos e custos, cadastre Mentoria/Curso, salve regra 40/60% por categoria,
classifique uma despesa direta, outra geral e vincule uma receita à Mentoria. Adicione custo
avulso de R$ 3,03; consulte registrado/realizado e ligue/desligue gerais por receita.

**Esperado:** Margem = receita − direto − compartilhado. Geral só afeta o resultado separado
quando solicitado. Na fixture de janeiro, Mentoria tem margem R$ 94,17 nas duas consultas
com/sem rateio geral; com rateio, gerais R$ 20,58 e resultado R$ 73,59. Base realizada inclui
R$ 105,00 pagos com encargos/desconto e R$ 3,03 avulsos. Arquivar preserva associações.

**Evidência:** `tests/e2e/produtos.spec.ts`, `scripts/db-test-produtos.mjs`,
`scripts/db-test-produtos-concorrencia.mjs`, `tests/produtos.test.ts`; regras em `docs/produtos.md`.

### T085 — DRE e relatórios

**Implementação:** Implementado (DRE gerencial por categoria, herança, bases por vencimento/liquidação, encargos separados e relatórios por categoria/centro/fornecedor/produto) · **Automação:** Unidade, banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 19/10/2026 · **Resultado:** passou; conferência manual pendente

**Ações:** Compare receita/despesa e consolidações por período.

**Esperado:** Classificações e totais consistentes com os módulos de origem.

**Evidência:** `tests/relatorios.test.ts`, `tests/e2e/relatorios.spec.ts`, `scripts/db-test-relatorios.mjs`, `scripts/db-test-relatorios-concorrencia.mjs`; regras em `docs/relatorios.md`.

### T086 — Exportação CSV/XLSX

**Implementação:** Implementado (exportação CSV/XLSX integral, bruto consolidado e medição idempotente) · **Automação:** Unidade, banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 19/10/2026 · **Resultado:** passou; conferência manual pendente

**Ações:** Exporte relatório com filtros e caracteres especiais.

**Esperado:** Valores exatos, conteúdo legível e proteção contra fórmulas injetadas.

**Evidência:** mesmos arquivos de T085; rota `/empresas/[id]/relatorios/exportar`.

### T087 — Uso e demanda

**Implementação:** Implementado (sem cotas, por decisão do PRD) · **Automação:** Banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 19/10/2026 · **Resultado:** passou; conferência manual pendente

**Ações:** No Dashboard, clique em "Quero: Assistente de IA"; repita pela API/RPC. Crie e edite um cliente (e as demais tabelas de cadastro). Consulte eventos atuais.

**Esperado:** Um interesse por usuário/empresa/recurso, idempotente, com um único evento `demanda`. Leitor e contador leitura podem registrar e veem só o próprio interesse; sem vínculo, empresa alheia, recurso fora da lista, insert direto e anônimo são recusados. Cadastros geram evento `cadastros:<tabela>` (criar/editar). Sem painel de gestão e sem cotas ou cobrança. Eventos de Fluxo, Dashboard (leitura) e Relatórios (bruto) não são registrados por decisão: só ações.

**Evidência:** `scripts/db-test-demanda.mjs` (13 verificações), `tests/e2e/dashboard.spec.ts`, migration `20261019200000_demanda_uso_cadastros.sql`.

### T088 — Perfil e usuários

**Implementação:** Implementado (renomear conta, e-mails dos acessos, remover acesso, sair da conta) · **Automação:** Banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 19/10/2026 · **Resultado:** passou; conferência manual pendente

**Ações:** Como proprietário, veja o e-mail de cada acesso, renomeie a conta e remova um acesso. Como membro não proprietário, use "Sair desta conta". Tente as mesmas operações sem permissão.

**Esperado:** Só o proprietário lista e-mails (RPC `listar_acessos`), renomeia e remove; proprietário nunca é removido nem sai; membro sai apenas de si mesmo e perde o acesso (404 depois); sem vínculo/anônimo não altera nada. Documento e tipo permanecem imutáveis. Troca de e-mail/senha de login segue pelo fluxo de recuperação de senha; a senha de aprovação não faz parte desta etapa. Painel do Contador/IA segue em decisão em aberto.

**Evidência:** `scripts/db-test-perfil.mjs` (16 verificações), `tests/e2e/app.spec.ts`, migration `20261019210000_perfil_usuarios.sql`.

### T089 — Painel do contador/IA

**Implementação:** Não implementado · **Automação:** Sem cobertura completa

**Status:** 🧭 Painel do Contador: **fora do MVP** (decisão de 19/10/2026). Assistente de IA: decisão pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Não há painel a testar. Contadores usam as telas normais como membros (Completo/Leitura, T088 e convites). O interesse no painel é medido pelo botão de demanda do Dashboard (T087).

**Esperado:** Ausência do painel não é bug. Reabrir este cenário se a decisão mudar; a IA segue em aberto.

### T090 — Deploy e e-mails reais

**Implementação:** Implementado; configuração/entrega real pendente · **Automação:** Sem cobertura completa

**Status:** 🌐 validação real pendente · **Última rodada:** — · **Resultado:** —

**Ações:** Configure URL, redirects, SMTP e publique ambiente de teste.

**Esperado:** Confirmar Auth, OTP e isolamento no ambiente publicado.

**Checkpoint:** conferir registros desta jornada e isolamento antes de prosseguir.


## Casos acrescentados na entrega bancária

### T091 — Rota de upload: origem e leitura

**Implementação:** Implementado · **Automação:** tests/e2e/bancos.spec.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** ✅ automação; manual não executado

**Ações:** após revogar escrita, tente POST direto de arquivo; como proprietário, envie POST com origem estrangeira.

**Esperado:** HTTP 403 em ambos; nenhuma prévia/movimento indevido. Upload usa rota POST autenticada com corpo limitado a 6 MB e arquivo de até 5 MB.

### T092 — Arquivo XLSX com tamanho adulterado

**Implementação:** Implementado · **Automação:** tests/bank-import.test.ts

**Status:** 🤖 automatizado; conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** ✅ unidade; navegador/manual não executados para este arquivo malicioso

**Ações:** altere o tamanho declarado no diretório ZIP de uma planilha válida, mantendo o conteúdo descompactado maior.

**Esperado:** validação recusa tamanho inconsistente antes de carregar workbook; limites de descompactação efetivos.


### T093 — Aberturas e vencidos anteriores no fluxo de caixa

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Consulte um intervalo começando antes da primeira abertura, depois um intervalo
posterior. Use abertura positiva e negativa, vencidos abertos a pagar e receber, e banco arquivado.

**Esperado:** Abertura entra na sua data, separada de receitas/despesas; antes do período
integra o saldo inicial. Vencidos anteriores ajustam somente o projetado e ficam no detalhe.
Banco arquivado preserva saldo e consulta. Sem movimento, tabela informa estado vazio.

**Evidência:** `scripts/db-test-fluxo.mjs`, `tests/e2e/fluxo-caixa.spec.ts`.

### T094 — Limites e isolamento dos filtros de fluxo

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Inverta início/fim; consulte mais de 366 dias ou datas fora de 2000–2100. Use
conta de outra empresa, empresa sem vínculo, chamada anônima e combinação banco + sem conta.

**Esperado:** Filtros inválidos não mostram totais; banco/empresa alheios retornam 404 na
UI e consulta indisponível na RPC. Anônimo não executa RPC. Combinação inválida é recusada
no banco, sem revelar valores de outra empresa.

**Evidência:** `scripts/db-test-fluxo.mjs`, `tests/e2e/fluxo-caixa.spec.ts`.

### T095 — Conciliação e estorno refletidos no fluxo

**Implementação:** Implementado · **Automação:** Banco; navegador para valores conciliados

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Baixe com encargos/desconto; concilie com extrato de mesma quantia em outra data.
Consulte o período, desfaça o vínculo e depois estorne a baixa em Pagar. Repita a conferência.

**Esperado:** Conciliação ativa mantém uma origem pelo extrato. Sem vínculo, baixa volta à
data da liquidação no grupo sem conta; extrato permanece. Estorno elimina a origem da baixa
e devolve o título aberto à previsão pelo valor original, sem apagar o extrato. Sem vínculo,
a consulta não presume que dois registros correspondem ao mesmo fato.

**Evidência:** `scripts/db-test-fluxo.mjs`, `tests/e2e/fluxo-caixa.spec.ts`.

### T096 — Agrupamento, precisão e paginação do fluxo

**Implementação:** Implementado · **Automação:** Unidade, banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Consulte dias e meses, cruze janeiro/fevereiro, crie mais de 50 origens e navegue
as páginas. No teste de banco, agregue mais de 1.000 origens; em unidade, ultrapasse a precisão
de Number. Abra a tela em 390px de largura.

**Esperado:** Mensal soma movimentos e preserva posição final do saldo. Paginar não altera
cards/evolução; origens não se repetem entre páginas. Totais não são truncados a 1.000 registros,
e centavos não arredondam. Tabelas rolam dentro do componente sem alargar a página.

**Evidência:** `tests/fluxo-caixa.test.ts`, `scripts/db-test-fluxo.mjs`,
`tests/e2e/fluxo-caixa.spec.ts`; screenshot automatizado em `test-results/fluxo-caixa-mobile.png`.

### T097 — Leitura e revogação de acesso ao fluxo

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 13/10/2026 · **Resultado:** passou na automação; ver checkpoint desta entrega

**Ações:** Consulte como proprietário, administrador, operador, contador completo, leitor
e contador leitor. Remova o vínculo do leitor com a página já aberta e recarregue.

**Esperado:** Todos os membros consultam os mesmos dados da empresa; a tela não oferece
mutação. Vínculo removido não conserva acesso via URL/sessão anterior; retorna 404.

**Evidência:** `scripts/db-test-fluxo.mjs`, `tests/e2e/fluxo-caixa.spec.ts`.

### T098 — Indicadores e atalhos do Dashboard

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 14/10/2026 · **Resultado:** passou na automação; ver checkpoint da entrega

**Ações:** Troque janeiro/fevereiro, consulte um título, fluxo e banco pelos links. Importe e
confirme tarifa de −R$ 1,00 em janeiro; retorne ao Dashboard. Desfaça conciliação no teste de banco.

**Esperado:** Mês e totais atualizados; tarifa reduz realizado e aparece como pendência.
Vínculo desfeito mantém o movimento e devolve a baixa ao grupo sem conta. Prévia não participa
do saldo. Links de mês mantêm o período; links de vencidos usam filtro global. Listas curtas
não truncam os totais, inclusive com mais de 1.000 movimentos no teste de banco.

**Evidência:** `scripts/db-test-dashboard.mjs`, `tests/e2e/dashboard.spec.ts`.

### T099 — Custos fixos e projeção no Dashboard

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 14/10/2026 · **Resultado:** passou na automação; ver checkpoint da entrega

**Ações:** Marque pago de R$ 100,00 original (R$ 105,00 liquidado) e aberto de R$ 25,00 como
fixos. Crie fixos abertos de R$ 12,00/23,00/34,00 nos três meses seguintes e outros variáveis,
fixos já pagos e cancelados. Abra o filtro de fixos em Pagar pelo card.

**Esperado:** Mensal fixo R$ 125,00, incluindo aberto/pago pelo vencimento e valor original.
Projeção inclui apenas fixos abertos já gerados, sem variáveis, pagos ou cancelados. Não usa
recorrência como classificação ou replica valores automaticamente. Categorias são ordenadas
por valor; todas participam do total mesmo quando a lista mostra somente dez.

**Evidência:** `scripts/db-test-dashboard.mjs`, `tests/e2e/dashboard.spec.ts`.

### T100 — Gráfico, zeros e largura móvel do Dashboard

**Implementação:** Implementado · **Automação:** Unidade e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 14/10/2026 · **Resultado:** passou na automação; ver checkpoint da entrega

**Ações:** Escolha 31/01/2026 no campo de dia; troque o mês; abra empresa sem dados. Em unidade,
use saldos negativos e acima da precisão de Number. Abra a tela em 390px.

**Esperado:** Valores diários exatos e posição do gráfico correspondente; novo mês começa no
primeiro dia. Gráfico diferencia linha contínua/tracejada e possui descrição/campo acessível.
Empresa vazia mostra zeros e mensagens de ausência. Coordenadas são limitadas; valores
monetários permanecem inteiros exatos. Nenhuma rolagem horizontal no documento.

**Evidência:** `tests/dashboard.test.ts`, `tests/e2e/dashboard.spec.ts`;
`test-results/dashboard-mobile.png`, `test-results/dashboard.png` (capturas temporárias
geradas ao executar o spec; o Playwright limpa a saída entre rodadas).

### T101 — Permissões, isolamento e mês inválido do Dashboard

**Implementação:** Implementado · **Automação:** Banco, unidade e navegador

**Status:** 🤖 coberto por automação, conferência manual pendente · **Última rodada:** 14/10/2026 · **Resultado:** passou na automação; ver checkpoint da entrega

**Ações:** Consulte nos seis papéis, use empresa sem vínculo e anônimo, revogue um vínculo.
Na URL, informe mês 13, mês duplicado ou fora de 2000–2100; na RPC, informe dia diferente de 1.

**Esperado:** Todos os membros consultam; não há mutação no Dashboard. Empresa alheia/vínculo
removido retornam 404; RPC retorna indisponível e anônimo não executa. Mês inválido exibe
mensagem sem totais. RPC recusa datas inválidas; calendário respeita fevereiro bissexto.

**Evidência:** `scripts/db-test-dashboard.mjs`, `tests/dashboard.test.ts`,
`tests/e2e/dashboard.spec.ts`.

### T102 — Versão, cópia e operações simultâneas do cenário

**Implementação:** Implementado · **Automação:** Banco e concorrência

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Abra edição, altere o cenário em outra aba e tente salvar a versão anterior.
Crie e duplique com o mesmo pedido simultaneamente em duas conexões; edite com mesma versão.

**Esperado:** Versão antiga é recusada. Pedido duplicado retorna o mesmo cenário; duas edições
com a mesma versão têm apenas uma vencedora. Copiar preserva as linhas, sem levar convites,
fechamentos ou o vínculo de importação. No mesmo ano preserva vínculo de execução real;
para outro ano as linhas voltam a estimativas novas. Outros cenários e títulos reais permanecem intactos.

**Evidência:** `scripts/db-test-planejamento.mjs`, `scripts/db-test-planejamento-concorrencia.mjs`.

### T103 — Fechamento, fotografia e desvio

**Implementação:** Implementado · **Automação:** Banco, concorrência e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Feche janeiro passado, tente editar/excluir/importar plano desse mês e altere um
título real no teste de banco. Reabra com motivo válido e feche novamente. Teste fechamento
e edição nas duas ordens, com espera pelo lock observada no banco.

**Esperado:** Foto da grade e caixa base preservada. Desvio = executado − (registrado + plano)
salvo; não muda ao desligar o simulador. Mudanças nos títulos reais só aparecem após reabrir.
Reabertura exige motivo; fechamento anterior fica registrado. Mês atual/futuro não fecha.
Concorrência recusa versão antiga e não deixa edição entrar em fotografia já fechada.

**Evidência:** `scripts/db-test-planejamento.mjs`, `scripts/db-test-planejamento-concorrencia.mjs`,
`tests/e2e/planejamento.spec.ts`.

### T104 — OTP, escopo do líder e revogação durante envio

**Implementação:** Implementado · **Automação:** Banco e navegador; SMTP real pendente

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Tente abrir com outra identidade, senha sem OTP e OTP com mais de 15 minutos.
Consulte tabelas/cenário como líder; envie enquanto o financeiro revoga, nas duas ordens.

**Esperado:** Link isolado não autoriza leitura; pré-validação anônima só retorna booleano para
hash/e-mail. Formulário retorna apenas setor/ano/prazo, categorias e próprias linhas. Sem
empresa_id/caixa/títulos nem associação à empresa. Revogação primeiro impede o envio após
espera; envio primeiro preserva a revisão e a revogação bloqueia acessos posteriores.

**Evidência:** `scripts/db-test-planejamento.mjs`, `scripts/db-test-planejamento-concorrencia.mjs`,
`tests/e2e/planejamento.spec.ts`. Auth real com OTP gerado sem envio não comprova entrega de e-mail.

### T105 — Revisar, substituir e preservar espelhos de contribuição

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Envie R$ 4,44; marque revisado, importe, edite para R$ 8,88 e importe nova revisão.
Repita importação; envie lista vazia no teste de banco. Tente importar revisão antiga e revisão
que altere mês fechado; consulte histórico/espelhos.

**Esperado:** Revisar não importa. Nova revisão só substitui as linhas do mesmo convite após
ação explícita, sem acumular R$ 4,44 + R$ 8,88. Espelhos ficam preservados. Pedido repetido não
duplica; revisão desatualizada é recusada. Lista vazia declara ausência de custos e retira
linhas anteriores após importação. Fechamento impede substituição até reabrir. Campos de
empresa/centro/tipo enviados pelo líder não desviam o vínculo atribuído pelo financeiro.

**Evidência:** `scripts/db-test-planejamento.mjs`, `tests/e2e/planejamento.spec.ts`.

### T106 — Agregados, paginação e consulta de leitura no planejamento

**Implementação:** Implementado · **Automação:** Banco, unidade e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Use mais de 50 grupos e mais de 1.000 linhas no teste de banco, navegue páginas e
compare os totais. Consulte nos seis papéis, empresa alheia e após revogar vínculo. Abra em 390px.

**Esperado:** Totais consideram todos os dados e não são truncados ao limite REST ou à página.
Grupos não se repetem entre páginas; centavos permanecem exatos. Leitores não têm mutações;
empresa alheia/vínculo removido retornam indisponível/404. Tabelas rolam no componente sem
alargar o documento. Captura móvel gerada temporariamente em `test-results/planejamento-mobile.png`.

**Evidência:** `scripts/db-test-planejamento.mjs`, `tests/planejamento.test.ts`,
`tests/e2e/planejamento.spec.ts`.

### T107 — Execução real sem duplicar a estimativa

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** ✅ automatizado · **Última rodada:** 14/10/2026 · **Resultado:** passou; conferir evidências no checkpoint de Planejamento

**Ações:** Vincule uma despesa planejada a um título já registrado. Confira grade, caixa e
desvio; duplique no mesmo ano, desvincule no original e compare. Tente usar o mesmo título
em outra linha ou excluir/trocar tipo da linha vinculada. Feche um mês, cancele o título
real no módulo financeiro e confira antes/depois de reabrir.

**Esperado:** P preserva estimativa para orçamento. O título não é repetido em R; executado
usa categoria/centro planejado e data efetiva da baixa. A linha já representada pelo título
não é adicional no caixa. Vínculo é individual por cenário, exige tipo/empresa compatíveis
e bloqueia exclusão/troca de tipo até desvincular. Cópia do mesmo ano preserva associação.
Cancelado restaura o adicional em mês aberto, sem alterar fotografias fechadas. Desvincular
reverte o tratamento sem modificar o livro financeiro; nenhum vínculo é inferido automaticamente.

**Evidência:** `scripts/db-test-planejamento.mjs`, `tests/e2e/planejamento.spec.ts`.

### T108 — Diretos, gerais e receitas vinculadas nas duas bases

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Vincule 100% de uma despesa e uma receita a um produto. Classifique outra despesa
como geral; compare vencimento/original com liquidação/valor efetivo. Ligue gerais por receita.

**Esperado:** Cancelados ficam fora; abertos entram somente no registrado. Encargos/descontos
entram no realizado, sem repetir extrato. Não vinculados aparecem como receita sem produto.
Geral nunca muda a margem; alocação por receita inclui a parcela sem produto e preserva
centavos. Sem receita, todo geral fica não alocado. Vínculos são por ocorrência, sem mudar o livro.

**Evidência:** `scripts/db-test-produtos.mjs`, `tests/e2e/produtos.spec.ts`.

### T109 — Rateio salvo, prioridade e aplicação automática

**Implementação:** Implementado · **Automação:** Unidade, banco, concorrência e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Tente percentuais que não somem 100%, produtos repetidos, produto alheio e dois
critérios simultâneos. Salve regra por categoria e outra por fornecedor; classifique uma
ocorrência explicitamente e volte para automático. Gere uma série recorrente com 12 ocorrências.

**Esperado:** Rateios inválidos recusados; uma regra ativa por critério. Ordem: explícito,
fornecedor, categoria exata, geral. R$ 1,01 em 40/35/25% vira R$ 0,41/0,35/0,25 pelo maior
resíduo e desempate UUID; soma exata. As 12 ocorrências herdam a resolução automática sem
vínculos manuais. Arquivar regra desativa só o automático, preservando vínculos explícitos.
Troca dos itens é atômica: outro leitor vê os pesos anteriores ou os novos, sem estado parcial.

**Evidência:** `scripts/db-test-produtos.mjs`, `scripts/db-test-produtos-concorrencia.mjs`,
`tests/produtos.test.ts`, `tests/e2e/produtos.spec.ts`.

### T110 — Custos avulsos e arquivamento do produto

**Implementação:** Implementado · **Automação:** Banco e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Crie/edite custo avulso direto com produto, data e valor positivo. Arquive/reative
o avulso e o produto; consulte margens e tente criar vínculo para produto arquivado/alheio.

**Esperado:** Avulso entra nas duas bases pela data informada; arquivado sai do total e pode
ser reativado, com histórico preservado. Produto arquivado mantém custos/receitas anteriores;
novas associações exigem ativo da mesma empresa. Nenhum avulso cria título, baixa ou caixa.

**Evidência:** `scripts/db-test-produtos.mjs`, `tests/e2e/produtos.spec.ts`.

### T111 — Preço alvo, volume e equilíbrio

**Implementação:** Implementado · **Automação:** Unidade, banco e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Salve custo unitário R$ 1,01, projeto R$ 5,00, preço R$ 5,00, volume três e margem
alvo 20%. Teste preço igual/inferior ao variável, projeto sem custo e valores acima dos limites.

**Esperado:** Receita R$ 15,00, custo R$ 8,03, contribuição R$ 6,97, preço alvo R$ 3,35 e
equilíbrio em duas unidades. Tetos em centavos/unidades, sem ponto flutuante. Preço sem
contribuição unitária não cobre projeto positivo; margem alvo 100% e volume zero recusados.
Premissas não alteram o custeio de títulos ou cenários sem envio explícito.

**Evidência:** `tests/produtos.test.ts`, `scripts/db-test-produtos.mjs`, `tests/e2e/produtos.spec.ts`.

### T112 — Projeção de produto no Planejamento sem duplicar

**Implementação:** Implementado · **Automação:** Banco, concorrência e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Envie projeção para cenário/mês/categorias/centro; altere volume e reenvie. Repita
o pedido, mude de mês, duplique cenário e reenvie na cópia. Feche o mês anterior/destino ou
vincule uma linha a execução real. Dispute projeção com fechamento nas duas ordens.

**Esperado:** Até três partes identificadas por produto: receita, variável e projeto, omitindo
zeros. Reenvio substitui só essas linhas, sem duplicar nem criar títulos reais. Alteração de
premissa não é automática; cópias preservam origem. Mês fechado ou execução vinculada bloqueia
substituição até reabrir/desvincular. Versão antiga é recusada após esperar o lock. O simulador
existente reflete as novas linhas; com quatro unidades na fixture, janeiro fica R$ 1.066,96.

**Evidência:** `scripts/db-test-produtos.mjs`, `scripts/db-test-produtos-concorrencia.mjs`,
`tests/e2e/produtos.spec.ts`.

### T113 — Permissões, idempotência e edição simultânea de custeio

**Implementação:** Implementado · **Automação:** Banco, concorrência e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Consulte/edite nos seis papéis e com usuário de outra empresa. Tente DML direto,
referências cruzadas, alteração com versão antiga e pedido simultâneo idêntico. Revogue leitor.

**Esperado:** Quatro papéis escrevem por RPC; leitores só consultam. DML direto/anon negados;
RLS nas oito tabelas. Empresa/produto alheio não vazam. Mesmo pedido retorna um produto, sem
repetir histórico/evento; conteúdo diferente no mesmo pedido é recusado. Duas edições com mesma
versão têm um vencedor. Arquivar produto enquanto outra conexão edita regra não aceita destino
inativo. Revogado recebe 404. Histórico e eventos preservam autor/ação, sem credenciais.

**Evidência:** `scripts/db-test-produtos.mjs`, `scripts/db-test-produtos-concorrencia.mjs`,
`tests/e2e/produtos.spec.ts`.

### T114 — Agregados, filtros, paginação e visualização móvel de produtos

**Implementação:** Implementado · **Automação:** Unidade, banco e navegador

**Status:** ✅ passou · **Última rodada:** 15/10/2026 · **Resultado:** aprovado; ver evidências no checkpoint de Produtos

**Ações:** Use mais de 50 produtos e 10.001 custos no banco. Compare páginas e totais acima
da precisão de Number. Tente datas inválidas, ordem invertida/período acima de 366 dias e UUID
inexistente. Abra em 390px e consulte como leitor.

**Esperado:** Totais não truncam nas páginas nem em 1.000 origens; R$ 100.010.000.000.000,00
permanece exato no agregado sintético. Páginas não repetem produtos. Filtros inválidos mostram
erro/consulta indisponível; produto inexistente/sem vínculo retorna 404. Tabelas rolam dentro
do componente sem alargar a página. Screenshot temporário `test-results/produtos-mobile.png`.

**Evidência:** `scripts/db-test-produtos.mjs`, `tests/produtos.test.ts`, `tests/e2e/produtos.spec.ts`.

## Resumo de cobertura

| Jornada | IDs |
|---|---|
| Entrada, design system e autenticação | T001–T010 |
| Contas CPF/CNPJ, convites e papéis | T011–T020 |
| Cadastros base | T021–T033 |
| Contas a Pagar | T034–T050 |
| Contas a Receber | T051–T063 |
| Contas bancárias, importação e conciliação | T064–T078 |
| Fluxo de caixa | T079, T093–T097 |
| Dashboard | T080, T098–T101 |
| Planejamento, simulador e líderes | T081–T083, T102–T107 |
| Custo e precificação de produtos | T084, T108–T114 |
| Módulos futuros do plano | T085–T090 |
| Casos acrescentados: upload e ZIP | T091–T092 |

Total: **114 cenários**. IDs planejados serão detalhados e atualizados conforme cada entrega,
sem tratar funcionalidades futuras como defeitos do módulo atual.


## Checkpoint da entrega bancária — 13/10/2026

Banco implementado e migration `20261013190759_contas_bancarias_conciliacao.sql` aplicada e registrada.
**24 testes unitários, 671 verificações de banco e 4 specs de navegador passaram** contra build local
e Supabase configurado. Build, TypeScript e lint passaram; advisors sem alertas; auditoria de produção
sem vulnerabilidades. Fixtures revertidas/removidas; nenhum envio de e-mail real.

Comandos/evidências: `npm test`, `npm run test:db`, `npm run test:e2e` (app, bancos, pagar, receber),
`npm run build`, `npx tsc --noEmit`, `npm run lint`, `node scripts/db-advisors.mjs`,
`npm audit --omit=dev`. Detalhes em `docs/contas-bancarias.md`.

Limites da entrega: CSV/XLSX seguem modelo; um movimento por liquidação já registrada; sem
transferências reais, agrupamentos ou baixas parciais. Ambiguidade sem identificadores requer
conferência. Ainda pendentes: rodada manual, e-mails reais, deploy e T079–T090 conforme plano.
Próxima etapa: **Fluxo de caixa**.


## Checkpoint da entrega de fluxo de caixa — 13/10/2026

Migration `20261013210457_fluxo_caixa.sql` aplicada e registrada. **27 testes unitários,
729 verificações de banco e cinco specs de navegador aprovados**. Build, TypeScript e lint
passaram; advisors de segurança sem alertas. Banco/Pagar/Receber passaram na rodada completa;
Auth/cadastros e fluxo passaram na reexecução após os ajustes de testes descritos no histórico.
Fixtures revertidas/removidas; nenhum envio de e-mail real. Conferência manual pendente.

Comandos: `npm test`, `npm run test:db`, `npm run build`, `npm run lint`, `npx tsc --noEmit`,
`node scripts/db-advisors.mjs`, `node scripts/db-check.mjs`, `npm run test:e2e` e
`node node_modules/@playwright/test/cli.js test tests/e2e/app.spec.ts tests/e2e/fluxo-caixa.spec.ts`.
Após corrigir os seletores, lint dos dois specs também passou. Screenshot móvel:
`test-results/fluxo-caixa-mobile.png`. T079 e T093–T097 detalham os casos implementados.

Limites: previsões sem conta bancária atribuída; banco individual mostra extrato/abertura.
Vencidos anteriores entram somente na projeção. Títulos usam o estado atual, não snapshots
históricos; movimentos sem vínculo de conciliação não são combinados por suposição.
Detalhes em `docs/fluxo-caixa.md`. Próxima etapa: **Dashboard** (T080).

## Checkpoint da entrega de Dashboard — 14/10/2026

Migration `20261013221251_dashboard.sql` aplicada e registrada. Build, TypeScript, lint,
**30 testes unitários e 777 verificações de banco passaram** (48 novas do Dashboard).
Advisors de segurança sem alertas; as tabelas públicas mantêm RLS. O spec de Dashboard
passou em 29,9 segundos; os cinco specs anteriores passaram na regressão em 3,8 minutos.
**Seis specs aprovados em duas execuções.** Fixtures revertidas/removidas; nenhum envio de e-mail real.

Comandos: `npm test`, `npm run test:db`, `npm run build`, `npm run lint`, `npx tsc --noEmit`,
`node scripts/db-advisors.mjs`, `node scripts/db-check.mjs`,
`node node_modules/@playwright/test/cli.js test tests/e2e/dashboard.spec.ts` e
`node node_modules/@playwright/test/cli.js test tests/e2e/app.spec.ts tests/e2e/bancos.spec.ts tests/e2e/fluxo-caixa.spec.ts tests/e2e/pagar.spec.ts tests/e2e/receber.spec.ts`.
O lint do spec também foi repetido após ajustar o seletor do filtro de Pagar.

Os testes usam dados sintéticos: a fixture de fixos foi ajustada para preparar a marcação
entre desfazer e refazer a conciliação. A primeira execução de navegador detectou um seletor
ambíguo entre o filtro e o formulário de criação de Pagar; corrigido para consultar o filtro.
Capturas móveis/desktop são geradas no spec e podem ser limpas pela próxima execução do Playwright.

Limites: títulos pelo estado atual; caixa consolidado com origens sem conta definida; vencidos
globais até ontem; projeção de fixos somente dos abertos já gerados. Não é lucro/DRE, cenário
de planejamento ou saldo bancário online. T080 e T098–T101 implementados; **101 cenários**
no roteiro. Conferência manual pendente. Próxima etapa: **Planejamento e Simulador** (T081–T083).

## Checkpoint da entrega de Planejamento — 14/10/2026

Migrations `20261014111152_planejamento.sql` e `20261014115150_planejamento_execucao.sql`
aplicadas e registradas. **34 testes unitários e 949 verificações de banco passaram**:
146 novas regras de planejamento e 26 verificações de concorrência, além das 777 anteriores.
Build, TypeScript e lint passaram; advisors de segurança sem alertas. RLS ativo nas seis
tabelas novas e nas 26 tabelas públicas. **Os oito specs de navegador passaram em 4,3 minutos
no build final**, incluindo as seis regressões anteriores, planejamento e OTP. As duas
jornadas novas também passaram isoladamente antes dessa rodada completa.

Comandos: `npm test`, `npm run test:db`, `npm run build`, `npm run lint`, `npx tsc --noEmit`,
`node scripts/db-advisors.mjs`, `node scripts/db-check.mjs`,
`npx playwright test tests/e2e/planejamento-otp.spec.ts --output=test-results/planejamento-otp`,
`npx playwright test tests/e2e/planejamento.spec.ts --output=test-results/planejamento` e
`npx playwright test --output=test-results/final-planejamento`.
O lint dos arquivos de planejamento foi repetido após os ajustes finais.

As primeiras rodadas identificaram limites de acessibilidade dos seletores, perda de campos
após erro e truncamento do OTP: o Auth deste ambiente gera oito dígitos, enquanto o formulário
aceitava seis. Corrigidos campos controlados, nomes acessíveis e validação de 6–10 dígitos;
o teste específico confere FormData e o envio integral do código após uma tentativa inválida.
A jornada aguarda a confirmação de revisar/revogar antes da próxima ação, preservando as
assertivas de versão. O teste de concorrência mantém identidade em transação para evitar
contaminação de papel nas conexões do pool. Nenhum código ou token é incluído nas evidências.

Verificados cenários/cópias, simulação/comparação, fechamento/reabertura, vínculo com execução
sem duplicação, revisão/importação/substituição, acesso por papel e revogação. A captura em
390px fica em `test-results/planejamento-mobile.png`; tabelas rolam internamente. Fixtures
revertidas/removidas. **107 cenários** no roteiro, com T081–T083 e T102–T107 implementados.

Limites: estimativas de produtos manuais até a etapa 9; seletores/histórico têm os limites
documentados em `docs/planejamento.md`. SMTP/template `{{ .Token }}` e entrega real de e-mail
continuam pendentes: geração pelo Admin e confirmação no Auth não comprovam caixa postal.
Conferência manual pendente. Próxima etapa: **Custo e precificação de produto** (T084).

## Checkpoint da entrega de Produtos — 15/10/2026

Migration `20261014134626_produtos_custeio.sql` aplicada e registrada. Oito tabelas novas com
RLS e RPCs autorizadas; as 34 tabelas públicas mantêm RLS. Advisors de segurança sem alertas.
**38 testes unitários, build e TypeScript passaram.** Cobertura aprovada de banco: **1.119
verificações** (949 anteriores + 148 de Produtos + 22 de concorrência). A rodada completa
passou com 1.115; depois foram acrescentadas quatro assertivas de série recorrente, e as 148
verificações atualizadas do módulo passaram novamente. Fixtures revertidas/removidas.

A jornada de Produtos passou isoladamente em 33,8s, incluindo cadastro, regra inválida/válida,
classificações, custo avulso, margens/gerais, registrado/realizado, preço/volume, projeção e
substituição, arquivamento/reativação, leitor/revogação, datas inválidas, 404 e 390px.
Captura móvel em `test-results/produtos-mobile.png` conferida. **Os nove specs de navegador
passaram no build final em 5,2 minutos**, com Produtos em 31,8s. Lint dos últimos ajustes passou.

Comandos: `npm test`, `npm run test:db`, `node scripts/db-test-produtos.mjs`,
`node scripts/db-test-produtos-concorrencia.mjs`, `npm run build`, `npx tsc --noEmit`,
`npm run lint`, `node scripts/db-migrate.mjs --dry-run`, `node scripts/db-migrate.mjs`,
`node scripts/db-advisors.mjs`, `node scripts/db-check.mjs`,
`npx playwright test tests/e2e/produtos.spec.ts --output=test-results/produtos` e
`npx playwright test --output=test-results/final-produtos`.
Lint dos arquivos novos repetido após os últimos ajustes.

Primeiras rodadas corrigiram preparação de fixtures (e-mail confirmado para configurar a
aprovação, CPF distinto na segunda empresa e consulta de versão não disponível ao outsider).
No navegador, a segunda projeção lia a mensagem de sucesso anterior antes de concluir a
ação. O teste agora aguarda o cenário ser limpo após o sucesso; a UI também oculta mensagens
anteriores durante o envio. Não foram enfraquecidas assertivas de valor, margem ou duplicidade.

Roteiro com **114 cenários**, T084 e T108–T114 implementados. Conferência manual pendente.
Limites: custeio pelo estado atual, seletores de até 1.000 registros, histórico visível dos
últimos 50 eventos e avulsos incluídos nas duas bases pela data informada. Premissas não
atualizam plano automaticamente. SMTP/entrega de e-mail continuam pendentes das etapas
anteriores; esta entrega não envia e-mails. Próxima etapa: **DRE e Relatórios + exportação**.

## Dependências e limpeza

Auth → Empresas/papéis → Cadastros → Pagar/Receber → Bancos/importação/conciliação →
Fluxo/Dashboard → Planejamento/produtos/DRE. Eventos de uso entram junto de cada módulo.

- Conferir sempre revogação de acesso, isolamento por empresa e concorrência após mudanças financeiras.
- Prioridade de regressão: valores em centavos, baixa/estorno, duplicação, RLS e conciliação.
- Automação usa fixtures próprias e remove somente empresas/usuários criados pelo teste.
- Limpeza manual deve usar apenas contas de teste. A UI arquiva/cancela em vez de excluir definitivamente.
- Fora do MVP: BaaS, Open Finance, cobrança de assinatura e emissão de boleto/PIX.
- Pendentes operacionais: deploy e validação de confirmação/recuperação/OTP com e-mail real.

## Histórico de execuções

| Data | Ambiente | Escopo | Resultado e evidência |
|---|---|---|---|
| 13/10/2026 | Build local :3100 + Supabase configurado | Auth, cadastros, Pagar, Receber | 16 unidades, 561 verificações de banco e 3 specs de navegador passaram; nenhum envio de e-mail real |
| 13/10/2026 | Build local :3100 + Supabase configurado | Regressão completa + bancos/importação/conciliação | 24 unidades, 671 verificações de banco e 4 specs de navegador passaram; cases de upload (origem/leitura), ZIP, proteção da baixa e concorrência incluídos; fixtures removidas |
| 13/10/2026 | Build local :3100 + Supabase configurado | Primeiras rodadas de fluxo de caixa | Banco: 58 novas verificações, total 729; 27 unidades, build, TypeScript e lint passaram. Navegador inicial identificou dois seletores de teste incorretos (CardTitle e anúncio de rota); corrigidos. Rodada completa: bancos/Pagar/Receber passaram; Auth/cadastros atingiu limite global de 120s na troca de papel. Orçamento da jornada ajustado para 180s, sem alterar asserts ou tempos de espera de elementos; reexecução dos dois specs registrada na linha seguinte |
| 13/10/2026 | Build local :3100 + Supabase configurado | Reexecução de Auth/cadastros e fluxo | Ambos passaram (1,6 min / 35,5 s). Somados aos três specs aprovados na rodada completa, cinco jornadas aprovadas. Filtros, origens, paginação, mensal, leitor/revogação, 404 e 390px verificados; fixtures removidas. Roteiro com 97 cenários atualizado; conferência manual pendente |
| 14/10/2026 | Build local :3100 + Supabase configurado | Dashboard + regressão anterior | 30 unidades, 777 verificações de banco, build/TypeScript/lint e advisors sem alertas. Após ajustes da fixture e do seletor de filtro, Dashboard passou (29,9s); os cinco specs anteriores passaram em 3,8min, totalizando seis specs aprovados em duas execuções. Indicadores, gráfico, custos fixos/projeção, leitura/revogação, isolamento, importação refletida e 390px verificados. Fixtures revertidas/removidas; sem envio de e-mail real; roteiro atualizado para 101 cenários. Conferência manual pendente |
| 14/10/2026 | Build local :3100 + Supabase configurado | Planejamento, líderes/OTP e regressão completa | 34 unidades, 949 verificações de banco (146 novas regras e 26 de concorrência), build/TypeScript/lint e advisors sem alertas. Duas migrations aplicadas; 26 tabelas públicas com RLS. Após corrigir campos/seletores, truncamento do OTP de oito dígitos e sincronização das ações no teste, os oito specs passaram em 4,3min com `npx playwright test --output=test-results/final-planejamento`. Planejamento passou em 38,4s e OTP em 2,6s. Simulação, cópia, fechamento, vínculo sem duplicação, revisão/substituição, revogação e 390px verificados. Fixtures revertidas/removidas; sem envio real de e-mail. Roteiro com 107 cenários; conferência manual e SMTP/entrega pendentes |
| 15/10/2026 | Build local :3100 + Supabase configurado | Produtos/custeio/precificação e regressão completa | 38 unidades, build/TypeScript/lint e advisors sem alertas. Migration aplicada; 34 tabelas públicas com RLS. Banco: regressão completa de 1.115 verificações passou, depois o módulo foi repetido com quatro assertivas adicionais de recorrência (148 regras de Produtos + 22 de concorrência + 949 anteriores = 1.119 na cobertura atual). Após corrigir fixtures e esperar a conclusão da segunda projeção, os nove specs passaram no build final em 5,2min com `npx playwright test --output=test-results/final-produtos`; Produtos em 31,8s. Rateio exato, margens/gerais, bases, avulsos, preço/volume, substituição sem duplicar, leitura/revogação e 390px verificados. Fixtures revertidas/removidas; sem envio de e-mail. Roteiro com 114 cenários; conferência manual pendente |
| 19/10/2026 | Build local :3100 + Supabase reativado | DRE e relatórios | 43 unidades, build/TypeScript/lint passaram. Banco: 135 verificações de relatórios e 16 de concorrência passaram; os módulos anteriores até Produtos foram reexecutados sem falha (a regressão foi interrompida por ECONNRESET e relatórios rodou isolado). Spec `relatorios.spec.ts` passou em 1,6min. Advisors: `rls_auto_enable()` SECURITY DEFINER exposta e proteção de senha vazada desativada, fora do escopo desta entrega. Sem envio de e-mail; conferência manual pendente |
| 19/10/2026 | Build local :3100 + Supabase | Demanda e uso de cadastros | Migration aplicada; `db-test-demanda.mjs`: 13 verificações passaram (idempotência, papéis, isolamento, anônimo, eventos de cadastros); regressão de banco anterior reexecutada até Produtos na rodada de relatórios. Spec do Dashboard com clique do botão passou (40,9s). Build, TypeScript e lint passaram. Revogação de `rls_auto_enable` testada com DDL após a migration. Sem e-mail real; conferência manual pendente |
| 19/10/2026 | Build local :3100 + Supabase | Perfil/usuários | Migration aplicada; `db-test-perfil.mjs`: 16 verificações passaram. Spec `app.spec.ts` ampliado (e-mail do acesso, renomear, sair da conta) passou em 1,3min após esperar a navegação em "Trocar de conta" (rótulo "Nome da conta" agora existe também na página da empresa). Build, TypeScript e lint passaram; demais specs não reexecutados. Conferência manual pendente |
| 19/10/2026 | Build local :3100 + Supabase | Regressão completa (todos os módulos até Perfil/usuários) | `npm run test:db`: 19 scripts, 1.299 verificações de banco passaram sem falha. Build, TypeScript e lint passaram; 43 unidades passaram. `npx playwright test --output=test-results/regressao`: 10 specs passaram em 6,6min (app, bancos, dashboard, fluxo, pagar, planejamento-otp, planejamento, produtos, receber, relatorios). Fixtures revertidas/removidas; sem e-mail real; conferência manual pendente |

Atualizar esta tabela a cada entrega com números efetivamente executados, falhas/ressalvas e
o estado das funcionalidades novas. Não copiar o resultado anterior como uma nova execução.

## Prévia independente de inbox — 16/10/2026

Artefato visual solicitado para o **Estallo CRM**, criado neste workspace em
`public/previews/inbox-layout.html`. Não implementa atendimento no Finbast e não altera os
114 cenários financeiros acima nem o status das próximas etapas do produto.

- Organização: categorias em uma única navegação; busca com menu de Minhas, Não lidos,
  Grupos, tags com E/OU e número; filtros ativos removíveis; lista com nome/horário,
  mensagem e posição explícita na fila/espera; seta com ações por conversa.
- Cabeçalho: assumir/liberar e fechar/reabrir em destaque; transferência, lembrete,
  contato pessoal, automático e chamadas no menu. Compositor mantém resposta/nota,
  rascunhos, citação, anexos, emoji, áudio de exemplo e assistente de escrita.
- Ficha lateral: componente original e dependências visuais copiados do `estallo-crm`,
  com 36 arquivos conferidos byte a byte; dados e integrações usam adaptadores de exemplo.
  Os pixels da ficha no desktop coincidiram com sua renderização isolada de referência.
- Rodada automatizada: **16/10/2026**, Microsoft Edge/Playwright local, comando
  `node previews/inbox-layout/verify.mjs`: **19 grupos de verificações passaram**,
  sem erros de página ou requisições externas. Inclui filtros combinados/estado vazio,
  busca, fixar/desafixar sem mudar a fila, não lida, mensagens/notas/citação, ações do
  cabeçalho, confirmação/cancelamento de limpar/apagar, seções da ficha e visualizador.
- Tamanhos: 1920×1080, 1366×768, 1024×768 e 768×1024, sem transbordamento horizontal.
  No notebook a área de mensagens mediu 1030×517 px. Ficha abre sob demanda nas telas
  menores; em tablet vertical, a lista também abre como painel.
- Evidências: `public/previews/inbox-layout/verification.json`, capturas na mesma pasta
  e `previews/inbox-layout/README.md`. Reproduzir com os dados demonstrativos;
  não inserir credenciais ou informações reais de clientes.
- Limite da rodada: valida uma prévia local. Mensagens, arquivos, áudio, IA e alterações
  são simulados; não comprova integração E2E, permissões ou backend do Estallo CRM.
  Avaliação visual pelo usuário e eventual implementação no CRM permanecem pendentes.

### Revisão da prévia de inbox — 16/10/2026

- Cabeçalho global e navegação lateral reutilizados do código original: organização,
  busca, avisos, idioma/tema e menu do usuário. As categorias agora pertencem à lista de
  conversas; não substituem o cabeçalho fixo do sistema.
- Ficha com divisória arrastável e lógica original de larguras. Desktop e notebook
  redistribuem o espaço entre lista, conversa e ficha durante o arraste. Mantidos limites
  de 260–560 px para a ficha, lista mínima de 240 px e conversa mínima de 420 px quando
  houver espaço. Setas/Home/End, duplo clique e memória por faixa também verificados.
- Cabeçalho/compositor se adaptam à largura do chat, inclusive quando a ficha é ampliada.
  Em tablet a ficha mantém o comportamento sobreposto. Balões usam as bordas úteis do
  chat com margem pequena, sem a antiga limitação de uma coluna central de mensagens.
- Automação local: `node previews/inbox-layout/verify.mjs`, Microsoft Edge/Playwright,
  **24 grupos aprovados**, 58 arquivos de origem conferidos byte a byte, ficha idêntica
  em pixels à referência isolada e nenhum erro de página/requisição externa. Lint dos
  scripts também passou. As medidas atuais, com a casca global presente, estão em
  `verification.json`; notebook com ficha recolhida: 934×491 px de área de mensagens.
- Novas capturas incluem `desktop-ficha-ampliada.png` e `notebook-ficha-ampliada.png` em
  `public/previews/inbox-layout/`. Permanecem os limites de uma prévia com dados locais;
  a rodada não comprova integração ou permissões do CRM real.
- Conferência automatizada adicional via HTTP local: resposta 200, arraste no visualizador
  com escala de 320 para 500 px, restauração por duplo clique e encaixe da ficha no
  notebook sem sobreposição. Nenhum erro de página nessa conferência adicional.
