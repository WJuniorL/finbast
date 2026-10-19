# Contas bancárias, importação e conciliação

**Abrir contas bancárias** dentro da empresa acessa `/empresas/[id]/bancos`.
Interface shadcn/ui com conta, extrato, prévia e histórico de conciliações.

## Conta e saldo

Nome, instituição, número da conta, saldo de abertura e data são obrigatórios.
Código do banco e agência são opcionais. Saldo pode ser positivo, zero ou negativo,
sempre em centavos. A data representa o **início do dia**: importe somente movimentos
dessa data em diante e até hoje, considerando `America/Bahia`.

Nome é único por empresa, ignorando caixa/espaços externos. Edição usa versão para
recusar sobrescrita. Depois de criar uma prévia, só o nome pode mudar: identificação,
saldo e data ficam preservados. Arquivar preserva o histórico e impede novas importações
e conciliações; reativar libera essas operações. Desfazer vínculo existente continua permitido.

Saldo do extrato = saldo de abertura + movimentos importados, independente de conciliação.
Cartões mostram toda a conta, enquanto filtros de data se aplicam à lista. Conta, movimentos
e histórico usam páginas de 50 registros. A conta mostra as últimas 20 importações.

## Importação

Arquivo de até **5 MB**, com **1–1.000 movimentos**. Upload é validado no servidor.
Rota POST verifica sessão, papel, origem da solicitação e corpo limitado a 6 MB, sem depender
da serialização de arquivos em Server Actions. Modelo usa download nativo do navegador.
Primeiro cria **prévia**; somente **Confirmar importação** grava movimentos e altera saldo.
Qualquer erro ou conflito de identificador recusa o lote inteiro, sem gravação parcial.
Arquivos brutos não são armazenados; ficam nome, formato, hash SHA-256, linhas normalizadas
e autoria/confirmação. A prévia é compartilhada com os usuários autorizados da empresa.

| Formato | Regras |
|---|---|
| CSV | Modelo com `data`, `descricao`, `valor`, `identificador`; separador ponto e vírgula, vírgula ou tabulação; aspas CSV; UTF-8 ou Windows-1252 |
| XLSX | Uma aba, mesmos cabeçalhos; datas Excel ou texto; valores simples em reais; sem fórmulas, macros, links ou vínculos externos |
| OFX | XML ou SGML, BRL, número da conta correspondente; código do banco correspondente quando informado; `DTPOSTED`, `TRNAMT`, `FITID`, `MEMO`/`NAME` |

CSV/XLSX: datas `dd/mm/aaaa` ou `aaaa-mm-dd`; textos monetários brasileiros, como `-1.234,56`.
Valores numéricos de Excel e decimais OFX são convertidos pelo texto decimal, sem arredondar
ponto flutuante para inventar centavos. **Positivo = entrada; negativo = saída; zero recusado.**
CSV/XLSX seguem os modelos baixáveis; não há mapeador genérico de colunas nesta entrega.
Os modelos usam a data de abertura da conta e contêm duas linhas fictícias que devem ser substituídas.

OFX exige uma identificação de conta e moeda, FITID por movimento e data válida. Não aceita
DOCTYPE, entidades externas ou CDATA. XLSX passa por validação do ZIP antes da leitura:
limites de 200 entradas, 20 MB por entrada e 50 MB descompactados, conferindo tamanho real;
XML com entidades/DOCTYPE ou mais de 10.000 células/strings por parte é recusado.

Deduplicação por conta:

- Com identificador/FITID: a mesma chave e mesmos dados são ignorados na reimportação.
- Mesma chave com data, valor ou descrição diferentes: conflito; o lote não é importado.
- Sem identificador: hash de data/descrição/valor mais ocorrência preserva linhas iguais
  do mesmo arquivo. Prévia avisa que extratos sobrepostos com movimentos idênticos exigem
  conferência; prefira identificadores do banco. Não há garantia de identificar sobreposição ambígua.
- Mesmo hash de arquivo retorna a prévia/lote já existente; confirmação repetida é idempotente.

## Conciliação

Vincula um movimento importado a uma **liquidação já registrada** em Pagar/Receber:
saída a lançamento pago, entrada a receita recebida, sempre na mesma empresa e com
valor absoluto exatamente igual ao líquido da baixa. Datas podem diferir por compensação;
a data da liquidação fica registrada. Os seletores mostram até 500 liquidações por módulo
com valores presentes na página; o banco recusa vínculos já usados ou incompatíveis.

Uma conciliação ativa por movimento e por lançamento. Não cria baixa, não transfere dinheiro,
não altera saldo e não movimenta dinheiro em nome do contador. **Desfazer conciliação** exige
motivo de 5–500 caracteres e preserva a baixa original. Histórico mostra vínculo, autoria,
data e motivo; há link para o histórico do lançamento financeiro.

Baixa conciliada não pode ser editada/estornada enquanto houver vínculo ativo: desfazer
a conciliação primeiro. O banco garante isso por trigger, inclusive em chamadas diretas
às RPCs. Conciliação/estorno concorrentes são serializados, sem vínculo ativo sobre baixa desfeita.

Nesta entrega, conciliação é integral **um movimento para um lançamento**. Divisão, agrupamento,
transferências entre contas, ajustes/deleção de movimentos e criação automática de lançamentos
a partir do extrato ficam para decisões posteriores.

## Permissões e segurança

Proprietário, administrador, operador e contador completo cadastram contas, importam,
conciliam e desfazem vínculos. Leitura e contador leitura só consultam; externo não acessa dados.
Revogação de escrita é verificada em cada ação/RPC. Chaves administrativas ficam nos scripts
de fixtures; a aplicação usa a sessão do usuário.

Migration `20261013190759_contas_bancarias_conciliacao.sql`: `contas_bancarias`,
`importacoes_bancarias`, `lancamentos_importados`, `conciliacoes`, `historico_conciliacoes`.
RLS e SELECT explícito em todas; sem INSERT/UPDATE/DELETE financeiros para clientes.
Wrappers públicos invoker chamam rotinas privadas autorizadas, com `search_path` vazio.
FKs compostas garantem empresa, índices cobrem referências e locks seguem conta → movimento →
liquidação. Eventos de uso registram conta, importação e conciliação; não há cobrança/cotas.

## Verificação

- `tests/bank-import.test.ts`: CSV, centavos, duplicidade, OFX XML/SGML, conta/moeda/entidade
  inválida, XLSX, fórmula, ZIP/tamanho adulterado e saldo negativo.
- `scripts/db-test-bancos.mjs`: 92 verificações de isolamento, papéis, prévia, deduplicação,
  conflito, saldo, conciliação, proteção da baixa, histórico e arquivamento.
- `scripts/db-test-bancos-concorrencia.mjs`: 18 verificações de importação repetida,
  conciliação simultânea e estorno/conciliação nas duas ordens.
- `tests/e2e/bancos.spec.ts`: fluxo de navegador dos três formatos, modelo, prévia, saldo,
  reimportação, inválidos, vínculos, bloqueio de estorno, contador, leitor, histórico,
  arquivamento/reativação, paginação, largura móvel e conta alheia.

Resultados efetivamente executados e pendências ficam em `testes-e2e-completo.md`.
Próxima etapa do plano: **Fluxo de caixa**.

Referências de formato: [Papa Parse](https://www.papaparse.com/docs),
[ExcelJS](https://github.com/exceljs/exceljs) e
[OFX Work Group](https://financialdataexchange.org/about-fdx/ofx-work-group/).
