# Contas a Receber

Dentro de uma conta, **Abrir Contas a Receber** acessa `/empresas/[id]/receber`.
A interface usa shadcn/ui e tokens Finbast, conforme `docs/design-system.md`.

## Lançamentos

- Descrição, cliente ativo, categoria de receita ativa, valor e primeiro vencimento obrigatórios.
- Documento e centro de custo opcionais; todas as referências devem pertencer à mesma empresa.
- Único: uma ocorrência em aberto.
- Parcelado: valor total dividido em 2–120 parcelas mensais, com pelo menos R$ 0,01 por parcela.
  Centavos restantes ficam nas primeiras parcelas, preservando exatamente a soma total.
- Recorrente mensal: sem data final, com 12 ocorrências iniciais. **Atualizar recorrências**
  estende séries ativas até o mês atual mais 11 meses, sem duplicar ocorrências.
- Datas preservam o dia original: 31/01 → 28/02 → 31/03; 29/02 em ano bissexto.
- Edição altera somente uma ocorrência em aberto. Modelo e demais parcelas permanecem.
  O formulário carrega a versão atual ao abrir; a confirmação recusa versões desatualizadas
  para evitar sobrescrever outra edição. Essa regra também vale para recebimento e estorno.
- **Cancelar** preserva a ocorrência e o histórico. **Interromper** desativa a série e cancela
  suas ocorrências futuras em aberto; recebimentos, vencidos e vencimentos de hoje permanecem.
- Referências arquivadas continuam visíveis e podem ser mantidas ao editar. Novas escolhas
  precisam estar ativas; arquivamento bloqueia novas ocorrências da série.
- Categorias de receita utilizadas neste módulo não podem mudar para despesa.

Situações: em aberto, vencido, recebido e cancelado. Vencido é aberto com data anterior a hoje,
considerando `America/Bahia`. Lista com busca por descrição, filtros de situação/intervalo
de vencimento e paginação de 50 registros. Cartões mostram totais da empresa inteira:
em aberto, vencido, recebido acumulado e valor em aberto com vencimento no mês atual.

## Recebimento e estorno

**Receber** registra recebimento integral de uma ocorrência, realizado fora do Finbast.
Permite data, juros, multa, desconto e observação opcional.
Valor recebido = original + juros + multa − desconto; o resultado deve ser positivo.
Datas futuras e valores inválidos são recusados.

**Desfazer recebimento** exige motivo de 5–500 caracteres. Reabre a ocorrência e limpa seus
campos atuais de recebimento. O estorno preserva o recebimento anterior no histórico,
incluindo valor original, juros, multa, desconto, valor líquido, data, autor e observação.
**Histórico** mostra essas operações com paginação de 50 registros.

Não emite boleto/PIX, não consulta bancos e não transfere dinheiro. Pagamentos parciais,
importação e conciliação não fazem parte desta entrega.

## Permissões

| Papel | Consultar/histórico | Lançar/editar/cancelar/recorrência | Receber/desfazer |
|---|---|---|---|
| Proprietário, administrador, operador | Sim | Sim | Sim |
| Contador completo | Sim | Sim | Sim |
| Leitura, contador leitura | Sim | Não | Não |

O PRD exige senha de aprovação para pagamentos. O registro contábil de recebimento manual
dispensa essa senha, inclusive para contador completo, pois não movimenta dinheiro.
Ações e rotinas do banco verificam o vínculo atual; revogar escrita produz efeito sem
depender de renovar o token do usuário.

## Banco

Migration: `supabase/migrations/20261013182723_contas_receber.sql`, aplicada e registrada.
Tabelas `series_receber`, `lancamentos_receber` e `baixas_receber` com RLS por empresa e
grants explícitos de consulta. Clientes não recebem INSERT/UPDATE/DELETE financeiros;
mutações passam por RPCs autorizadas que gravam ocorrência, histórico e uso em uma transação.
Wrappers públicos invoker delegam às rotinas privadas com autorização; helpers internos
não são executáveis pelos clientes. Advisors de segurança sem alertas após aplicação.

Chaves estrangeiras compostas impedem referências entre empresas e categorias de despesa.
Locks serializam baixa, estorno, cancelamento, geração e arquivamento de referências.
UUID do pedido e hash dos dados impedem duplicação no reenvio; outros dados com o mesmo
pedido são recusados. Duas baixas simultâneas produzem somente um recebimento.

Valores são inteiros em centavos. Helpers de valor/data em `src/lib/financeiro.ts` são
compartilhados com Contas a Pagar; totais retornam texto para preservar precisão.
Limite por valor: R$ 10.000.000.000,00. Seletores carregam até 1.000 opções por cadastro,
com consultas adicionais para referências da página. Recorrência tem proteção técnica
de 1.212 ocorrências; expansão acionada pelo usuário, sem job agendado.

Eventos de uso registram criação, edição, cancelamento, geração, recebimento e estorno.
Quantidades de ocorrências geradas são registradas, sem cobrança ou aplicação de cotas.

## Verificação

- `npm test`: validação de cliente, valores/encargos, datas e descarte de campos de autorização injetados.
- `npm run test:db`: 111 verificações de receitas e 19 de concorrência, além das regressões
  anteriores. Cobre papéis, RLS, grants, versão antiga, parcelas, recibos, estorno, categorias,
  arquivos, totais, revogação e isolamento. Fixtures revertidas ou removidas.
- `npm run test:e2e`: cliente/categoria, encargos, desconto inválido, estorno detalhado,
  parcelas, recorrência preservando recebidos, cancelamento, conflito de edição, contador
  completo, revogação, leitor, filtros, paginação e largura móvel.

Próxima fatia vertical: **Contas bancárias, importação CSV/XLSX/OFX e conciliação**.
