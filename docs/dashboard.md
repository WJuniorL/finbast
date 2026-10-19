# Dashboard

Abra **Abrir Dashboard** na empresa. Selecione o mês de referência (2000–2100); o padrão
é o mês atual de America/Bahia. Todos os membros vinculados podem consultar, incluindo
leitores e contadores somente leitura. A tela não altera registros nem movimenta dinheiro.

## Indicadores

- Saldos realizado inicial, realizado final e projetado final: mesma fonte/regras do fluxo
  de caixa consolidado. Baixas com conciliação ativa entram exclusivamente pelo extrato.
- Entradas e saídas realizadas no mês: incluem extrato confirmado e baixas sem conciliação,
  por sua data efetiva. Aberturas bancárias não são entradas de receita.
- Variação de caixa: entradas menos saídas realizadas; não é lucro ou resultado contábil.
- A pagar/receber em aberto no mês: valores originais dos títulos abertos, por vencimento.
- Vencidos até ontem: todos os períodos, somente abertos com vencimento anterior ao dia
  atual em America/Bahia. Não usa o mês selecionado; vencimento de hoje não é vencido.
- Conciliação pendente: todos os movimentos confirmados até o fim do mês, sem vínculo
  ativo. Mostra até cinco recentes; contador considera todos. Prévia não participa.
- Saldos bancários no fim do mês: abertura mais movimentos até a data de corte; inclui
  contas arquivadas e exibe até dez contas. Contas abertas depois do corte não participam.

Cards levam aos módulos de origem mantendo o período quando aplicável. Atalhos de vencidos
mantêm o filtro global, sem limitar ao mês. O resumo de títulos mostra os dez primeiros
abertos do mês em ordem de vencimento/tipo/ID, com link ao histórico.

## Custos fixos

O total mensal considera o campo **custo_fixo da ocorrência**, títulos abertos ou pagos,
valor original e vencimento no mês. Cancelados são excluídos. Não usa recorrência como
substituto da marcação de custo fixo. A flag inicial vem da categoria e pode ser sobrescrita
no lançamento pelo módulo Pagar.

Quebra nas dez maiores categorias (total completo mesmo com mais categorias). Projeção
dos três meses seguintes ao selecionado: somente títulos fixos **abertos já gerados**,
agrupados por vencimento. Não replica automaticamente valores de recorrências, não inclui
pagos/cancelados na projeção e não cria cenário de planejamento. Link ao filtro de fixos
em Pagar mantém o mês e permite consultar os estados dos títulos.

## Gráfico e estados

Gráfico com linha realizada e projetada; escolha um dia para consultar os valores exatos.
A linha tracejada também diferencia as séries sem depender apenas de cor. Campo com label,
descrição acessível do gráfico e anúncio dos valores ao mudar o dia. Ao mudar o mês, a
consulta do gráfico começa no primeiro dia do novo intervalo.

Empresa vazia mostra zeros e mensagens de ausência de dados, sem indicadores inventados.
Mês inválido ou repetido na URL mostra mensagem e não exibe totais. Empresa alheia ou
vínculo revogado retornam 404. Layout móvel preserva a largura; tabela rola no componente.

## Banco e limitações

Migration `20261013221251_dashboard.sql`: RPC `resumo_dashboard`, `STABLE SECURITY INVOKER`
com search_path fixo, grants somente authenticated e verificação do vínculo atual.
RLS das origens permanece ativa. Indicadores e fluxo usam o mesmo snapshot da chamada;
agregações no banco não são truncadas pelo limite REST de 1.000 registros. Valores monetários
em numeric no Postgres, texto na resposta e BigInt na aplicação; apenas coordenadas inteiras
do gráfico viram Number. Nenhuma tabela ou permissão de escrita nova.

Estado atual dos títulos, não reconstrução histórica. Previsões ainda sem conta bancária
atribuída participam do consolidado. Movimento e baixa sem vínculo de conciliação podem
representar o mesmo fato; não se presume correspondência por valor. Não há saldo bancário
online, DRE, percentuais de crescimento ou cenário de planejamento neste módulo.

## Verificação

- `scripts/db-test-dashboard.mjs`: totais, fluxo consistente, papéis, isolamento, revogação,
  datas, custos fixos, pendências e mais de 1.000 origens; 48 verificações, fixtures revertidas.
- `tests/dashboard.test.ts`: mês válido/inválido, coordenadas com negativos e valores acima
  da precisão de Number, zeros e período vazio.
- `tests/e2e/dashboard.spec.ts`: indicadores e origens, gráfico por dia, mês, custos fixos,
  importação refletida no Dashboard, leitura, empresa vazia, isolamento e largura móvel.
- Dados sintéticos em `scripts/dashboard-fixture.mjs`, fora da aplicação.

Resultados e evidências: T080 e T098–T101 no `testes-e2e-completo.md`.
As capturas em `test-results/` são temporárias e são regeneradas ao executar o spec;
o Playwright limpa o diretório de saída quando começa uma nova rodada.
