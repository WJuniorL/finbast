# Custo e precificação de produto

Na empresa, abra **Abrir produtos e custos**. O módulo oferece custeio analítico por período
e premissas de preço/volume por produto. Não controla estoque, emite notas ou movimenta dinheiro.

## Fontes e margem

- **Registrado:** títulos não cancelados de Pagar/Receber por vencimento, pelo valor original,
  inclusive abertos e já liquidados. Não representa apuração contábil por competência.
- **Realizado:** apenas títulos liquidados, pela data efetiva e valor com encargos/descontos.
  Conciliação/extrato não são somados novamente.
- **Avulsos:** custos analíticos diretos por produto e data, presentes nas duas bases.
  Não geram título ou baixa. Evite cadastrar avulso para um custo já registrado em Pagar.
- **Receita por produto:** vínculo individual de uma ocorrência de Receber a um produto.
  Receitas não vinculadas aparecem separadas, sem atribuição presumida por descrição/cliente.

**Margem de contribuição = receita − diretos − compartilhados.** Custo geral permanece fora
dessa margem. A opção **Mostrar gerais por receita** distribui os gerais proporcionalmente à
receita do período, inclusive a parcela de receita sem produto. A parcela sem produto fica
em **Gerais sem alocação**; sem receita, nenhum geral é distribuído. Resultado após gerais é
mostrado separado da margem, que permanece igual ao ligar/desligar a opção.

O módulo consulta o estado atual dos títulos, vínculos e regras. Alterar/arquivar uma regra
recalcula os períodos consultados; não há fechamento ou fotografia histórica do custeio.
Não há efeito nas fotografias já fechadas do Planejamento. Produtos arquivados preservam
receitas e custos associados; novos vínculos exigem produto ativo.

## Direto, compartilhado e geral

Em **Classificar lançamentos existentes**, selecione Despesas ou Receitas. A classificação
de despesa é por ocorrência, sem alterar seus valores, categoria, fornecedor, datas ou baixas.
Ordem de resolução:

1. Classificação explícita: direto (100% para um produto), compartilhado (regra escolhida)
   ou geral. Escolher **Automático** remove essa exceção da ocorrência.
2. Regra automática ativa para o fornecedor.
3. Regra automática ativa para a categoria exata (não inclui subcategorias implicitamente).
4. Geral quando não há classificação nem regra aplicável.

Regras têm nome e um critério: categoria de despesa **ou** fornecedor. Há uma regra ativa por
critério em cada empresa. O rateio admite 1–200 produtos ativos distintos, soma exata de 100%
e até duas casas decimais no percentual (pontos-base inteiros). Aplica-se automaticamente a
todas as ocorrências que atendam ao critério, incluindo parcelas e recorrências já geradas
ou geradas depois. A ocorrência não precisa receber uma cópia manual da regra.

Arquivar regra remove sua aplicação automática. Vínculos explícitos anteriores continuam
usando a regra salva, inclusive arquivada; novos vínculos exigem regra ativa. Editar os pesos
recalcula também esses vínculos. Para editar destinos de uma regra, os produtos devem estar ativos.

Dinheiro usa bigint/numeric em centavos; percentuais são inteiros de 0–10.000. A divisão
usa quociente inteiro e distribui o resto aos maiores resíduos, com desempate por UUID.
O total repartido sempre coincide com a origem. Por exemplo, R$ 1,01 em 40/35/25% resulta
em R$ 0,41/R$ 0,35/R$ 0,25. Totais agregados chegam como texto e são exibidos com BigInt.

## Preço e volume

Cada produto salva preço unitário, volume esperado, custo variável unitário, custo do
projeto e margem alvo. Valores até R$ 10 bilhões; volume de 1–1.000.000; totais previstos
de receita e custo também limitados a R$ 10 bilhões; margem alvo abaixo de 100%.
O custo do projeto é uma estimativa específica do produto, não um rateio automático do geral.

Na página do produto:

- Receita estimada = preço × volume.
- Custo estimado = custo variável unitário × volume + custo do projeto.
- Contribuição estimada = receita estimada − custo estimado.
- Preço para margem alvo = teto em centavos de custo estimado ÷ volume ÷ (1 − margem).
- Volume de equilíbrio = teto de custo do projeto ÷ (preço − custo variável unitário).
  Se o preço não cobre o custo variável e há custo de projeto, não há equilíbrio. Sem
  custo de projeto e sem perda por unidade, o mínimo é zero; com perda, não há equilíbrio.

Essas premissas não substituem o custeio dos títulos. Exemplo: custo unitário R$ 1,01,
projeto R$ 5,00, preço R$ 5,00, três unidades e margem alvo 20% produzem receita R$ 15,00,
custo R$ 8,03, contribuição R$ 6,97, preço alvo R$ 3,35 e equilíbrio em duas unidades.

## Enviar projeção ao Planejamento

Na página do produto ativo, escolha cenário, mês, categorias de receita/despesa e centro
opcional. O envio explícito cria até três linhas: receita (preço × volume), custo variável
(unitário × volume) e custo do projeto. Partes de valor zero são omitidas. O simulador de
caixa existente passa a usar essas linhas; não há um segundo motor de caixa. Se um título
financeiro já representa uma estimativa enviada, use **Vincular execução** no Planejamento
para retirá-la dos adicionais de caixa. O envio não associa títulos automaticamente.

Reenviar substitui somente as linhas originadas desse produto no cenário, sem acumular
projeções anteriores, inclusive quando muda o mês. Alterar as premissas do produto não muda
o cenário até reenviar. Edições manuais nessas linhas serão substituídas no reenvio.
Mês fechado na projeção anterior ou no destino e linha com execução real vinculada bloqueiam
a substituição; reabra/desvincule no Planejamento antes de reenviar. Outras linhas permanecem.

Cópias de cenário preservam a identificação de produto/parte; reenviar na cópia também
substitui suas linhas sem duplicar. Origens são independentes por cenário. Aplicam-se as
regras existentes de cópia de vínculos no mesmo ano. Nenhum envio cria Pagar/Receber.

## Permissões, consistência e limites

Proprietário, administrador, operador e contador completo podem alterar. Leitura e contador
leitura consultam margem e simulação salva. Autorização usa o vínculo atual, sem service role
na aplicação. FKs compostas e RLS protegem todas as referências por empresa.

Migration `20261014134626_produtos_custeio.sql`: oito tabelas com RLS/SELECT para membros,
escritas somente por RPC autorizada, histórico imutável e eventos de uso. Não há exclusão
definitiva na UI. Configuração por empresa tem versão otimista; edição captura a versão ao
abrir. Pedidos têm UUID/hash para repetição idempotente; dados diferentes no mesmo pedido
são recusados. Regras e seus itens são gravados na mesma transação, sem visibilidade parcial.

Escritas seguem configuração de custeio → cenário; alterações concorrentes com mesma versão
têm um vencedor. Fechamento concorrente e projeção respeitam o lock/versão do cenário nas
duas ordens. Definers privados têm search_path fixo e autorização interna; wrappers públicos
são invoker. Leituras usam RLS, agregados e paginação no banco.

Período inclusivo de até 366 dias entre 2000 e 2100. Produtos, regras, origens e avulsos em
páginas de 50; totais consideram todas as origens. Seletores oferecem até 1.000 registros
ativos; histórico exibe os últimos 50 eventos, mantendo todos no banco. A lista inclui
produtos arquivados para preservar a leitura das margens. Consulte mais páginas para editar
um produto fora dos seletores atuais.

Verificação: `tests/produtos.test.ts`, `scripts/db-test-produtos.mjs`,
`scripts/db-test-produtos-concorrencia.mjs`, `tests/e2e/produtos.spec.ts`.
Roteiro cumulativo e evidências em `testes-e2e-completo.md`.
