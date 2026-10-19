# Prévia do novo inbox

Proposta visual solicitada em 16/10/2026 para o inbox do **Estallo CRM**, mantida como artefato independente neste workspace. Não adiciona um módulo de atendimento ao Finbast e não altera o repositório `estallo-crm`.

Abra `public/previews/inbox-layout.html` no navegador. O visualizador permite alternar o tamanho real do viewport interno entre desktop, notebook e tablet, incluindo retrato. Os arquivos JS, CSS, fontes e imagens são locais; preserve a pasta de assets ao copiar o HTML.

Para abrir por HTTP local:

```powershell
node previews/inbox-layout/serve.mjs
```

URL: `http://localhost:4173/inbox-layout.html`. A tela também pode ser aberta diretamente, sem o visualizador, em `http://localhost:4173/inbox-layout/chat.html`.

## Comportamento por tamanho

| Tela | Referência | Organização |
| --- | --- | --- |
| Desktop | 1920 × 1080 | Lista de 360 px, conversa flexível e ficha original de 320 px, ajustável pela divisória. A ficha pode ser recolhida. |
| Notebook | 1366 × 768 | Lista de 336 px e conversa ampla. Ao abrir, a ficha de 296 px fica ao lado da conversa e também pode ser esticada. |
| Tablet horizontal | 1024 × 768 | Lista de 300 px, conversa flexível e ficha sob demanda. |
| Tablet vertical | 768 × 1024 | Conversa ocupa a largura. Lista e ficha abrem em painéis independentes. |

A navegação Fila, Pendentes, Automático, Todas e Fechadas fica **dentro da lista de conversas**. O cabeçalho global permanece separado, com organização, busca do sistema, avisos e usuário. `TopBar`, `TenantSwitcher`, `SearchTrigger`, `UserMenu` e a navegação `Sidebar` usam os componentes originais do CRM, com dados demonstrativos.

O botão ao lado da busca de contatos reúne Minhas, Não lidos, Grupos, tags com combinação E/OU e número de WhatsApp. Filtros aplicados aparecem como chips removíveis e contador no botão.

Cada conversa tem três níveis: nome/horário da última mensagem; prévia; posição explícita na fila e tempo de espera. O horário de espera não aparece repetido à direita. Fixar prioriza apenas a exibição e preserva a posição real na fila. O menu da seta mantém fixar/desafixar, não lida, limpar e apagar.

Assumir/liberar e fechar/reabrir são as ações principais. Transferência, lembrete, contato pessoal, controle do automático e chamadas ficam no menu de três pontos. Busca nas mensagens, resposta citada, resposta/nota interna, rascunho por contato, anexos, emoji, áudio de exemplo e assistente de escrita continuam acessíveis.

Os balões recebidos e enviados se alinham às bordas úteis do chat, com cerca de 20 px de margem. A conversa não usa mais um miolo central limitado a 960 px.

## Redimensionamento da ficha

Arraste a divisória à esquerda da ficha para aumentar ou diminuir sua largura. No desktop e notebook, o chat e, quando necessário, a lista se reajustam durante o movimento. A lógica original de `lib/inbox/larguras-do-inbox.ts` é reutilizada: ficha de 260 a 560 px, lista de pelo menos 240 px e piso de 420 px para a conversa quando houver espaço. O cabeçalho e o compositor também respondem à largura efetiva do chat por container queries.

As teclas ←/→ ajustam 16 px por vez, Home/End vão aos limites e o duplo clique restaura a largura padrão. A preferência fica no navegador por faixa de tela, em chaves exclusivas da prévia; não altera preferências do CRM real. Sem acesso ao armazenamento, continua funcionando na sessão.

No tablet, a ficha continua como painel sobreposto; sua largura também pode ser ajustada. Abaixo de 1280 px, a ficha não comprime a conversa ao ser aberta.

## Ficha lateral original

`build.mjs` lê `C:/Projetos Claude/estallo-crm` (ou `INBOX_SOURCE_REPO`) e copia **sem editar o conteúdo** `CRMSidePanel.tsx`, `LeadEnrichment.tsx`, `BlocoRecolhivel.tsx`, a casca do sistema (`TopBar`/`Sidebar`), as regras de largura, suas primitivas visuais e dependências locais. As cópias estão em `source/` com extensão `.txt` para não entrarem na compilação TypeScript do Finbast.

O bundle usa o JSX original, as classes originais, os tokens de `app/globals.css`, Manrope e os mesmos ícones. A lista completa dos arquivos copiados e respectivos hashes SHA-256 está em `public/previews/inbox-layout/source-manifest.json`. O CSS novo usa nomes `pv-` e não redesenha os blocos originais. `sidebar-original.html` renderiza a ficha isoladamente como referência.

`sidebar-adapters.tsx.txt` substitui somente as fronteiras externas: sessão, dados e destinos de ações que dependem do sistema. Os dados são demonstrativos. Formulários externos de lead/tarefa e navegação para outras páginas exibem aviso de simulação. Ações de conversa, arquivos, IA e áudio são exemplos locais: não enviam mensagens, gravam microfone, fazem chamadas, consultam IA ou alteram banco. Recarregar a tela restaura os exemplos; o recolhimento das seções originais usa a memória local do próprio componente.

Licença MIT do código de origem e licença da fonte acompanham os assets.

## Verificação

```powershell
node previews/inbox-layout/build.mjs
node previews/inbox-layout/verify.mjs
```

O primeiro comando regenera os assets usando as dependências locais já instaladas. O segundo abre o Microsoft Edge com Playwright, confere as cópias contra os hashes e o código de origem, compara os pixels da ficha com a referência isolada e verifica os layouts e fluxos simulados. Evidências e medidas ficam em `public/previews/inbox-layout/verification.json`, acompanhadas das capturas de tela.

Essas verificações validam a **prévia**. Não representam integração funcional ou execução E2E do Estallo CRM em produção.

Rodada inicial de 16/10/2026: 19 grupos de verificações aprovados, antes da inclusão da casca global do sistema.

Revisão de 16/10/2026: **24 grupos aprovados**, 58 arquivos originais conferidos e ficha idêntica em pixels à referência isolada no desktop. Inclui arraste real no desktop/notebook, ajuste do chat, limites, teclado, restauração, memória por faixa, armazenamento bloqueado, balões nas bordas e separação entre busca global e categorias do inbox. Nenhum erro de página ou pedido a serviço externo. Com o cabeçalho e a navegação globais presentes, a área de mensagens no notebook mede 934 × 491 px com a ficha recolhida. Lint dos scripts passou. O registro está no roteiro cumulativo `testes-e2e-completo.md`, separado dos cenários financeiros.

Conferência automatizada adicional por HTTP local: página respondeu 200; arrastar no visualizador com escala ampliou a ficha de 320 para 500 px; duplo clique restaurou 320 px. Abrir a ficha no preset Notebook confirmou o encaixe ao lado do chat, sem sobreposição. Nenhum erro de página nessa conferência.
