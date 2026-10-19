# Cadastros base

Dentro de uma conta, **Abrir cadastros** leva às categorias. As abas dão acesso a categorias,
centros de custo, clientes e fornecedores em `/empresas/[id]/cadastros/[tipo]`.

## Funcionalidades

- Criar, consultar e editar registros por empresa.
- Buscar pelo nome, filtrar ativos/arquivados/todos e paginar em blocos de 50.
- Arquivar e reativar; não há exclusão definitiva pela aplicação.
- Edições usam o timestamp do registro para recusar alterações sobre uma versão desatualizada.
- Proprietário, administrador, operador e contador completo escrevem. Leitura e contador
  leitura só consultam. As ações verificam o vínculo atual e o banco aplica as mesmas regras.

## Dados

| Cadastro | Campos |
|---|---|
| Categorias | Nome, receita/despesa, cor da paleta, custo fixo, categoria principal opcional |
| Centros de custo | Nome e descrição opcional |
| Clientes e fornecedores | Nome, CPF/CNPJ, e-mail, telefone, cidade, UF e observações; só nome obrigatório |

Categorias têm dois níveis: principal e subcategoria. O vínculo usa chave estrangeira composta
para impedir uma categoria principal de outra empresa. Principal e subcategoria devem ter o
mesmo tipo; categoria principal arquivada não pode ter subcategorias ativas. Arquivar as
subcategorias primeiro; reativar a principal antes de reativar uma subcategoria. Uma categoria
com subcategorias não pode virar subcategoria nem mudar de tipo. Categorias de despesa já
usadas em Contas a Pagar também não podem mudar para receita; categorias de receita usadas em
Contas a Receber não podem mudar para despesa, para preservar a classificação.

Custo fixo é uma flag de categoria de despesa, independente de recorrência. Ao escolher a
principal no formulário, tipo e flag são sugeridos a partir dela; a flag da subcategoria pode
ser ajustada. A escolha não cria lançamentos ou recorrências.

Nomes de categorias são únicos por empresa, tipo e nível/principal; nomes de centros de custo
são únicos por empresa, ignorando caixa e espaços externos. Documentos informados são únicos
por empresa em cada tabela de contato. Um contato pode existir como cliente e fornecedor.
As regras de unicidade também incluem arquivados para permitir reativação sem conflito.

Server Actions validam dígitos de CPF/CNPJ, formato do e-mail, telefone e UF. Documento e
telefone são armazenados sem pontuação; e-mail fica em minúsculas. O banco valida formatos,
tamanhos, unicidade e hierarquia. Cores são chaves da paleta, sem CSS arbitrário.

## Banco e segurança

Migration: `supabase/migrations/20261013144244_cadastros_base.sql`.
Complemento: `20261013164700_categorias_concorrencia.sql`, que bloqueia a categoria principal
durante alterações nas subcategorias para serializar criação/reativação com arquivamento.
Tabelas: `categorias`, `centros_custo`, `clientes` e `fornecedores`.
Cada tabela tem RLS e grants explícitos. INSERT/UPDATE concedidos só nas colunas necessárias;
ID, empresa e timestamps não podem ser alterados pelo usuário. DELETE não é concedido.
As ações derivam a empresa do contexto autenticado validado e gravam listas explícitas de campos.

Índices cobrem empresa/status/ordenação e unicidade. Todos os IDs têm unicidade composta com
empresa para futuras referências dos lançamentos. Triggers invoker com search_path vazio
validam hierarquia e atualizam timestamps; não há nova função definer nem uso de chave administrativa
na aplicação. Funções privadas de autorização são as da migration inicial.

## Escopo da entrega

Contas a Pagar e Receber já utilizam esses cadastros; consulte `docs/contas-pagar.md` e
`docs/contas-receber.md`. Importação em lote, produtos e contas bancárias seguem nas próximas entregas.
Categorias pai no seletor são carregadas até 1.000 opções; ampliar com busca dedicada se a
base crescer além desse volume. A listagem usa paginação para evitar corte silencioso de registros.

## Verificação

`npm test` cobre validação e normalização. `npm run test:db` cobre a fundação e os cadastros
com fixtures revertidas em transação. A suite de cadastros faz 285 verificações de papéis,
isolamento, grants, unicidade, hierarquia e revogação de escrita sem renovar token.
O teste de concorrência usa duas conexões e verifica as duas ordens de criação/arquivamento;
seus registros temporários são removidos ao final.

Checkpoint de 13/10/2026: nove testes unitários, 285 verificações de cadastros, 33 da fundação,
cinco de concorrência e fluxo completo de navegador passaram. Build, TypeScript e lint
validados; advisors de segurança sem alertas. Ambas as migrations aplicadas e registradas.

`npm run test:e2e` verifica os quatro cadastros, arquivamento/reativação, busca, paginação,
conflito de edição, consulta por leitor, escrita por operador e bloqueio de outra empresa.
Usuários e empresas temporários são removidos ao final. Captura em `test-results/cadastros.png`.
