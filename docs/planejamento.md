# Planejamento e Simulador

Abra **Abrir Planejamento** na empresa. Crie um cenário anual nomeado, adicione receitas e
despesas ao plano e use o botão **Simular** na própria grade. Cenários podem ser renomeados,
duplicados, arquivados e reativados. A cópia preserva as linhas e não copia fechamentos ou
convites. No mesmo ano, preserva associações de execução real; para outro ano, as linhas
voltam a ser novas estimativas. Alterar um cenário não altera o outro.

## Fontes e dinheiro

- **R — registrado:** ocorrências não canceladas de Pagar/Receber por vencimento, com valor
  original. Inclui o que já foi pago/recebido e o que segue aberto; títulos explicitamente
  vinculados a uma linha de plano deixam de compor R para não duplicar o orçamento.
- **P — plano:** linhas adicionais do cenário. Valor unitário em centavos × quantidade,
  receitas ou despesas, por mês/categoria/centro de custo. Total por linha até R$ 10 bilhões.
- **Executado:** pagamentos/recebimentos efetivos por data de liquidação, com encargos e
  descontos. Não se soma extrato novamente à execução dos títulos.
- **Fixos:** ocorrências de Pagar marcadas custo_fixo, já incluídas em R. Não são adicionadas
  novamente, nem deduzidas da recorrência. Só ocorrências já geradas participam.
- **Caixa base:** mesma projeção consolidada do Fluxo de caixa (extratos confirmados,
  baixas sem conciliação, abertos e vencidos anteriores). O plano é somado cumulativamente
  por mês somente para estimativas ainda não representadas por títulos vinculados;
  desligar a simulação mostra a base sem alterar qualquer registro.

Grade de 12 meses por tipo/centro/categoria. Valores da grade são distintos do caixa porque
usam vencimentos originais, enquanto o caixa usa movimentos e liquidações. Centavos em
bigint/numeric no Postgres, agregados como texto; soma e simulação em BigInt na aplicação.
Valores unitários e quantidades podem ser manuais ou enviados explicitamente pela página
de um produto. O envio cria/substitui até três linhas de receita/custo desse produto no
cenário, respeitando fechamentos e vínculos de execução. Alterar premissas do produto não
atualiza o plano automaticamente; consulte `docs/produtos.md`.

Compare posições mensais de caixa entre dois cenários da mesma empresa. Cenários de anos
diferentes comparam o mês do ano. Títulos/cadastros são do estado atual até fechar o mês;
isso não reconstrói automaticamente o planejamento que existia no passado.

## Fechar e reabrir

Somente meses anteriores ao mês atual de America/Bahia podem ser fechados. O fechamento
guarda fotografia da grade e da posição base de caixa daquele mês, com autor/data. Bloqueia
criação, edição, mudança de mês, exclusão e importação de planos que afetem esse mês.
Alterações posteriores nos títulos reais não mudam a fotografia. Outros cenários permanecem
independentes. O fechamento deste módulo não bloqueia operações em Pagar/Receber.

**Desvio = executado − (R + P)** salvo no fechamento. Para despesas, positivo significa
excesso; para receitas, positivo significa arrecadação maior. O desvio usa o plano salvo,
mesmo quando a camada de simulação está desligada. Reabrir exige motivo de 5–500 caracteres,
preserva o fechamento anterior no banco e volta a consultar os dados atuais. Fechar novamente
produz nova fotografia, sem sobrescrever a anterior.

## Quando o plano vira um título real

Use **Vincular execução** e selecione um título não cancelado da mesma empresa e tipo.
É uma relação de um título por linha e uma linha por título em cada cenário. Não há
correspondência automática por valor ou descrição, nem criação de títulos pelo planejamento.

A estimativa continua em P para orçamento/desvio; o título deixa de ser somado novamente
em R. A execução é atribuída à categoria/centro da linha planejada, na data efetiva da baixa,
sem alterar classificação ou datas do livro financeiro. O caixa já contém o título/movimento,
então essa linha deixa de ser adicional na simulação. Fixos registrados continuam informativos.

Vínculo bloqueia excluir a linha, trocar seu tipo ou substituir essa linha por importação
de nova revisão até desvincular explicitamente. Mês fechado bloqueia alterações do vínculo.
Cancelamento do título real faz o plano voltar a adicional nos meses abertos; a fotografia
fechada conserva os adicionais capturados e só muda após reabrir. Nenhuma destas operações
modifica Pagar/Receber. Se um título não está entre os 500 recentes, consulte o módulo financeiro.

## Líderes e revisão

Crie link individual com e-mail, centro de custo e validade de 1–7 dias. A chave de 256 bits
é mostrada uma vez; somente seu SHA-256 fica no banco. Compartilhamento é manual. O link
pode ser revogado; expiração, revogação e cenário arquivado bloqueiam acesso e novos envios.
Reativar o cenário respeita o prazo/revogação originais do link.

O líder confirma o destinatário por código recebido por e-mail. O formulário aceita 6–10
dígitos conforme a configuração do Auth; este ambiente gera oito. A identidade técnica fica no
Supabase Auth, sem cadastro de senha ou associação em usuarios_empresas. Ele vê somente
setor/ano/prazo, categorias de despesa e as próprias estimativas. Não recebe empresa_id,
outros setores, títulos, caixa, cenário completo ou acesso às tabelas financeiras.
Cada acesso/envio exige JWT com OTP recente (15 minutos), e-mail confirmado atual e link
válido. Sessão por senha ou e-mail de outro destinatário não autoriza o formulário.

Até 120 estimativas por envio, com mês, categoria, descrição e valor positivo. Pode enviar
lista vazia para declarar ausência de custos, reabrir e editar até o prazo. Cada envio gera
revisão e espelho imutável no histórico; campos de empresa/centro enviados pelo cliente são
ignorados, prevalecendo o centro do convite. Edição concorrente de revisão é recusada.

Financeiro consulta pendente/recebido/revisado. Marcar revisado não importa. **Importar
revisão** é explícito e substitui somente as linhas importadas do mesmo convite nesse
cenário; não acumula revisões duplicadas. Espelhos anteriores permanecem no histórico.
Nova revisão do líder não atualiza plano automaticamente; mês fechado impede substituição.
Contribuição já recebida pode ser revisada/importada pelo financeiro após expirar/revogar
o link, preservando a fotografia recebida e a necessidade de reabrir meses fechados.

## Permissões e consistência

Proprietário, administrador, operador e contador completo podem alterar; leitores consultam
e usam simulação local. Nenhuma operação cria, baixa, estorna ou cancela Pagar/Receber.
Categoria/tipo/centro por empresa são validados por RPC e FKs compostas. Arquivamento mantém
consulta e comparação, bloqueia alterações e desativa acesso dos líderes enquanto arquivado.

Migrations `20261014111152_planejamento.sql` e `20261014115150_planejamento_execucao.sql`:
seis tabelas com RLS e somente SELECT para
authenticated. Escritas por RPC autenticada, autorizada pelo vínculo atual. Definers ficam
no schema privado com search_path fixo e autorização interna; wrappers públicos invoker.
A pré-validação anônima retorna somente booleano para hash + e-mail, sem expor dados ou
conceder USAGE do schema privado ao papel anon (corpo SQL resolvido na definição).

Todas as alterações do cenário usam versão otimista e lock da linha do cenário. Convites
e envios seguem ordem cenário → convite. Criação/cópia têm pedido idempotente com lock por
empresa/pedido. Revogação e edição/fechamento são serializados, com revalidação após esperar.
Formulário de edição captura a versão ao abrir e recusa sobrescrita concorrente.

Listas: cenários, grupos da grade e linhas paginados em 50; agregados consideram todos.
Seletores mostram até 1.000 cadastros/cenários; contribuições e histórico exibem os últimos
50 registros. Espelhos antigos e fechamentos anteriores continuam persistidos com RLS.

## Verificação e pendência operacional

`tests/planejamento.test.ts`, `scripts/db-test-planejamento.mjs`,
`scripts/db-test-planejamento-concorrencia.mjs`, `tests/e2e/planejamento.spec.ts` e
`tests/e2e/planejamento-otp.spec.ts` cobrem
centavos, simulação, papéis, isolamento, cópia, versão, fechamento, revisão/importação,
revogação concorrente e jornada do líder com Auth real. Fixtures removidas/revertidas.
O teste específico de OTP também garante que o código completo seja enviado e que um erro
não apague o e-mail informado. Roteiro cumulativo: T081–T083 e T102–T107 em
`testes-e2e-completo.md`.

Auth deve ter SMTP do ambiente e template Magic Link com `{{ .Token }}`. O tamanho do código
segue a configuração do projeto; esta entrega não altera a configuração global do Auth.
A validação automatizada gera OTP pelo Admin sem enviar e-mail e confirma o código pelo
fluxo real de Auth; isso não comprova entrega na caixa postal. Entrega real/SMTP/template
continua pendência operacional já registrada em `docs/auth-empresas.md` e no plano.
