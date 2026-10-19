/* Interactive design preview. All state stays in this tab; no backend requests. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const icon = name => `<svg class="pv-icon" aria-hidden="true"><use href="#pv-${name}"/></svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const seed = [
    ['Alexandre Coelho Nunes','AN','sand','Perfeito, aguardo. Obrigado!','09:18',21,'queue',0,['cliente','interesse em iphone'],'commercial'],
    ['Sara da Silva Moraes','SM','rose','Certo, obrigada pelo retorno!','09:12',20,'queue',0,['cliente'],'commercial'],
    ['Luis Pacheco','LP','sky','Gostaria de saber mais sobre os seminovos.','09:08',20,'queue',0,['interesse em iphone'],'commercial'],
    ['João Victor Ferraz','JF','sage','Vocês fazem entrega?','08:56',19,'queue',0,['cliente','retorno'],'support'],
    ['Yanca','YA','lilac','Preto','08:42',19,'queue',0,['interesse em iphone'],'commercial'],
    ['Ingrid Fagundes','IF','sand','Consegue verificar pra mim?','08:35',18,'queue',5,['retorno'],'support'],
    ['Raphael Rodrigues','RR','sky','Pode me mandar as opções disponíveis?','08:21',18,'queue',1,[],'commercial'],
    ['Equipe · Atendimento','EA','sage','Marina: reunião às 14h, combinado?','08:10',17,'queue',3,[],'support',true],
    ['Marina Costa','MC','rose','Gostei dessa opção!','09:25',0,'mine',2,['cliente'],'commercial'],
    ['Carlos Almeida','CA','sand','Vou confirmar o pagamento.','09:20',0,'mine',0,['cliente','retorno'],'commercial'],
    ['Fernanda Souza','FS','lilac','Podemos conversar amanhã?','09:05',0,'mine',1,['retorno'],'support'],
    ['Rafael Lima','RL','sky','Qual o horário de funcionamento?','09:22',0,'auto',0,[],'commercial'],
    ['Ana Beatriz','AB','sage','Quais formas de pagamento vocês aceitam?','09:15',0,'auto',0,['cliente'],'commercial'],
    ['Bruno Santos','BS','sand','Tudo certo, muito obrigado!','Ontem',0,'closed',0,['cliente'],'support'],
    ['Camila Oliveira','CO','rose','Até a próxima!','Ontem',0,'closed',0,[],'commercial'],
  ];
  const contacts = seed.map((c, index) => ({
    id: index + 1, name: c[0], initials: c[1], color: c[2], preview: c[3], time: c[4], hours: c[5],
    state: c[6], unread: c[7], tags: c[8], number: c[9], group: !!c[10], pinned: false,
    phone: index === 0 ? '+5577991685086' : `+557799999${String(101 + index).padStart(4, '0')}`,
    owner: c[6] === 'mine' ? 'Juliana' : null, queuePosition: index + 1, pending: [5,6,8,10].includes(index),
    draft: '', mode: 'reply', messages: null, reminder: null, attachment: null,
  }));
  const tabs = [ ['queue','Fila'], ['pending','Pendentes'], ['auto','Automático'], ['all','Todas'], ['closed','Fechadas'] ];
  const emptyFilters = () => ({ mine: false, unread: false, groups: false, tags: [], number: 'all', tagMode: 'and' });
  let filters = emptyFilters();
  let selectedId = 1;
  let activeTab = 'queue';
  let search = '';
  let replying = null;
  let messageSearch = '';
  let popupTrigger = null;
  let activePopup = null;
  let menuItems = [];
  let menuContact = null;
  let modalAction = null;
  let modalFocus = null;
  let toastTimer;
  let recording = false;
  let drawerFocus = null;
  let resizeDrag = null;
  let detailsWidth = 320;
  const widthPreferences = new Map();
  const app = $('#pv-app');
  const dialog = $('#pv-modal');
  const menu = $('#pv-floating-menu');
  const input = $('#pv-message-input');
  const desktop = () => window.innerWidth >= 1600;
  const canDock = () => window.innerWidth >= 1280;
  const portrait = () => window.innerWidth <= 850;
  const widthBand = () => desktop() ? 'desktop' : canDock() ? 'notebook' : 'tablet';
  const defaultDetailsWidth = () => desktop() ? 320 : canDock() ? 296 : 340;
  const defaultListWidth = () => desktop() ? 360 : innerWidth > 1100 ? 336 : 300;
  const dockedDetails = () => canDock() && (desktop() ? !app.classList.contains('pv-hide-details') : app.classList.contains('pv-show-details'));
  const current = () => contacts.find(c => c.id === selectedId);
  const localTime = () => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());

  function getMessages(c) {
    if (c.messages) return c.messages;
    c.messages = c.id === 1 ? [
      { id: 'a1', side: 'in', text: 'Bom dia', time: '12:13', day: 'Ontem' },
      { id: 'a2', side: 'in', text: 'Posso levar fazer uma pergunta', time: '12:13', day: 'Ontem' },
      { id: 'a3', side: 'out', text: 'Bom dia Alexandre', time: '12:34', day: 'Ontem', author: 'Celular' },
      { id: 'a4', side: 'out', text: 'Até 2', time: '12:34', day: 'Ontem', quote: 'Posso levar fazer uma pergunta', author: 'Celular' },
      { id: 'a5', side: 'in', text: 'Boa tarde! Vocês ainda têm o iPhone 15 Pro?', time: '09:12', day: 'Hoje' },
      { id: 'a6', side: 'out', text: 'Olá, Alexandre! Temos sim 😊 Você prefere qual capacidade?', time: '09:14', day: 'Hoje' },
      { id: 'a7', side: 'in', text: '256 GB. Tem na cor preta?', time: '09:15', day: 'Hoje' },
      { id: 'a8', side: 'out', text: 'Sim! Vou conferir a disponibilidade para você.', time: '09:17', day: 'Hoje' },
      { id: 'a9', side: 'in', text: c.preview, time: c.time, day: 'Hoje' },
    ] : [
      { id: `c${c.id}-1`, side: 'in', text: `Olá! ${c.group ? 'Tudo bem, equipe?' : 'Gostaria de uma informação.'}`, time: '08:00', day: 'Hoje' },
      { id: `c${c.id}-2`, side: 'out', text: `Olá${c.group ? ', pessoal' : ', ' + c.name.split(' ')[0]}! Como podemos ajudar?`, time: '08:01', day: 'Hoje' },
      { id: `c${c.id}-3`, side: 'in', text: c.preview, time: c.time, day: 'Hoje' },
    ];
    return c.messages;
  }
  function matches(c, f = filters, term = search) {
    if (term && !fold(c.name + ' ' + c.phone).includes(fold(term)) && !c.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '__none__')) return false;
    if (f.mine && c.owner !== 'Juliana') return false;
    if (f.unread && !c.unread) return false;
    if (f.groups && !c.group) return false;
    if (f.number !== 'all' && c.number !== f.number) return false;
    if (f.tags.length && !(f.tagMode === 'and' ? f.tags.every(tag => c.tags.includes(tag)) : f.tags.some(tag => c.tags.includes(tag)))) return false;
    return true;
  }
  function inTab(c, tab) {
    if (tab === 'all') return true;
    if (tab === 'pending') return c.pending && c.state !== 'closed';
    return c.state === tab;
  }
  function filtered(tab = activeTab, f = filters) {
    return contacts.filter(c => !c.personal && inTab(c, tab) && matches(c, f)).sort((a,b) => Number(b.pinned) - Number(a.pinned) || a.id - b.id);
  }
  function filterEntries() {
    return [
      ...(filters.mine ? [['mine','Minhas']] : []), ...(filters.unread ? [['unread','Não lidos']] : []),
      ...(filters.groups ? [['groups','Grupos']] : []), ...filters.tags.map(tag => [`tag:${tag}`, tag]),
      ...(filters.number !== 'all' ? [['number', filters.number === 'commercial' ? 'Comercial' : 'Suporte']] : []),
    ];
  }
  function renderTabs() {
    $('#pv-categories').innerHTML = tabs.map(([key,label]) => `<button class="pv-category" role="tab" id="pv-tab-${key}" aria-selected="${key === activeTab}" tabindex="${key === activeTab ? 0 : -1}" data-tab="${key}" aria-controls="pv-contact-list">${label}<span class="pv-category-count">${filtered(key).length}</span></button>`).join('');
  }
  function renderList() {
    contacts.filter(c => !c.personal && c.state === 'queue').forEach((c,index) => { c.queuePosition = index + 1; });
    renderTabs();
    const shown = filtered();
    $('#pv-result-count').textContent = `${shown.length} ${shown.length === 1 ? 'conversa' : 'conversas'}`;
    $('.pv-queue-help').hidden = activeTab !== 'queue';
    const chips = filterEntries();
    $('#pv-active-filters').hidden = !chips.length;
    $('#pv-active-filters').innerHTML = chips.map(([key,label]) => `<button class="pv-filter-chip" data-remove-filter="${escape(key)}" aria-label="Remover filtro ${escape(label)}">${escape(label)}${icon('close')}</button>`).join('');
    $('#pv-filter-count').hidden = !chips.length;
    $('#pv-filter-count').textContent = chips.length;
    $('#pv-filter-trigger').classList.toggle('pv-has-filters', !!chips.length);
    $('#pv-contact-list').innerHTML = shown.map(c => `<article class="pv-conversation ${c.id === selectedId ? 'pv-selected' : ''} ${c.unread ? 'pv-is-unread' : ''}" data-contact="${c.id}">
      <button class="pv-open-conversation" data-open="${c.id}" aria-label="Abrir conversa com ${escape(c.name)}" ${c.id === selectedId ? 'aria-current="true"' : ''}>
        <span class="pv-avatar pv-${c.color}">${c.group ? icon('users') : c.initials}<span class="pv-channel-badge">${icon('whatsapp')}</span></span>
        <span class="pv-contact-copy"><span class="pv-contact-name-row"><span class="pv-contact-name">${escape(c.name)}</span>${c.pinned ? `<span class="pv-pin-indicator" title="Conversa fixada">${icon('pin')}</span>` : ''}</span><span class="pv-message-preview">${escape(c.preview)}</span><span class="pv-operational">${c.state === 'queue' ? `<span class="pv-position" title="Posição na fila de atendimento">${c.queuePosition}º na fila</span><span class="pv-operational-separator">·</span><span>Espera de ${c.hours}h</span>` : c.state === 'auto' ? `${icon('robot')}Atendimento automático` : c.state === 'closed' ? 'Conversa fechada' : `Com ${escape(c.owner || 'a equipe')}`}</span></span>
      </button><time class="pv-row-time" title="Horário da última mensagem">${escape(c.time)}</time><button class="pv-row-menu" data-row-menu="${c.id}" aria-label="Ações da conversa com ${escape(c.name)}" aria-haspopup="menu" aria-controls="pv-floating-menu" aria-expanded="false">${icon('down')}</button>${c.unread ? `<span class="pv-unread-count" aria-label="${c.unread} mensagens não lidas">${c.unread}</span>` : ''}
    </article>`).join('') || `<div class="pv-empty">${icon('search')}<strong>Nenhuma conversa encontrada</strong>Experimente outra categoria ou ajuste os filtros.<button class="pv-button pv-secondary" data-command="clear-filters">Limpar filtros</button></div>`;
  }
  function emitContact() {
    const c = current();
    const conversation = c ? {
      id: `preview-conversation-${c.id}`, status: c.state === 'closed' ? 'closed' : c.owner ? 'claimed' : 'open',
      assigned_to_user_id: c.owner ? 'preview-agent' : null, contacts: {
        id: `preview-contact-${c.id}`, name: c.name, display_name: c.name, phone_number: c.phone,
        tags: c.tags, is_anonymized: false,
      },
    } : null;
    window.__INBOX_PREVIEW_CONTACT__ = conversation;
    window.dispatchEvent(new CustomEvent('preview:contact-selected', { detail: conversation }));
  }
  function renderHeader() {
    const c = current();
    $('#pv-more-trigger').disabled = !c;
    $('#pv-message-search-trigger').disabled = !c;
    $('#pv-composer').hidden = !c;
    if (!c) {
      $('#pv-chat-identity').innerHTML = '<span class="pv-chat-contact-name">Selecione uma conversa</span>';
      $('#pv-claim').hidden = true; $('#pv-close-conversation').hidden = true; $('#pv-reminder-banner').hidden = true;
      return;
    }
    $('#pv-chat-identity').innerHTML = `<span class="pv-avatar pv-${c.color}">${c.initials}</span><div class="pv-chat-identity-text"><div class="pv-chat-name-row"><span class="pv-chat-contact-name" title="${escape(c.name)}">${escape(c.name)}</span><span class="pv-status">${c.state === 'closed' ? 'Fechada' : 'Aberta'}</span></div><div class="pv-chat-subtitle">${icon('whatsapp')}<span>${escape(c.phone.replace(/^(\+55)(\d{2})(\d{5})(\d{4})$/, '$1 ($2) $3-$4'))}</span><span>·</span><span class="pv-chat-owner">${c.state === 'auto' ? 'Automático' : c.owner ? escape(c.owner) : 'Sem responsável'}</span></div></div>`;
    $('#pv-claim').textContent = c.owner === 'Juliana' ? 'Liberar' : 'Assumir';
    $('#pv-claim').hidden = c.state === 'closed';
    $('#pv-close-conversation').innerHTML = icon(c.state === 'closed' ? 'reply' : 'check') + `<span>${c.state === 'closed' ? 'Reabrir' : 'Fechar'}</span>`;
    $('#pv-close-conversation').setAttribute('aria-label', c.state === 'closed' ? 'Reabrir conversa' : 'Fechar conversa');
    $('#pv-reminder-banner').hidden = !c.reminder;
    $('#pv-reminder-banner').innerHTML = c.reminder ? `<span>${icon('clock')} Lembrete: ${escape(c.reminder)}</span><button class="pv-text-button" data-command="cancel-reminder">Remover</button>` : '';
  }
  function marked(text) {
    if (!messageSearch) return escape(text);
    const source = String(text);
    const index = fold(source).indexOf(fold(messageSearch));
    if (index < 0) return escape(source);
    return escape(source.slice(0,index)) + '<mark>' + escape(source.slice(index,index + messageSearch.length)) + '</mark>' + escape(source.slice(index + messageSearch.length));
  }
  function renderThread(scroll = false) {
    const c = current();
    const messages = c ? getMessages(c) : [];
    const shown = messages.filter(m => !messageSearch || fold(m.text).includes(fold(messageSearch)));
    $('#pv-message-search-count').textContent = messageSearch ? `${shown.length} ${shown.length === 1 ? 'resultado' : 'resultados'}` : '';
    let day = null;
    $('#pv-thread-content').innerHTML = shown.map(m => {
      const divider = day !== m.day ? `<div class="pv-day">${escape(m.day)}</div>` : '';
      day = m.day;
      return divider + `<div class="pv-message-line ${m.side === 'out' ? 'pv-outgoing' : m.side === 'note' ? 'pv-note-line' : ''}" data-message="${m.id}"><div class="pv-bubble">${m.author || m.side === 'note' ? `<span class="pv-bubble-label">${m.side === 'note' ? 'Nota interna · Juliana' : escape(m.author)}</span>` : ''}${m.quote ? `<div class="pv-quoted-message"><strong>${m.quoteAuthor || 'Cliente'}</strong>${escape(m.quote)}</div>` : ''}<div class="pv-bubble-copy">${marked(m.text)}</div><time class="pv-bubble-time">${escape(m.time)}${m.side === 'out' ? icon('checks') : ''}</time></div><button class="pv-icon-button pv-message-action" data-reply="${m.id}" aria-label="Responder a esta mensagem" title="Responder a esta mensagem">${icon('reply')}</button></div>`;
    }).join('') || `<div class="pv-empty">${icon(messageSearch ? 'search' : 'inbox')}<strong>${messageSearch ? 'Nenhuma mensagem encontrada' : 'Conversa sem mensagens'}</strong>${messageSearch ? 'Busque outra palavra nesta conversa.' : 'As novas mensagens aparecerão aqui.'}</div>`;
    if (scroll) requestAnimationFrame(() => { $('#pv-thread').scrollTop = $('#pv-thread').scrollHeight; });
  }
  function renderComposer() {
    const c = current();
    if (!c) return;
    const isNote = c.mode === 'note';
    $('#pv-composer').classList.toggle('pv-note-mode', isNote);
    $$('[data-mode]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.mode === c.mode)));
    $('#pv-note-hint').hidden = !isNote;
    input.placeholder = c.state === 'closed' && !isNote ? 'Reabra a conversa para responder...' : isNote ? 'Escreva uma nota para sua equipe...' : 'Escreva uma mensagem...';
    input.disabled = c.state === 'closed' && !isNote;
    $('#pv-reply-preview').hidden = !replying;
    $('#pv-reply-preview').innerHTML = replying ? `<div><strong>Respondendo a ${replying.side === 'in' ? escape(c.name.split(' ')[0]) : 'você'}</strong>${escape(replying.text.slice(0,100))}</div><button type="button" class="pv-icon-button" data-command="cancel-reply" aria-label="Cancelar resposta citada">${icon('close')}</button>` : '';
    $('#pv-attachment-preview').hidden = !c.attachment;
    $('#pv-attachment-preview').innerHTML = c.attachment ? `${icon('file')}<span>${escape(c.attachment)}</span><button type="button" class="pv-icon-button" data-command="remove-attachment" aria-label="Remover anexo">${icon('close')}</button>` : '';
    updateInput();
  }
  function updateInput() {
    const c = current();
    if (!c) return;
    c.draft = input.value;
    input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px';
    const hasContent = !!(input.value.trim() || c.attachment);
    $('#pv-send-message').hidden = !hasContent;
    $('#pv-audio').hidden = hasContent;
    $('#pv-send-message').disabled = input.disabled;
  }
  function renderAll() { renderList(); renderHeader(); renderThread(true); renderComposer(); emitContact(); }
  function selectContact(id) {
    closePopup(); selectedId = id; replying = null; messageSearch = ''; recording = false;
    const c = current();
    if (c) c.unread = 0;
    input.value = c?.draft || '';
    $('#pv-message-search').value = '';
    $('#pv-message-search-bar').hidden = true;
    $('#pv-message-search-trigger').setAttribute('aria-expanded', 'false');
    closeDrawers(); renderAll();
  }
  function notify(text) {
    clearTimeout(toastTimer); $('#pv-toast').textContent = text; $('#pv-toast').hidden = false;
    toastTimer = setTimeout(() => { $('#pv-toast').hidden = true; }, 4300);
  }
  function placePopup() {
    if (!activePopup || !popupTrigger?.isConnected) return;
    const trigger = popupTrigger.getBoundingClientRect();
    const bounds = activePopup.getBoundingClientRect();
    const preferLeft = activePopup === $('#pv-filter-popover') ? trigger.right - bounds.width : trigger.left;
    const left = Math.max(10, Math.min(preferLeft, innerWidth - bounds.width - 10));
    const below = trigger.bottom + 7;
    const top = below + bounds.height <= innerHeight - 10 ? below : Math.max(10, trigger.top - bounds.height - 7);
    activePopup.style.left = `${left}px`; activePopup.style.top = `${top}px`;
  }
  function closePopup(focus = false) {
    if (activePopup) activePopup.hidden = true;
    popupTrigger?.setAttribute('aria-expanded', 'false');
    if (focus && popupTrigger?.isConnected) popupTrigger.focus();
    activePopup = null;
  }
  function openPopup(element, trigger, focus = false) {
    if (activePopup === element && popupTrigger === trigger) { closePopup(true); return; }
    closePopup(); activePopup = element; popupTrigger = trigger; element.hidden = false;
    trigger.setAttribute('aria-expanded', 'true'); placePopup();
    if (focus) element.querySelector('button,input,select')?.focus();
  }
  function showMenu(items, trigger, label, focus = false) {
    menuItems = items;
    menu.setAttribute('aria-label', label);
    menu.innerHTML = items.map((item,index) => item.separator ? '<div class="pv-menu-separator" role="separator"></div>' : `<button class="pv-menu-item ${item.danger ? 'pv-danger' : ''}" role="menuitem" data-menu-index="${index}">${icon(item.icon)}<span>${escape(item.label)}</span></button>`).join('');
    openPopup(menu, trigger, focus);
  }
  function rowMenu(id, trigger, focus = false) {
    const c = contacts.find(item => item.id === id); menuContact = c;
    showMenu([
      { icon: c.pinned ? 'unpin' : 'pin', label: c.pinned ? 'Desafixar conversa' : 'Fixar conversa', run: () => { c.pinned = !c.pinned; renderList(); $(`[data-row-menu="${c.id}"]`)?.focus(); notify(c.pinned ? 'Conversa fixada. A posição na fila foi mantida.' : 'Conversa desafixada.'); } },
      { icon: 'unread', label: 'Marcar como não lida', run: () => { c.unread = Math.max(1,c.unread); renderList(); ($(`[data-row-menu="${c.id}"]`) || $('#pv-contact-search')).focus(); notify('Conversa marcada como não lida.'); } },
      { separator: true },
      { icon: 'clear', label: 'Limpar conversa', run: () => openModal('Limpar conversa?', '<p>As mensagens deste exemplo serão removidas. O contato continuará na lista.</p>', 'Limpar conversa', () => { c.messages = []; c.preview = 'Conversa sem mensagens'; c.unread = 0; renderList(); if (c.id === selectedId) renderThread(); notify('Mensagens limpas nesta prévia.'); }) },
      { icon: 'trash', label: 'Apagar conversa', danger: true, run: () => openModal('Apagar conversa?', '<p>Esta ação remove somente a conversa de exemplo desta prévia.</p>', 'Apagar conversa', () => {
        const index = contacts.findIndex(item => item.id === c.id); contacts.splice(index,1);
        if (selectedId === c.id) selectContact(contacts[0]?.id || null); else renderList();
        notify('Conversa de exemplo apagada.');
      }, true) },
    ], trigger, `Ações da conversa com ${c.name}`, focus);
  }
  function headerMenu(trigger, focus = false) {
    const c = current();
    const items = [
      { icon: 'transfer', label: 'Transferir conversa', run: transfer },
      { icon: 'clock', label: 'Lembrar', run: remind },
      { icon: 'person', label: 'Marcar como pessoal', run: () => openModal('Marcar como pessoal?', '<p>A conversa de exemplo sairá da operação. Nenhum contato real será alterado.</p>', 'Marcar como pessoal', () => { c.personal = true; renderList(); notify('Contato marcado como pessoal nesta prévia.'); }) },
      { separator: true },
      { icon: 'robot', label: c.state === 'auto' ? 'Pausar automático' : 'Devolver ao automático', run: () => { c.state = c.state === 'auto' ? 'queue' : 'auto'; c.owner = null; renderAll(); notify(c.state === 'auto' ? 'Atendimento automático demonstrativo ativado.' : 'Automático pausado nesta conversa de exemplo.'); } },
      { icon: 'phone', label: 'Ligar para o contato', run: () => notify('Ligação demonstrativa. Nenhuma chamada será realizada.') },
      { icon: 'video', label: 'Iniciar videochamada', run: () => notify('Videochamada demonstrativa. Nenhuma chamada será realizada.') },
    ];
    if (innerWidth <= 640) items.push({ icon: 'search', label: 'Buscar nesta conversa', run: toggleMessageSearch }, { icon: 'check', label: c.state === 'closed' ? 'Reabrir conversa' : 'Fechar conversa', run: closeConversation });
    showMenu(items,trigger,'Mais ações da conversa',focus);
  }
  function openModal(title, content, confirm, action, danger = false) {
    closePopup(); modalFocus = document.activeElement; modalAction = action;
    $('#pv-modal-title').textContent = title; $('#pv-modal-content').innerHTML = content;
    $('#pv-modal-confirm').textContent = confirm; $('#pv-modal-confirm').classList.toggle('pv-danger', danger);
    dialog.showModal(); dialog.querySelector('[data-command="cancel-modal"]').focus();
  }
  function transfer() {
    openModal('Transferir conversa', '<p>Escolha quem continuará este atendimento de exemplo.</p><label for="pv-transfer-to">Responsável ou fila</label><select id="pv-transfer-to"><option value="Marina">Marina · Comercial</option><option value="Pedro">Pedro · Suporte</option><option value="queue">Fila geral · Sem responsável</option></select>', 'Transferir', () => {
      const c = current(); const target = $('#pv-transfer-to').value; c.owner = target === 'queue' ? null : target; c.state = target === 'queue' ? 'queue' : 'assigned'; renderAll(); notify(target === 'queue' ? 'Conversa devolvida à fila de exemplo.' : `Conversa transferida para ${target} nesta prévia.`);
    });
  }
  function remind() {
    const next = new Date(Date.now() + 3600000); next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
    openModal('Lembrar desta conversa', '<p>Agende um retorno sem ocupar espaço no cabeçalho.</p><label for="pv-reminder-date">Quando lembrar</label><input type="datetime-local" id="pv-reminder-date" required value="' + next.toISOString().slice(0,16) + '">', 'Criar lembrete', () => {
      current().reminder = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date($('#pv-reminder-date').value)); renderHeader(); notify('Lembrete adicionado nesta prévia.');
    });
  }
  function closeConversation() {
    const c = current();
    if (c.state === 'closed') { c.state = 'queue'; c.owner = null; renderAll(); notify('Conversa reaberta.'); return; }
    openModal('Fechar conversa?', '<p>O atendimento de exemplo será encerrado. Você poderá reabri-lo pelo mesmo botão.</p>', 'Fechar conversa', () => { c.state = 'closed'; c.pending = false; renderAll(); notify('Conversa fechada nesta prévia.'); });
  }
  function readDraftFilters() {
    return { mine: $('#pv-filter-popover [name="mine"]').checked, unread: $('#pv-filter-popover [name="unread"]').checked, groups: $('#pv-filter-popover [name="groups"]').checked, tags: $$('#pv-filter-popover [name="tag"]:checked').map(item => item.value), number: $('#pv-number-filter').value, tagMode: $('#pv-tag-mode').value };
  }
  function updateFilterResult() {
    const count = filtered(activeTab,readDraftFilters()).length;
    $('#pv-apply-filters').textContent = `Mostrar ${count} ${count === 1 ? 'conversa' : 'conversas'}`;
  }
  function showFilters(trigger, focus) {
    for (const key of ['mine','unread','groups']) $(`#pv-filter-popover [name="${key}"]`).checked = filters[key];
    $$('#pv-filter-popover [name="tag"]').forEach(item => { item.checked = filters.tags.includes(item.value); });
    $('#pv-number-filter').value = filters.number; $('#pv-tag-mode').value = filters.tagMode;
    updateFilterResult(); openPopup($('#pv-filter-popover'),trigger,focus);
  }
  function toggleMessageSearch() {
    const bar = $('#pv-message-search-bar');
    if (!bar.hidden) { closeMessageSearch(); return; }
    bar.hidden = false; $('#pv-message-search-trigger').setAttribute('aria-expanded','true'); $('#pv-message-search').focus();
  }
  function closeMessageSearch() { $('#pv-message-search-bar').hidden = true; $('#pv-message-search-trigger').setAttribute('aria-expanded','false'); $('#pv-message-search').value = ''; messageSearch = ''; renderThread(true); $('#pv-message-search-trigger').focus(); }
  function savedDetailsWidth() {
    const band = widthBand();
    if (!widthPreferences.has(band)) {
      let width = defaultDetailsWidth();
      try {
        const value = window.localStorage.getItem(`preview:inbox:ficha:v2:${band}`);
        const parsed = value === null ? null : Number(value);
        if (typeof parsed === 'number' && Number.isFinite(parsed)) width = parsed;
      } catch { /* Resizing also works without browser storage. */ }
      widthPreferences.set(band,width);
    }
    return widthPreferences.get(band);
  }
  function rememberDetailsWidth(width) {
    const band = widthBand();
    widthPreferences.set(band,width);
    try { window.localStorage.setItem(`preview:inbox:ficha:v2:${band}`,String(width)); } catch { /* Session preference remains usable. */ }
  }
  function applyDetailsWidth(requested = savedDetailsWidth()) {
    const rules = window.inboxPreviewSizing;
    if (!rules) return;
    const containerWidth = $('#pv-workspace').clientWidth;
    const docked = dockedDetails();
    const maximum = Math.max(rules.LIMITES_FICHA.min,Math.min(rules.LIMITES_FICHA.max,
      docked ? containerWidth - rules.LIMITES_LISTA.min - rules.CONVERSA_MINIMA : innerWidth - 96));
    const resolved = rules.resolverLarguras({
      lista: defaultListWidth(), ficha: Math.min(maximum,rules.limitarFicha(requested)),
      larguraContainer: containerWidth, temFicha: docked,
    });
    detailsWidth = resolved.ficha;
    app.style.setProperty('--pv-details-width',`${detailsWidth}px`);
    app.style.setProperty('--pv-list-width',`${resolved.lista}px`);
    const handle = $('#pv-details-resizer');
    handle.setAttribute('aria-valuemin',String(rules.LIMITES_FICHA.min));
    handle.setAttribute('aria-valuemax',String(maximum));
    handle.setAttribute('aria-valuenow',String(detailsWidth));
    handle.setAttribute('aria-valuetext',`${detailsWidth} pixels`);
  }
  function finishResize(cancelled = false) {
    if (!resizeDrag) return;
    const start = resizeDrag;
    resizeDrag = null;
    if (cancelled) applyDetailsWidth(start.width);
    else rememberDetailsWidth(detailsWidth);
    const handle = $('#pv-details-resizer');
    if (handle.hasPointerCapture(start.pointerId)) handle.releasePointerCapture(start.pointerId);
    document.documentElement.classList.remove('pv-is-resizing');
  }
  function restoreDetailsWidth() {
    const band = widthBand();
    widthPreferences.set(band,defaultDetailsWidth());
    try { window.localStorage.removeItem(`preview:inbox:ficha:v2:${band}`); } catch { /* Default still applies in this tab. */ }
    applyDetailsWidth(defaultDetailsWidth());
  }
  function updateDrawers() {
    const rightOverlay = !canDock() && app.classList.contains('pv-show-details');
    const leftOverlay = portrait() && app.classList.contains('pv-show-list-panel');
    $('#pv-drawer-backdrop').hidden = !(rightOverlay || leftOverlay);
    $('#pv-chat').inert = rightOverlay || leftOverlay;
    $('#pv-workspace-header').inert = rightOverlay;
    $('#original-system-topbar').inert = rightOverlay || leftOverlay;
    $('#original-system-navigation').inert = rightOverlay || leftOverlay;
    $('#pv-list-panel').inert = rightOverlay;
    $('#pv-contact-panel').inert = leftOverlay;
    const visible = dockedDetails() || rightOverlay;
    $('#pv-details-toggle').classList.toggle('pv-details-visible', visible);
    $('#pv-details-toggle').setAttribute('aria-expanded', String(visible));
    $('#pv-show-list').setAttribute('aria-expanded',String(leftOverlay));
    for (const [element, shown] of [[$('#pv-contact-panel'),rightOverlay],[$('#pv-list-panel'),leftOverlay]]) {
      if (shown) { element.setAttribute('role','dialog'); element.setAttribute('aria-modal','true'); }
      else { element.removeAttribute('role'); element.removeAttribute('aria-modal'); }
    }
    applyDetailsWidth();
  }
  function closeDrawers() {
    app.classList.remove('pv-show-details','pv-show-list-panel'); updateDrawers();
    if (drawerFocus?.isConnected) drawerFocus.focus(); drawerFocus = null;
  }
  function showDetails() {
    closePopup();
    if (desktop()) { app.classList.toggle('pv-hide-details'); updateDrawers(); return; }
    if (app.classList.contains('pv-show-details')) { closeDrawers(); return; }
    app.classList.remove('pv-show-list-panel'); app.classList.add('pv-show-details'); drawerFocus = $('#pv-details-toggle'); updateDrawers();
    (canDock() ? $('#pv-details-resizer') : $('#pv-contact-panel [data-command="hide-details"]')).focus();
  }
  function showList() { closePopup(); app.classList.remove('pv-show-details'); app.classList.add('pv-show-list-panel'); drawerFocus = $('#pv-show-list'); updateDrawers(); $('#pv-contact-search').focus(); }
  function sendMessage(event) {
    event?.preventDefault(); const c = current();
    if (!c || input.disabled || !(input.value.trim() || c.attachment)) return;
    const text = input.value.trim() + (c.attachment ? `${input.value.trim() ? '\n' : ''}📎 ${c.attachment}` : '');
    getMessages(c).push({ id: `sent-${Date.now()}`, side: c.mode === 'note' ? 'note' : 'out', text, time: localTime(), day: 'Hoje', quote: replying?.text, quoteAuthor: replying?.side === 'out' ? 'Você' : c.name.split(' ')[0] });
    if (c.mode !== 'note') { c.preview = text; c.time = localTime(); c.pending = false; }
    c.draft = ''; c.attachment = null; replying = null; input.value = ''; renderList(); renderThread(true); renderComposer(); input.focus();
  }
  function attachmentMenu(trigger, focus) {
    showMenu([
      { icon: 'image', label: 'Fotos e vídeos', run: () => $('#pv-media-file').click() },
      { icon: 'file', label: 'Documento', run: () => $('#pv-document-file').click() },
      { icon: 'person', label: 'Contato', run: () => openModal('Compartilhar contato', '<p>Um cartão de contato será incluído somente neste exemplo.</p><label for="pv-shared-contact">Contato</label><select id="pv-shared-contact"><option>Marina · Comercial</option><option>Pedro · Suporte</option></select>', 'Anexar contato', () => { current().attachment = 'Contato: ' + $('#pv-shared-contact').value; renderComposer(); }) },
    ],trigger,'Anexar',focus);
  }
  function aiMenu(trigger, focus) {
    showMenu([
      { icon: 'sparkles', label: 'Sugerir resposta', run: () => { input.value = 'Olá! Estou verificando as informações para te ajudar. Já retorno com os detalhes 😊'; updateInput(); input.focus(); notify('Sugestão de exemplo. Revise antes de enviar.'); } },
      { icon: 'note', label: 'Melhorar meu texto', run: () => { if (!input.value.trim()) { notify('Escreva uma mensagem para experimentar esta opção.'); input.focus(); return; } input.value = input.value.trim().replace(/^./,c => c.toLocaleUpperCase('pt-BR')); updateInput(); notify('Revisão demonstrativa aplicada ao rascunho.'); } },
      { icon: 'file', label: 'Resumir conversa', run: () => openModal('Resumo da conversa · Exemplo','<p>O cliente procura um iPhone 15 Pro de 256 GB na cor preta. Aguarda a confirmação da disponibilidade.</p><p>Prévia com texto de exemplo, sem consulta a serviços de IA.</p>','Entendi', () => {}) },
    ],trigger,'Assistente de escrita',focus);
  }
  function showEmoji(trigger, focus) {
    const emojis = ['😊','👍','💙','🙏','✅','🎉','👋','😄','🤝','✨'];
    $('#pv-emoji-popover').innerHTML = '<p>Emojis recentes</p><div class="pv-emoji-grid">' + emojis.map(emoji => `<button data-emoji="${emoji}" aria-label="Inserir ${emoji}">${emoji}</button>`).join('') + '</div>';
    openPopup($('#pv-emoji-popover'),trigger,focus);
  }
  function commands(command, trigger, keyboard = false) {
    const c = current();
    switch (command) {
      case 'more': headerMenu(trigger,keyboard); break;
      case 'search-messages': toggleMessageSearch(); break;
      case 'close-message-search': closeMessageSearch(); break;
      case 'claim':
        if (c.owner === 'Juliana') { c.owner = null; c.state = 'queue'; notify('Conversa devolvida à fila de exemplo.'); }
        else { c.owner = 'Juliana'; c.state = 'mine'; notify('Você assumiu esta conversa de exemplo.'); }
        renderAll(); break;
      case 'close-conversation': closeConversation(); break;
      case 'toggle-details': showDetails(); break;
      case 'hide-details': case 'hide-list': closeDrawers(); break;
      case 'show-list': showList(); break;
      case 'clear-filters': filters = emptyFilters(); search = ''; $('#pv-contact-search').value = ''; closePopup(); renderList(); break;
      case 'apply-filters': filters = readDraftFilters(); closePopup(true); renderList(); break;
      case 'cancel-modal': modalAction = null; dialog.close(); break;
      case 'cancel-reply': replying = null; renderComposer(); input.focus(); break;
      case 'remove-attachment': c.attachment = null; renderComposer(); break;
      case 'cancel-reminder': c.reminder = null; renderHeader(); break;
      case 'attachments': attachmentMenu(trigger,keyboard); break;
      case 'emoji': showEmoji(trigger,keyboard); break;
      case 'ai': aiMenu(trigger,keyboard); break;
      case 'audio':
        recording = !recording;
        if (recording) { notify('Áudio de exemplo em preparação. Clique novamente para inserir.'); $('#pv-audio').style.background = '#bc3038'; $('#pv-audio').setAttribute('aria-label','Inserir áudio de exemplo'); }
        else { c.attachment = 'Áudio de exemplo · 0:08'; $('#pv-audio').style.background = ''; $('#pv-audio').setAttribute('aria-label','Gravar áudio de exemplo'); renderComposer(); }
        break;
      case 'shortcuts': openModal('Atalhos do teclado','<div class="pv-shortcuts"><span>Buscar conversa</span><kbd>/</kbd><span>Enviar mensagem</span><kbd>Enter</kbd><span>Quebrar linha</span><kbd>Shift + Enter</kbd><span>Fechar menu ou painel</span><kbd>Esc</kbd><span>Navegar pelas categorias</span><kbd>← →</kbd></div>','Entendi', () => {}); break;
    }
  }
  document.addEventListener('click', event => {
    const target = event.target;
    if (target.closest('#original-contact-panel,#original-system-topbar,#original-system-navigation')) { if (activePopup && !activePopup.contains(target)) closePopup(); return; }
    const menuItem = target.closest('[data-menu-index]');
    if (menuItem) { const action = menuItems[Number(menuItem.dataset.menuIndex)]; closePopup(true); action?.run(); return; }
    const command = target.closest('[data-command]');
    if (command) { commands(command.dataset.command,command,event.detail === 0); return; }
    const rowTrigger = target.closest('[data-row-menu]');
    if (rowTrigger) { rowMenu(Number(rowTrigger.dataset.rowMenu),rowTrigger,event.detail === 0); return; }
    if (target.closest('#pv-filter-trigger')) { showFilters($('#pv-filter-trigger'),event.detail === 0); return; }
    const open = target.closest('[data-open]');
    if (open) { selectContact(Number(open.dataset.open)); return; }
    const tab = target.closest('[data-tab]');
    if (tab) { closePopup(); activeTab = tab.dataset.tab; renderList(); $(`[data-tab="${activeTab}"]`).focus(); return; }
    const chip = target.closest('[data-remove-filter]');
    if (chip) { const key = chip.dataset.removeFilter; if (key.startsWith('tag:')) filters.tags = filters.tags.filter(t => t !== key.slice(4)); else filters[key] = key === 'number' ? 'all' : false; renderList(); return; }
    const mode = target.closest('[data-mode]');
    if (mode) { current().mode = mode.dataset.mode; renderComposer(); input.focus(); return; }
    const reply = target.closest('[data-reply]');
    if (reply) { replying = getMessages(current()).find(m => m.id === reply.dataset.reply); renderComposer(); input.focus(); return; }
    const emoji = target.closest('[data-emoji]');
    if (emoji) { input.value += emoji.dataset.emoji; updateInput(); closePopup(); input.focus(); return; }
    if (target === $('#pv-drawer-backdrop')) { closeDrawers(); return; }
    if (activePopup && !activePopup.contains(target) && !popupTrigger?.contains(target)) closePopup();
  });
  $('#pv-contact-search').addEventListener('input', event => { search = event.target.value; closePopup(); renderList(); });
  $('#pv-filter-popover').addEventListener('change',updateFilterResult);
  $('#pv-message-search').addEventListener('input',event => { messageSearch = event.target.value; renderThread(); });
  input.addEventListener('input',updateInput);
  input.addEventListener('keydown',event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(); } });
  $('#pv-composer').addEventListener('submit',sendMessage);
  $('#pv-modal-form').addEventListener('submit',event => { event.preventDefault(); const action = modalAction; modalAction = null; action?.(); dialog.close(); });
  dialog.addEventListener('close',() => { modalAction = null; if (modalFocus?.isConnected) modalFocus.focus(); });
  dialog.addEventListener('cancel',() => { modalAction = null; });
  for (const element of [$('#pv-media-file'),$('#pv-document-file')]) element.addEventListener('change', () => { const file = element.files[0]; if (file) { current().attachment = file.name; renderComposer(); notify('Arquivo anexado ao exemplo. Nenhum upload foi realizado.'); } element.value = ''; });
  $('#pv-contact-list').addEventListener('scroll',() => { if (menuContact && activePopup === menu) closePopup(); },{ passive: true });
  $('#pv-categories').addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(([key]) => key === activeTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activeTab = tabs[next][0]; renderList(); $(`[data-tab="${activeTab}"]`).focus();
  });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && resizeDrag) { event.preventDefault(); finishResize(true); return; }
    if (dialog.open) return;
    if (event.key === 'Escape') {
      if (activePopup) { event.preventDefault(); closePopup(true); return; }
      if (!$('#pv-drawer-backdrop').hidden || (!desktop() && app.classList.contains('pv-show-details'))) { closeDrawers(); return; }
      if (!$('#pv-message-search-bar').hidden) { closeMessageSearch(); return; }
    }
    if (activePopup === menu && ['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); const items = [...menu.querySelectorAll('button')]; const index = items.indexOf(document.activeElement);
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
    if (activePopup === menu && event.key === 'Tab') closePopup(true);
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); if (portrait()) showList(); $('#pv-contact-search').focus(); }
    if (event.key === 'Tab' && !$('#pv-drawer-backdrop').hidden && !document.querySelector('[data-state="open"][role="dialog"]')) {
      const drawer = app.classList.contains('pv-show-details') ? $('#pv-contact-panel') : $('#pv-list-panel');
      const focusable = [...drawer.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],select')].filter(el => el.getClientRects().length);
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
    }
  });
  const resizer = $('#pv-details-resizer');
  resizer.addEventListener('pointerdown',event => {
    if (event.button !== 0 || !window.inboxPreviewSizing) return;
    event.preventDefault(); closePopup(); resizer.focus();
    resizeDrag = { pointerId: event.pointerId, x: event.clientX, width: detailsWidth };
    resizer.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('pv-is-resizing');
  });
  resizer.addEventListener('pointermove',event => {
    if (resizeDrag?.pointerId === event.pointerId) applyDetailsWidth(resizeDrag.width + resizeDrag.x - event.clientX);
  });
  resizer.addEventListener('pointerup',() => finishResize());
  resizer.addEventListener('pointercancel',() => finishResize());
  resizer.addEventListener('lostpointercapture',() => finishResize());
  resizer.addEventListener('dblclick',restoreDetailsWidth);
  resizer.addEventListener('keydown',event => {
    const rules = window.inboxPreviewSizing;
    if (!rules) return;
    const width = event.key === 'Home' ? rules.LIMITES_FICHA.min : event.key === 'End' ? Number(resizer.getAttribute('aria-valuemax')) : rules.moverPorSeta('ficha',detailsWidth,event.key);
    if (width === null) return;
    event.preventDefault(); applyDetailsWidth(width); rememberDetailsWidth(detailsWidth);
  });
  new ResizeObserver(() => { if (!resizeDrag) applyDetailsWidth(); }).observe($('#pv-workspace'));
  window.addEventListener('resize',() => { finishResize(true); closePopup(); updateDrawers(); });
  window.addEventListener('preview:sizing-ready',() => applyDetailsWidth());
  window.addEventListener('preview:global-search',() => {
    openModal('Buscar no sistema','<label for="pv-global-search">Busca global</label><input type="search" id="pv-global-search" placeholder="Contatos, negócios, tarefas..."><p style="margin-top:12px">Busca demonstrativa da barra global do sistema.</p>','Buscar',() => notify('Busca global de exemplo.'));
    $('#pv-global-search').focus();
  });
  window.addEventListener('preview:notice',event => notify(event.detail));
  window.addEventListener('preview:show-contact',showDetails);
  window.addEventListener('preview:show-list',showList);
  renderAll(); updateDrawers();
})();
