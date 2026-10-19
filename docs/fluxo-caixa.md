# Fluxo de caixa

Abra **Abrir fluxo de caixa** na empresa. Consulta disponível para todos os papéis
vinculados, inclusive leitores e contador somente leitura. Não altera títulos, conciliações
ou saldos e não movimenta dinheiro.

## Fontes e regras

- **Extrato confirmado:** movimentos importados por data do movimento, incluindo tarifas
  e movimentos ainda não conciliados. Prévia de importação não participa.
- **Baixas conciliadas:** representadas exclusivamente pelo extrato, mesmo que sua data
  seja diferente da baixa. A conciliação ativa suprime a outra origem em todo o período,
  e não apenas na página de detalhes ou no intervalo consultado.
- **Baixas sem conciliação:** valor efetivamente pago/recebido, com juros, multa e desconto,
  na data da baixa. Ficam em **Sem conta definida**.
- **Previsões:** ocorrências atualmente abertas de Pagar/Receber, por vencimento e valor
  original. Cancelados e liquidados não são previsões. Uma recorrência só participa quando
  suas ocorrências já foram geradas pelo módulo de origem.
- **Abertura:** saldo inicial declarado de cada banco na sua data de abertura; separado de
  entradas e saídas. Aberturas anteriores ao período e realizados anteriores formam o
  saldo realizado inicial. Aberturas dentro do período entram na evolução naquele dia.
- **Vencidos anteriores:** títulos abertos vencidos antes do início ficam visíveis no
  detalhe e compõem apenas o saldo projetado inicial. Há totais separados a pagar/receber.
- **Projeção:** saldo realizado inicial + vencidos anteriores líquidos + aberturas e
  realizados acumulados + previsões acumuladas no período.

Consolidado = bancos (inclusive arquivados) + origens sem conta definida. O saldo consolidado
é baseado nos dados registrados, não uma confirmação online do saldo de bancos. Um mesmo
fato ainda sem conciliação pode estar no extrato e na baixa; vincule-os para eliminar a
duplicidade. Sem vínculo, não se presume correspondência só por valor/descrição.

Pagar/Receber ainda não têm campo de conta bancária. Filtrar um banco mostra sua abertura
e seu extrato; previsões e baixas sem conciliação aparecem no consolidado ou no filtro
**Sem conta definida**. Não se distribuem previsões automaticamente entre bancos.

Esta tela consulta o **estado atual**: desfazer conciliação devolve a baixa ao grupo sem
conta; estornar baixa a devolve às previsões, preservando o extrato importado. Períodos
passados não reconstituem o estado dos títulos na época. Não é cenário de planejamento.

## Consulta e interface

Datas inclusivas entre 2000 e 2100, até **366 dias**. Padrão: mês atual de America/Bahia.
Filtros inválidos exibem mensagem sem totais. Conta de outra empresa ou acesso revogado
retornam 404. Contas arquivadas continuam disponíveis para consulta.

Agrupamento por dia ou mês; no mensal, movimentos são somados e saldos usam a última
posição do mês, nunca a soma das posições diárias. Tabelas permitem rolagem horizontal
dentro do componente em telas estreitas. Detalhes têm 50 origens por página, ordenação
estável por data/origem/ID e links para o histórico do título ou movimento.

Cards e evolução abrangem **todo o filtro**, independentemente da página de detalhes.
A RPC `public.fluxo_caixa` retorna até 366 agregados diários e 50 origens. A agregação ocorre
no Postgres em um snapshot da consulta, sem truncar as origens ao limite REST de 1.000 linhas.
Página excessiva é limitada à última existente.

## Permissões e dinheiro

Migration `20261013210457_fluxo_caixa.sql`. Função `STABLE SECURITY INVOKER`, `search_path`
fixo, somente `authenticated` pode executar. Verifica vínculo atual e conta por empresa;
as RLS das tabelas de origem permanecem ativas. Nenhuma tabela ou permissão de escrita nova.
Centavos somados em `numeric` no banco, devolvidos como texto; cálculo/agregação/formatação
na aplicação em `BigInt`. Nenhum cálculo monetário em ponto flutuante.

## Verificação

- `tests/fluxo-caixa.test.ts`: 3 testes de agrupamento, posições de saldo e valores além
  da precisão de Number.
- `scripts/db-test-fluxo.mjs`: 58 verificações financeiras, papéis, isolamento, conciliação,
  estorno, limites, paginação e mais de 1.000 origens; fixtures em transação revertida.
- `tests/e2e/fluxo-caixa.spec.ts`: valores na tela, filtros, agrupamento mensal, links de
  origem, conta arquivada, leitura, revogação, 404, paginação e largura móvel.
- `scripts/fluxo-fixture.mjs`: dados sintéticos compartilhados pelos testes; nenhuma fixture
  ou chave administrativa entra no código da aplicação.

Roteiro cumulativo: `testes-e2e-completo.md`, T079 e T093–T097. Resultados e data da execução
ficam no checkpoint desse arquivo.
