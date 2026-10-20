import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { databaseClient } from "../../scripts/db-client.mjs";

// Usa o modelo real (OPENAI_*) só nos passos marcados; a base local não chama o modelo.
test("assistente: base local, agente, proposta com confirmação e acesso somente leitura", async ({ page, browser }) => {
  test.setTimeout(240000);
  const created: string[] = [], prefix = randomUUID(), password = `Test-${randomUUID()}!`, emails = [`ia-owner-${prefix}@example.com`, `ia-reader-${prefix}@example.com`];
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY ?? process.env.SERVICE_ROLE!, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = databaseClient(), readerContext = await browser.newContext();
  const nomeFornecedor = "Papelaria Aurora";
  async function login(p: Page, email: string) { await p.goto("/login"); await p.getByLabel("E-mail", { exact: true }).fill(email); await p.getByLabel("Senha", { exact: true }).fill(password); await p.getByRole("button", { name: "Entrar", exact: true }).click(); await expect(p).toHaveURL(/\/empresas$/); }
  async function ask(p: Page, text: string) { await p.getByLabel("Sua pergunta", { exact: true }).fill(text); await p.getByRole("button", { name: "Perguntar", exact: true }).click(); }
  try {
    await db.connect();
    for (const email of emails) { const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (error || !data.user) throw new Error("Falha ao criar fixture do assistente."); created.push(data.user.id); }
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [created[0]]); await db.query("set role authenticated");
    const empresa = (await db.query("select public.criar_empresa('Assistente E2E','CPF','52998224725') as id")).rows[0].id as string;
    await db.query("reset role"); await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'leitura')", [empresa, created[1]]);
    const path = `/empresas/${empresa}/assistente`;

    // Base local: resposta imediata, com link e botão de escape; não consome o teto diário.
    await login(page, emails[0]); await page.goto(path);
    await expect(page.getByText("enviados à OpenAI")).toBeVisible();
    await ask(page, "como lanço uma despesa");
    await expect(page.getByText("Abra Contas a Pagar, preencha descrição")).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir Contas a Pagar", exact: true })).toHaveAttribute("href", `/empresas/${empresa}/pagar`);
    await expect(page.getByRole("button", { name: "Perguntar ao assistente", exact: true })).toBeVisible();
    expect((await db.query("select coalesce(sum(perguntas),0)::int n from public.assistente_uso_diario where empresa_id=$1", [empresa])).rows[0].n).toBe(0);

    // Agente (modelo real): proposta de cadastro, confirmação e gravação pelas regras das telas.
    await ask(page, `Crie um fornecedor chamado ${nomeFornecedor}`);
    const card = page.getByTestId("proposta");
    await expect(card).toBeVisible({ timeout: 90000 });
    await expect(card).toContainText(nomeFornecedor);
    expect((await db.query("select count(*)::int n from public.fornecedores where empresa_id=$1 and nome=$2", [empresa, nomeFornecedor])).rows[0].n).toBe(0);
    await card.getByRole("button", { name: "Confirmar e criar", exact: true }).click();
    await expect(card.getByRole("status")).toContainText("Cadastro criado", { timeout: 30000 });
    expect((await db.query("select count(*)::int n from public.fornecedores where empresa_id=$1 and nome=$2", [empresa, nomeFornecedor])).rows[0].n).toBe(1);
    expect((await db.query("select perguntas from public.assistente_uso_diario where empresa_id=$1", [empresa])).rows[0].perguntas).toBeGreaterThan(0);

    // Ferramenta de leitura: o agente consulta os cadastros da empresa.
    await ask(page, "Quais fornecedores tenho cadastrados?");
    await expect(page.getByText(nomeFornecedor).last()).toBeVisible({ timeout: 90000 });
    await expect(page.getByText("Pensando…")).toBeHidden({ timeout: 90000 });
    await expect(page.locator("p").filter({ hasText: nomeFornecedor }).last()).toBeVisible();

    // Somente leitura: base restrita, sem ação de criação; "despesa" cai no agente, que não propõe nada.
    const reader = await readerContext.newPage(); await login(reader, emails[1]); await reader.goto(path);
    await expect(reader.getByText("Seu acesso é somente leitura")).toBeVisible();
    await ask(reader, "onde vejo o fluxo de caixa");
    await expect(reader.getByText("O Fluxo de caixa mostra")).toBeVisible();
    await ask(reader, `Crie um fornecedor chamado Distribuidora Boa Vista`);
    await expect(reader.getByText("Pensando…")).toBeHidden({ timeout: 90000 });
    await expect(reader.getByTestId("proposta")).toHaveCount(0);
    expect((await db.query("select count(*)::int n from public.fornecedores where empresa_id=$1", [empresa])).rows[0].n).toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await readerContext.close();
    try { if (created.length) await db.query("delete from public.empresas where dono_id=any($1::uuid[])", [created]); } finally { await db.end(); }
    for (const id of created) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw new Error("Falha na remoção da fixture do assistente."); }
  }
});
