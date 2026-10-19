import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, '../../public/previews/inbox-layout');
const entry = pathToFileURL(path.join(output, 'chat.html')).href;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const externalRequests = [];
const passed = [];
const layouts = [];
const checked = name => passed.push(name);
async function load(width = 1366, height = 768) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
  await page.goto(entry);
  await page.locator('[data-testid="inbox-enrichment"]').waitFor({ state: 'attached' });
  await page.getByText('Interesse em iPhone 15 Pro', { exact: true }).waitFor({ state: 'attached' });
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id).filter((id,index,ids) => ids.indexOf(id) !== index)),[], 'IDs duplicados na pagina');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page;
}
async function capture(page, name) {
  await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' });
}
async function comparePixels(page, left, right) {
  return page.evaluate(async images => {
    const pixels = [];
    let width, height;
    for (const src of images) {
      const image = new Image(); image.src = src; await image.decode();
      if (width !== undefined && (width !== image.width || height !== image.height)) return -1;
      width = image.width; height = image.height;
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.drawImage(image,0,0);
      pixels.push(context.getImageData(0,0,width,height).data);
    }
    let different = 0;
    for (let i = 0; i < pixels[0].length; i += 4) {
      if ([0,1,2,3].some(channel => pixels[0][i + channel] !== pixels[1][i + channel])) different++;
    }
    return different;
  }, [left,right].map(bytes => 'data:image/png;base64,' + bytes.toString('base64')));
}
async function choose(page, tab) { await page.locator(`[data-tab="${tab}"]`).click(); }
async function filters(page, configure) {
  await page.locator('#pv-filter-trigger').click();
  await configure(page.locator('#pv-filter-popover'));
  await page.locator('#pv-apply-filters').click();
}
async function clearFilters(page) {
  await page.locator('#pv-filter-trigger').click();
  await page.locator('#pv-filter-popover [data-command="clear-filters"]').click();
}
async function more(page, name) {
  await page.locator('#pv-more-trigger').click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

try {
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'source-manifest.json'), 'utf8'));
  for (const item of manifest.files) {
    const bytes = await fs.readFile(path.join(here, 'source', item.file + '.txt'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.file);
    const source = await fs.readFile(path.join(process.env.INBOX_SOURCE_REPO || 'C:/Projetos Claude/estallo-crm', item.file));
    assert.equal(Buffer.compare(bytes, source), 0, `${item.file}: copia diferente do original`);
  }
  checked(`${manifest.files.length} arquivos visuais originais preservados byte a byte`);

  for (const [name,width,height,sidebarVisible,listVisible] of [
    ['desktop',1920,1080,true,true], ['notebook',1366,768,false,true],
    ['tablet',1024,768,false,true], ['tablet-retrato',768,1024,false,false],
  ]) {
    const page = await load(width,height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    assert.equal(await page.locator('#pv-contact-panel').isVisible(),sidebarVisible);
    assert.equal(await page.locator('#pv-list-panel').isVisible(),listVisible);
    const header = await page.locator('.pv-chat-header').boundingBox();
    const thread = await page.locator('.pv-thread').boundingBox();
    const composer = await page.locator('.pv-composer').boundingBox();
    assert.ok(header.height <= 76 && thread.height >= height * .6);
    assert.ok(composer.y + composer.height <= height + 1);
    const alignment = await page.locator('#pv-thread').evaluate(el => {
      const content = el.querySelector('.pv-thread-content').getBoundingClientRect();
      const incoming = el.querySelector('.pv-message-line:not(.pv-outgoing) .pv-bubble').getBoundingClientRect();
      const outgoing = el.querySelector('.pv-outgoing .pv-bubble').getBoundingClientRect();
      const style = getComputedStyle(el);
      return { left: incoming.left - content.left, right: content.right - outgoing.right,
        contentWidth: content.width, available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    assert.ok(Math.abs(alignment.left) < 1 && Math.abs(alignment.right) < 1);
    assert.ok(Math.abs(alignment.contentWidth - alignment.available) < 1);
    layouts.push({ name, width, height, chatWidth: thread.width, messageAreaHeight: thread.height });
    await capture(page, `${name}.png`);
    if (name === 'desktop') {
      const rendered = await page.locator('#original-contact-panel').screenshot({ animations: 'disabled' });
      const baseline = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await baseline.goto(pathToFileURL(path.join(output,'sidebar-original.html')).href);
      await baseline.locator('[data-testid="inbox-enrichment"]').waitFor();
      await baseline.evaluate(() => document.fonts.ready);
      const reference = await baseline.locator('#original-contact-panel').screenshot({ animations: 'disabled' });
      assert.equal(await comparePixels(page,rendered,reference),0,'A ficha original mudou visualmente.');
      await fs.writeFile(path.join(output,'sidebar-in-layout.png'),rendered);
      await fs.writeFile(path.join(output,'sidebar-reference.png'),reference);
      await baseline.close();
      checked('Ficha no desktop identica em pixels a renderizacao isolada do componente original');
    }
    if (!sidebarVisible) {
      await page.locator('#pv-details-toggle').click();
      await expect(page.locator('#pv-contact-panel')).toBeVisible();
      if (width < 1280) await expect(page.locator('#pv-chat')).toHaveAttribute('inert','');
      else {
        await expect(page.locator('#pv-chat')).not.toHaveAttribute('inert','');
        assert.ok((await page.locator('.pv-thread').boundingBox()).width < thread.width);
      }
      await capture(page,`${name}-contato.png`);
      await page.keyboard.press('Escape');
      await expect(page.locator('#pv-contact-panel')).toBeHidden();
      await expect(page.locator('#pv-details-toggle')).toBeFocused();
    }
    if (!listVisible) {
      await page.locator('#pv-show-list').click();
      await expect(page.locator('#pv-list-panel')).toBeVisible();
      await capture(page,`${name}-lista.png`);
      await page.locator('[data-open="2"]').click();
      await expect(page.locator('#pv-list-panel')).toBeHidden();
      await expect(page.locator('.pv-chat-contact-name')).toHaveText('Sara da Silva Moraes');
    }
    checked(`${name}: layout sem transbordamento, mensagens amplas e paineis acessiveis`);
    await page.close();
  }
  checked('Baloes alinhados as duas bordas uteis do chat, sem coluna central limitada');

  for (const [name,width,height] of [['desktop',1920,1080],['notebook',1366,768]]) {
    const page = await load(width,height);
    if (name === 'notebook') await page.locator('#pv-details-toggle').click();
    const handle = page.locator('#pv-details-resizer');
    const panel = page.locator('#pv-contact-panel');
    const chat = page.locator('#pv-chat');
    const before = { panel: await panel.boundingBox(), chat: await chat.boundingBox() };
    let grip = await handle.boundingBox();
    await page.mouse.move(grip.x + grip.width / 2,grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 - 180,grip.y + grip.height / 2,{steps:12});
    await page.mouse.up();
    const after = { panel: await panel.boundingBox(), chat: await chat.boundingBox() };
    assert.equal(Math.round(after.panel.width - before.panel.width),180);
    assert.equal(Math.round(before.chat.width - after.chat.width),180);
    assert.equal(Math.round(after.panel.x + after.panel.width),Math.round(before.panel.x + before.panel.width));
    const headerBounds = await page.locator('.pv-chat-header').boundingBox();
    const actionsBounds = await page.locator('.pv-chat-actions').boundingBox();
    assert.ok(actionsBounds.x + actionsBounds.width <= headerBounds.x + headerBounds.width);
    assert.ok((await page.locator('.pv-chat-contact-name').boundingBox()).width >= 100);
    assert.ok((await page.locator('#pv-message-input').boundingBox()).width >= 80);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await capture(page,`${name}-ficha-ampliada.png`);
    await handle.focus(); await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow',String(after.panel.width + 16));
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow',String(after.panel.width));
    await page.keyboard.press('Home'); await expect(handle).toHaveAttribute('aria-valuenow','260');
    await page.keyboard.press('End'); await expect(handle).toHaveAttribute('aria-valuenow','560');
    assert.ok((await chat.boundingBox()).width >= 420);
    assert.ok((await page.locator('#pv-list-panel').boundingBox()).width >= 240);
    await page.reload();
    await expect(page.locator('[data-testid="inbox-enrichment"]')).toBeAttached();
    if (name === 'notebook') await page.locator('#pv-details-toggle').click();
    await expect(handle).toHaveAttribute('aria-valuenow','560');
    await page.setViewportSize({width: name === 'desktop' ? 1366 : 1920,height});
    await expect(handle).toHaveAttribute('aria-valuenow',name === 'desktop' ? '296' : '320');
    await page.setViewportSize({width,height});
    await expect(handle).toHaveAttribute('aria-valuenow','560');
    await handle.dblclick();
    await expect(handle).toHaveAttribute('aria-valuenow',name === 'desktop' ? '320' : '296');
    checked(`${name}: arraste reajusta chat, limites, teclado, duplo clique e memoria por faixa`);
    await page.close();
  }

  const noStorage = await browser.newPage({viewport:{width:1920,height:1080}});
  noStorage.on('pageerror',error=>errors.push(error.message));
  await noStorage.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
  await noStorage.goto(entry);
  await expect(noStorage.locator('#pv-details-resizer')).toHaveAttribute('aria-valuenow','320');
  await noStorage.locator('#pv-details-resizer').focus(); await noStorage.keyboard.press('ArrowLeft');
  await expect(noStorage.locator('#pv-details-resizer')).toHaveAttribute('aria-valuenow','336');
  await noStorage.close();
  checked('Redimensionamento funciona quando o armazenamento do navegador esta bloqueado');

  const page = await load();
  await expect(page.getByRole('button',{name:'Organização: Estallo',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Menu do usuário',exact:true})).toBeVisible();
  assert.equal(await page.locator('#pv-categories').evaluate(el=>!!el.closest('#pv-list-panel')),true);
  assert.equal(await page.locator('#original-system-topbar #pv-categories').count(),0);
  const headerBefore = await page.locator('#original-system-topbar').boundingBox();
  await page.locator('#pv-thread').evaluate(el=>{el.scrollTop=0;});
  assert.deepEqual(await page.locator('#original-system-topbar').boundingBox(),headerBefore);
  await page.locator('#original-system-topbar').getByRole('button',{name:/Buscar/}).click();
  await expect(page.locator('#pv-global-search')).toBeVisible();
  await page.locator('#pv-modal [data-command="cancel-modal"]').first().click();
  checked('TopBar e navegacao originais; busca global separada das categorias locais do inbox');
  const rows = page.locator('.pv-conversation');
  await expect(page.locator('#pv-categories [role="tab"]')).toHaveCount(5);
  await expect(rows).toHaveCount(8);
  await expect(page.locator('.pv-position').first()).toHaveText('1º na fila');
  await expect(page.locator('.pv-row-time').first()).toHaveText('09:18');
  checked('Uma navegacao principal; nome/horario, mensagem e operacao em niveis separados');

  await filters(page, async panel => { await panel.locator('[name="unread"]').check(); await panel.locator('[name="tag"][value="retorno"]').check(); });
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.pv-contact-name')).toHaveText('Ingrid Fagundes');
  await expect(page.locator('#pv-filter-count')).toHaveText('2');
  await expect(page.locator('.pv-filter-chip')).toHaveCount(2);
  await page.locator('#pv-filter-trigger').click();
  await capture(page,'notebook-filtros.png');
  await page.keyboard.press('Escape');
  await clearFilters(page);
  await expect(rows).toHaveCount(8);
  await expect(page.locator('#pv-active-filters')).toBeHidden();
  checked('Filtro de nao lidos + tags, contador, chips, teclado e limpar filtros');

  await filters(page, panel => panel.locator('[name="groups"]').check());
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.pv-contact-name')).toHaveText('Equipe · Atendimento');
  await clearFilters(page);
  await filters(page, panel => panel.locator('[name="mine"]').check());
  await expect(rows).toHaveCount(0);
  await expect(page.locator('.pv-empty')).toBeVisible();
  await choose(page,'all'); await expect(rows).toHaveCount(3);
  await clearFilters(page);
  checked('Grupos e Minhas funcionam entre categorias; estado vazio oferece saida');

  await filters(page, async panel => { await panel.locator('[name="tag"][value="cliente"]').check(); await panel.locator('[name="tag"][value="retorno"]').check(); });
  await expect(rows).toHaveCount(2);
  await filters(page, () => page.locator('#pv-tag-mode').selectOption('or'));
  assert.ok(await rows.count() > 2);
  await clearFilters(page);
  await filters(page, () => page.locator('#pv-number-filter').selectOption('support'));
  await expect(rows).toHaveCount(5);
  await clearFilters(page);
  checked('Combinacao E/OU das tags e filtro por numero do WhatsApp');

  await page.locator('#pv-contact-search').fill('joao');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.pv-contact-name')).toHaveText('João Victor Ferraz');
  await page.locator('#pv-contact-search').fill('(77) 99168-5086');
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.pv-contact-name')).toHaveText('Alexandre Coelho Nunes');
  await page.locator('#pv-contact-search').fill(''); await choose(page,'queue');
  checked('Busca por nome sem acento e telefone formatado');

  await page.locator('[data-row-menu="5"]').click();
  await page.getByRole('menuitem',{name:'Fixar conversa',exact:true}).click();
  await expect(rows.first()).toHaveAttribute('data-contact','5');
  await expect(page.locator('[data-contact="5"] .pv-position')).toHaveText('5º na fila');
  await page.locator('[data-row-menu="5"]').click();
  await expect(page.getByRole('menuitem',{name:'Desafixar conversa',exact:true})).toBeVisible();
  await page.getByRole('menuitem',{name:'Desafixar conversa',exact:true}).click();
  await page.locator('[data-row-menu="1"]').click();
  await page.getByRole('menuitem',{name:'Marcar como não lida',exact:true}).click();
  await expect(page.locator('[data-contact="1"] .pv-unread-count')).toHaveText('1');
  await page.locator('[data-open="1"]').click();
  await expect(page.locator('[data-contact="1"] .pv-unread-count')).toHaveCount(0);
  checked('Seta, fixar/desafixar e nao lida; posicao real da fila nao muda ao fixar');

  const input = page.locator('#pv-message-input');
  await input.fill('Rascunho preservado'); await page.locator('[data-open="2"]').click();
  await input.fill('Outro rascunho'); await page.locator('[data-open="1"]').click();
  await expect(input).toHaveValue('Rascunho preservado');
  const before = await page.locator('.pv-message-line').count();
  await page.locator('[data-mode="note"]').click();
  await expect(page.locator('.pv-message-line')).toHaveCount(before);
  await input.fill('Nota somente para a equipe'); await page.locator('#pv-send-message').click();
  await expect(page.locator('.pv-note-line')).toHaveCount(1);
  await expect(page.locator('[data-contact="1"] .pv-message-preview')).toHaveText('Perfeito, aguardo. Obrigado!');
  await page.locator('[data-mode="reply"]').click();
  await input.fill('Mensagem de exemplo'); await input.press('Enter');
  await expect(page.locator('.pv-bubble-copy').last()).toHaveText('Mensagem de exemplo');
  checked('Rascunhos por contato, resposta e nota interna sem envio acidental');

  await page.locator('#pv-message-search-trigger').click(); await page.locator('#pv-message-search').fill('preta');
  await expect(page.locator('.pv-message-line')).toHaveCount(1);
  await expect(page.locator('.pv-bubble mark')).toHaveText('preta');
  await page.keyboard.press('Escape');
  await page.locator('[data-message="a7"]').hover(); await page.locator('[data-reply="a7"]').click();
  await expect(page.locator('#pv-reply-preview')).toBeVisible();
  await input.fill('Disponível, sim!'); await page.locator('#pv-send-message').click();
  await expect(page.locator('.pv-message-line').last().locator('.pv-quoted-message')).toContainText('Tem na cor preta?');
  checked('Busca nas mensagens, destaque e resposta citada');

  await page.locator('#pv-emoji-trigger').click(); await page.locator('[data-emoji="😊"]').click();
  await expect(input).toHaveValue('😊'); await input.fill('');
  await page.locator('#pv-attach-trigger').click();
  await expect(page.getByRole('menuitem')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.locator('#pv-document-file').setInputFiles({name:'exemplo.pdf',mimeType:'application/pdf',buffer:Buffer.from('preview')});
  await expect(page.locator('#pv-attachment-preview')).toContainText('exemplo.pdf');
  await page.locator('[data-command="remove-attachment"]').click();
  await page.locator('#pv-ai-trigger').click(); await page.getByRole('menuitem',{name:'Sugerir resposta',exact:true}).click();
  await expect(input).not.toHaveValue(''); await input.fill('');
  checked('Anexos, documento local, emoji e assistente de escrita continuam acessiveis');

  await page.locator('#pv-more-trigger').click();
  await capture(page,'notebook-acoes.png');
  await page.getByRole('menuitem',{name:'Transferir conversa',exact:true}).click();
  await page.locator('#pv-modal-confirm').click();
  await expect(page.locator('.pv-chat-owner')).toHaveText('Marina');
  await page.locator('#pv-claim').click(); await expect(page.locator('.pv-chat-owner')).toHaveText('Juliana');
  await expect(page.locator('#pv-claim')).toHaveText('Liberar');
  await page.locator('#pv-claim').click(); await expect(page.locator('.pv-chat-owner')).toHaveText('Sem responsável');
  await more(page,'Lembrar'); await page.locator('#pv-modal-confirm').click();
  await expect(page.locator('#pv-reminder-banner')).toBeVisible();
  await page.locator('[data-command="cancel-reminder"]').click();
  await page.locator('#pv-close-conversation').click(); await page.locator('#pv-modal-confirm').click();
  await expect(page.locator('.pv-status')).toHaveText('Fechada');
  await page.locator('#pv-close-conversation').click(); await expect(page.locator('.pv-status')).toHaveText('Aberta');
  checked('Assumir/liberar, transferir, lembrar, fechar/reabrir e menu compacto');

  for (const [name,cancelFirst] of [['Limpar conversa',true],['Apagar conversa',true]]) {
    const row = page.locator('[data-contact="2"]');
    const before = await rows.count();
    const action = async () => {
      await page.locator('[data-row-menu="2"]').click();
      await page.getByRole('menuitem',{name,exact:true}).click();
    };
    if (cancelFirst) {
      await action(); await page.locator('#pv-modal [data-command="cancel-modal"]').first().click();
      await expect(row).toHaveCount(1);
    }
    await action(); await page.locator('#pv-modal-confirm').click();
    if (name === 'Limpar conversa') { await expect(row.locator('.pv-message-preview')).toHaveText('Conversa sem mensagens'); await expect(rows).toHaveCount(before); }
    else { await expect(row).toHaveCount(0); await expect(rows).toHaveCount(before - 1); }
  }
  checked('Limpar e apagar exigem confirmacao; cancelar preserva a conversa de exemplo');

  await page.locator('#pv-details-toggle').click();
  await page.locator('#original-contact-panel [data-bloco="inbox-contato"] button').first().click();
  await expect(page.locator('#original-contact-panel [data-bloco="inbox-contato"] [hidden]')).toHaveCount(0);
  await expect(page.locator('#original-contact-panel [data-bloco="inbox-contato"] .space-y-2')).toHaveCount(0);
  await page.locator('#original-contact-panel [data-bloco="inbox-contato"] button').first().click();
  await page.getByRole('button',{name:'Tags do contato',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Adicionar tag ao contato'})).toBeVisible();
  await page.keyboard.press('Escape');
  checked('Ficha reutilizada mantem recolhimento de secoes e editor original de tags');
  await page.close();

  const viewer = await browser.newPage({viewport:{width:1440,height:950}});
  await viewer.goto(pathToFileURL(path.resolve(output,'../inbox-layout.html')).href);
  const frame = viewer.frames().find(item => item.url().endsWith('/chat.html'));
  await frame.waitForSelector('#pv-chat');
  assert.equal(await frame.evaluate(()=>innerWidth),1920);
  await viewer.locator('[data-device="notebook"]').click(); assert.equal(await frame.evaluate(()=>innerWidth),1366);
  await viewer.locator('[data-device="tablet"]').click(); assert.equal(await frame.evaluate(()=>innerWidth),1024);
  await viewer.locator('#orientation').click(); assert.equal(await frame.evaluate(()=>innerWidth),768);
  checked('Visualizador alterna desktop, notebook e tablet nas duas orientacoes');
  await viewer.close();

  assert.deepEqual(errors,[]);
  assert.deepEqual(externalRequests,[]);
  const report = { date:new Date().toISOString(), browser:'Microsoft Edge / Playwright', passed:passed.length, checks:passed, layouts, copiedOriginalFiles:manifest.files.length, sidebarPixelIdentical:true, pageErrors:errors, externalRequests };
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
