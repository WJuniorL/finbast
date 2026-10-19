# Contas a Pagar

Dentro de uma conta, **Abrir Contas a Pagar** acessa `/empresas/[id]/pagar`.
A interface usa shadcn/ui e os tokens Finbast, conforme `docs/design-system.md`.

## Lançamentos

- Descrição, fornecedor ativo, categoria de despesa ativa, valor e primeiro vencimento obrigatórios.
- Documento e centro de custo opcionais. Cadastros de outra empresa são recusados.
- Único: uma ocorrência em aberto.
- Parcelado: valor total dividido em 2–120 parcelas mensais. Centavos restantes ficam nas
  primeiras parcelas; a soma corresponde exatamente ao total. Cada parcela tem ao menos R$ 0,01.
- Recorrente: valor mensal, sem data final. Gera 12 ocorrências iniciais. **Atualizar recorrências**
  estende as séries ativas até o mês atual mais 11 meses, sem duplicar ocorrências.
- O dia original é preservado: 31/01 → 28/02 → 31/03, ou 29/02 em ano bissexto.
- Custo fixo é registrado por ocorrência a partir da categoria, com opção de sobrescrever.
  Alterar a categoria depois não altera automaticamente as ocorrências existentes.
- Edição altera somente uma ocorrência em aberto, incluindo seu valor e vencimento;
  preserva o modelo e as demais parcelas. O formulário carrega a versão atual ao abrir;
  confirmação compara essa versão para recusar alterações concorrentes, inclusive nas baixas.
- Cancelamento preserva o lançamento. **Interromper** desativa a série recorrente e cancela
  suas ocorrências futuras em aberto; vencidos, vencimentos de hoje e pagamentos permanecem.
- Referências arquivadas permanecem visíveis no histórico e podem ser mantidas ao editar;
  novas escolhas precisam estar ativas. Arquivamento bloqueia novas ocorrências da série.

A busca usa a descrição; filtros incluem situação, intervalo de vencimento e custo fixo.
Lista e histórico têm paginação de 50 registros. Os cartões mostram totais da conta inteira,
independentes dos filtros. Vencido significa aberto com vencimento anterior ao dia de hoje,
considerando `America/Bahia`.

## Baixa, estorno e aprovação

A baixa registra **pagamento realizado fora do Finbast**. Não efetua transferências, PIX ou
emissão de boletos. Permite data do pagamento, juros, multa, desconto e observação opcional.
Valor pago = valor original + juros + multa − desconto; resultado deve ser positivo.
Não aceita pagamentos com data futura.

**Desfazer baixa** exige senha de aprovação e motivo de 5–500 caracteres. Reabre a ocorrência,
limpa os valores de pagamento atuais e preserva a baixa anterior em um registro de estorno.
O botão **Histórico** mostra baixas/estornos, valor, data, autor e observação.

A senha de aprovação é pessoal, global por usuário e separada do login: seis dígitos
distintos, sem sequências crescentes/decrescentes (incluindo sequências que passam pelo zero).
O usuário a configura antes de registrar a primeira baixa. O banco armazena somente bcrypt
com custo 12, em `private.senhas_aprovacao`, inacessível aos clientes.
Cinco erros bloqueiam a aprovação por 15 minutos; as tentativas persistem mesmo quando a
operação é recusada. A senha não fica em estado React nem no histórico financeiro.

Para trocar, **Enviar código por e-mail** solicita OTP para o e-mail do usuário autenticado.
A confirmação usa Supabase Auth; a função de troca exige prova assinada `amr.method=otp`,
com até cinco minutos, ligada à sessão e usada uma única vez. Dados de `user_metadata`
não autorizam a troca. O e-mail de Magic Link do Supabase deve incluir `{{ .Token }}` para
mostrar o código; manter também os fluxos de confirmação/login usados pelo projeto.

**Pendente de operação:** configurar/verificar SMTP e o template no ambiente e testar entrega
com e-mail real. O teste automatizado gera OTP administrativo sem envio de e-mail e confirma
o código através do Auth real; isso valida a prova de autenticação, não a entrega da mensagem.
Referências: [OTP](https://supabase.com/docs/reference/javascript/auth-signinwithotp),
[confirmar OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp) e
[campos do JWT](https://supabase.com/docs/guides/auth/jwt-fields).

## Permissões e banco

| Papel | Consultar/histórico | Criar/editar/cancelar/recorrência | Baixar/estornar/aprovar |
|---|---|---|---|
| Proprietário, administrador, operador | Sim | Sim | Sim |
| Contador completo | Sim | Sim | Não |
| Leitura, contador leitura | Sim | Não | Não |

Migration aplicada: `supabase/migrations/20261013173410_contas_pagar.sql`.
Tabelas públicas: `series_pagar`, `lancamentos_pagar`, `baixas_pagar`, `eventos_uso`.
RLS isola todas por empresa/papel, com SELECT concedido explicitamente. INSERT, UPDATE e
DELETE financeiros não são concedidos aos clientes; mutações passam por RPCs que verificam
o vínculo atual, bloqueiam a ocorrência/série e atualizam pagamento, histórico e uso em
uma transação. Rotinas internas de geração e verificação de senha não são executáveis pelos
clientes. Wrappers públicos invoker delegam às rotinas privadas com autorização explícita.

Chaves estrangeiras compostas impedem referências entre empresas e a troca de categoria de
despesa para receita quando já usada em lançamentos. Novos cadastros são bloqueados durante
a validação para serializar criação com arquivamento. O UUID do pedido e o hash dos dados
garantem idempotência da criação; reenvio com outros dados é recusado.

Valores usam inteiros em centavos, sem ponto flutuante nos cálculos. Limite por valor:
R$ 10.000.000.000,00. Totais são retornados como texto para preservar a precisão das somas.
Seletores carregam até 1.000 opções por cadastro, com consultas adicionais para referências
da página; ampliar para busca dedicada se a base crescer. Recorrências têm proteção técnica
de 1.212 ocorrências; geração depende da ação de atualização, sem job agendado nesta entrega.

`eventos_uso` registra operações e quantidade de ocorrências geradas. Não aplica cobrança,
cotas ou limite mensal: a definição comercial permanece em aberto em `plan.md`.

## Verificação

`npm test`: valores brasileiros, divisão exata, datas mensais, PIN e validação de lançamento.
`npm run test:db`: regressões anteriores, 93 verificações financeiras e 15 de concorrência.
Testa papéis, isolamento, escrita direta proibida, histórico, idempotência, versão antiga,
bcrypt/bloqueio e prova OTP recente de uso único; fixtures revertidas ou removidas.
`npm run test:e2e`: fluxo financeiro, encargos, erro de senha, troca por OTP real, estorno,
histórico, parcelas, interrupção, permissões, revogação, paginação e largura móvel.

Próxima fatia vertical: **Contas a Receber**. Importação bancária e conciliação seguem etapas
posteriores do plano.
