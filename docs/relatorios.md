# DRE gerencial, relatórios e exportação

Na empresa, abra **Abrir DRE e Relatórios**. Consulte um período inclusivo de até 366 dias
entre 2000 e 2100. Valores em centavos, com agregação numeric no banco e texto/BigInt na aplicação.
Títulos cancelados ficam fora; arquivamento de cadastros preserva a leitura do histórico.

## Bases e DRE

- **Registrado por vencimento:** valor original dos títulos não cancelados, incluindo abertos
  e liquidados. Encargos de liquidação não entram nesta base.
- **Realizado por liquidação:** apenas títulos pagos/recebidos, pela data efetiva. Principal,
  juros, multa e desconto ficam separados, e a soma coincide com o valor efetivo da baixa.
- **DRE gerencial:** não é apuração contábil por competência; os títulos atuais não possuem
  data de competência contábil separada. Não se deduz competência pelo vencimento.
- Extratos, saldo inicial, conciliação e previsões de produtos não são somados aos títulos.
  Estorno faz o título sair do realizado enquanto não houver nova liquidação.

A DRE tem receita bruta, deduções, receita líquida, custos, lucro bruto, despesas operacionais,
resultado operacional, resultado financeiro, resultado antes dos tributos, tributos sobre
o resultado e resultado gerencial. Subtotais acumulam as linhas anteriores; não se deve somar
novamente os subtotais para obter o resultado final.

Despesas são negativas; receitas positivas. Desconto de despesa é positivo e desconto de
receita negativo. Juros, multa e desconto de liquidação entram no resultado financeiro;
o principal usa a classificação da categoria. Isso permite enxergar encargos sem repetir
o valor integral do título. Receita/despesa do recorte nos cartões são os valores líquidos
por natureza e podem diferir das linhas brutas da DRE.

## Classificação por categoria

Quatro papéis podem classificar: proprietário, administrador, operador e contador completo.
Leitura e contador leitura consultam e exportam. Categoria de receita admite receita bruta
ou financeiro; de despesa admite deduções, custos, operacionais, financeiro ou tributos.
Não há classificação presumida por nomes como imposto, juros ou antecipação.

Subcategoria herda a classificação do ancestral mais próximo, salvo sua própria definição.
Sem definição, receitas usam receita bruta e despesas usam operacionais. **Herdar / padrão**
remove a definição explícita, mas mantém a versão para recusar edições antigas. Definição
incompatível com o tipo atual da categoria não é aplicada. Categorias arquivadas podem ser
classificadas para permitir análise dos títulos antigos.

Classificação é gerencial e recalcula os períodos consultados. Não altera título, categoria,
caixa, custeio de produtos nem fotografia de mês fechado no Planejamento. Cada alteração tem
autor, data e pedido no histórico; apenas os últimos 50 eventos são exibidos.

## Visões e filtros

- **Por categoria/subcategoria:** consolidação pela categoria exata. O filtro pode incluir
  descendentes ou somente a categoria. Detalhar um grupo aplica somente a categoria daquele
  grupo, para que as origens coincidam com o valor clicado.
- **Por centro:** inclui opção Sem centro; não atribui centro presumido.
- **Por fornecedor / funcionário:** somente despesas. Para analisar uma pessoa, ela precisa
  estar cadastrada como fornecedor; não há cadastro de RH nem inferência pelo nome.
- **Por produto:** usa os mesmos vínculos/rateios de Produtos e inclui avulsos analíticos
  pela data informada, nas duas bases. Mostra direto, compartilhado, geral separado e margem
  de contribuição. Gerais não entram na margem; não há rateio geral opcional nesta vista.
  A opção de gerais por receita continua na página de Produtos.
- **Juros, multas e descontos:** exige realizado e exclui principal. Pode filtrar um componente.
  Tarifas/antecipação lançadas como títulos são analisadas por sua categoria/subcategoria.
- **Planejado × realizado:** usa a grade do cenário existente, descrita abaixo.

Filtros de categoria, centro, fornecedor, produto, grupo DRE e componente podem ser combinados.
Fornecedor sempre recorta despesas. Os cartões/linhas passam a representar esse recorte,
não o resultado de toda a empresa. **Sem produto** inclui receitas não vinculadas e custos
gerais sem produto; não significa custo zero. Referências de outra empresa ou inválidas
não são aceitas. Seletores oferecem até 1.000 registros, inclusive arquivados.

Produtos rateados geram parcelas por produto/componente. O líquido por produto coincide com
o custeio existente. Desconto é dividido primeiro sobre as parcelas líquidas; juros sobre o
bruto reconstruído; multa sobre a capacidade restante. Cada divisão usa quociente inteiro,
maiores resíduos e desempate UUID; principal é o saldo. Isso preserva os totais por origem e
por produto sem principal negativo, inclusive em distribuições de poucos centavos.

Avulsos entram somente na vista de produto. DRE e demais visões financeiras excluem esses
custos sem título. Um filtro de categoria/centro/fornecedor também exclui avulsos sem essa
dimensão. Premissas de preço/volume não são receitas/despesas realizadas.

## Planejado × realizado

Escolha cenário e meses completos do mesmo ano. Filtros de categoria/descendentes e centro
são aceitos; produto, fornecedor, grupo DRE e componente não se aplicam à grade agregada.
A base registrada/realizada escolhida no formulário não altera essa grade: ela compara
**planejado = R + P** com execução por liquidação, respeitando vínculos de execução.

Meses fechados usam as fotografias existentes, mesmo se títulos mudarem posteriormente.
Reabrir no Planejamento volta a consultar valores atuais. Desvio = executado − planejado;
positivo em despesa indica excesso. A grade é distinta de posição de caixa e não é DRE.
Não há exportação bruta de títulos a partir dessa fotografia; use uma vista financeira
para exportar as origens atuais.

## CSV e XLSX

**Relatório formatado:** CSV contém a tabela principal (DRE, agrupamento ou comparativo).
XLSX inclui parâmetros, tabela principal e origens/componentes, quando aplicável. Todos os
grupos e origens considerados são incluídos, além da página exibida.

**Bruto:** consolida cada origem em uma linha, sem repetir títulos por rateio/componente.
Inclui valor filtrado com sinal e os valores integrais originais de principal, encargos e
total. Com filtro de produto/componente, o valor filtrado pode ser apenas parte da origem;
os campos integrais continuam sendo os do título completo. Na planilha de componentes, os
campos integrais se repetem por parcela e são referência, não novos movimentos a somar.

CSV em UTF-8 com BOM, delimitador `;`, aspas escapadas e CRLF. Campos com aparência de fórmula
recebem apóstrofo de proteção, inclusive depois de espaços/controles; literais numéricos
negativos são preservados. O arquivo mantém centavos/reais em representação decimal exata.
Ao importar CSV em planilha, escolha texto para colunas monetárias se precisar preservar
todos os dígitos; abrir CSV diretamente pode aplicar conversões do programa utilizado.
XLSX grava valores monetários como células de texto, inclusive acima da precisão de Number.
Textos não se tornam fórmulas nem hyperlinks. Não há fórmulas calculadas nos arquivos.

Sem cota, cobrança ou bloqueio comercial no MVP. Bruto não registra consumo. Formatado registra
um evento por pedido, com formato, filtros, autor e empresa; repetir o mesmo pedido não duplica
o evento. Outro conteúdo/autor/empresa no mesmo pedido é recusado. O evento comprova preparo
autorizado da resposta, não que o usuário salvou o arquivo no dispositivo.

Arquivos são gerados no servidor, de modo síncrono, sem Storage ou links públicos. Cada
exportação faz uma consulta integral em um snapshot de leitura, usando o mesmo motor da tela.
Não pagina por REST nem trunca em 1.000 linhas. Geração usa memória e tempo proporcionais ao
recorte; não há job assíncrono persistido. Respostas são `private, no-store`, com tipo e nome
de arquivo fixados a partir de parâmetros validados. O vínculo é revalidado após preparar
o arquivo. Sem service role na aplicação; chaves administrativas só nas fixtures E2E.

## Banco e verificação

Migration `20261015123917_dre_relatorios.sql`: três tabelas com RLS, somente SELECT para membros
e escrita por RPC autorizada. Leituras públicas invoker respeitam RLS das fontes. Definers
privados têm search_path fixo e conferem o vínculo atual. Configuração por categoria tem versão
otimista, lock consistente e pedidos idempotentes; exportação concorrente com mesmo pedido
registra um evento. Leitor/contador leitura podem registrar apenas esse evento de download.

Grupos, origens e classificações têm páginas independentes de 50 registros. Agregados consideram
todas as linhas. Histórico mantém todas as alterações, exibindo as últimas 50. Não há mutações
financeiras, migração de saldos, alteração de PIN ou envio de e-mail nesta etapa.

Testes: `tests/relatorios.test.ts`, `scripts/db-test-relatorios.mjs`,
`scripts/db-test-relatorios-concorrencia.mjs` e `tests/e2e/relatorios.spec.ts`.
Roteiro cumulativo e evidências em `testes-e2e-completo.md`.
