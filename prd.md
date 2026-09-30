# Finbast — PRD (resumo técnico)

> Documento de produto completo, com todo o histórico de decisões e o raciocínio comercial,
> vive em `C:\Projetos Claude\finbast\docs\PRD.md` (repositório do protótipo). Este arquivo é
> um resumo voltado a quem está codando aqui — se algo parecer contraditório, o PRD completo é
> a fonte da verdade; atualize os dois juntos.

## O quê e para quem

SaaS financeiro que substitui a planilha e o BPO financeiro de uma empresa. Núcleo: contas a
pagar/receber, conciliação bancária, fluxo de caixa, planejamento com simulador de cenário,
custos fixos, custo/precificação de produto, DRE e relatórios.

**MVP = uso interno, uma empresa só** (a própria dona do Finbast). Sem cobrança dentro do
sistema, sem gateway, sem plano — isso é fase 2, documentado mas não construído agora.

## Escopo do MVP

| Módulo | Status |
|---|---|
| Sub-contas (CNPJ/CPF) + usuários e permissões | Entra — base de tudo (RLS por `empresa_id`) |
| Contas a Pagar / Receber | Entra — baixa manual, sem emissão de boleto/PIX |
| Contas bancárias + conciliação | Entra — só por importação de arquivo (CSV/XLSX/OFX) |
| Fluxo de caixa | Entra |
| Planejamento e Simulador | Entra — o diferencial do produto |
| Custos fixos | Entra — flag na categoria, não é o mesmo que recorrência |
| Custo e precificação de produto | Entra — direto / compartilhado (rateio) / geral, nunca ratear geral na margem de contribuição |
| DRE e Relatórios | Entra — export CSV/XLSX |
| Cadastros (clientes, fornecedores, categorias, centros de custo) | Entra |
| Importação CSV/XLSX com planilha-modelo | Entra |
| Medição de uso (só o registro do evento) | Entra |
| "Botões de demanda" (registrar interesse em feature futura) | Entra — sem painel de gestão |
| Conta de Pagamento (BaaS), boleto/PIX, Open Finance, cobrança/planos | **Fase 2** |
| Painel do Contador, Assistente de IA | A avaliar — não presumir que entra |
| CRM, estoque, emissão de nota fiscal | **Nunca** — não é ERP |

## Regras de negócio que viram código

- **Aprovação de pagamento:** senha de 6 dígitos criada pelo usuário no primeiro pagamento —
  recusa sequência (123456) e repetição (111111). Troca só com código confirmado por e-mail.
  É uma credencial separada da senha de login.
- **Acesso do contador:** definido pelo cliente no convite, nas duas direções (cliente convida
  contador ou vice-versa). Dois níveis: Completo (lança/edita/concilia/fecha) ou Somente
  leitura. O contador **nunca** movimenta dinheiro, nem no nível Completo.
- **Sub-contas:** empresário cria pelo seletor de conta; permissão de usuário é por sub-conta
  (um funcionário de um CNPJ não vê o CPF do dono por padrão).
- **Custo de produto:** direto vai 100% pro produto; compartilhado é rateado por regra salva
  (percentual por categoria/fornecedor); geral (imposto, aluguel) fica fora da margem de
  contribuição por padrão — ratear geral no resultado do produto é a armadilha clássica do
  custeio por absorção, mostrar separado.
- **Planejamento:** uma aba só, três momentos do mesmo dado — cenário (real + camada de plano),
  contribuições dos líderes de setor (link individual, código por e-mail, nunca entra
  automático no cenário) e planejado × realizado depois que o mês fecha. Planejado nunca vira
  lançamento em Contas a Pagar.

## Fora de escopo — não construir sem decisão nova

Qualquer coisa que mova dinheiro de verdade (BaaS, PIX/boleto, Open Finance), qualquer tela de
preço/plano/assinatura, qualquer integração banco a banco (descartada — não escala; o caminho é
Open Finance quando a fase 2 chegar).
