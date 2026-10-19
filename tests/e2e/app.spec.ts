import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { databaseClient } from "../../scripts/db-client.mjs";

test("guia visual, autenticação, cadastros, convites e isolamento funcionam no navegador", async ({ page, browser }) => {
  // Jornada extensa com Auth/DB reais; mesmo orçamento dos módulos financeiros.
  test.setTimeout(180000);
  const created: string[] = [];
  const prefix = randomUUID();
  const password = `Test-${randomUUID()}!`;
  const ownerEmail = `finbast-e2e-owner-${prefix}@example.com`;
  const readerEmail = `finbast-e2e-reader-${prefix}@example.com`;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SERVICE_ROLE;
  if (!key) throw new Error("Teste E2E requer chave administrativa server-only para criar e remover fixtures.");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
  async function signin(currentPage: Page, email: string) {
    await currentPage.getByLabel("E-mail", { exact: true }).fill(email);
    await currentPage.getByLabel("Senha", { exact: true }).fill(password);
    await currentPage.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  const readerContext = await browser.newContext();
  try {
    for (const email of [ownerEmail, readerEmail]) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw new Error("Não foi possível provisionar o usuário de teste.");
      created.push(data.user.id);
    }
    await page.goto("/empresas");
    await expect(page).toHaveURL(/\/login$/);
    await page.screenshot({ path: "test-results/login.png", fullPage: true });
    await page.goto("/styleguide");
    await expect(page.getByRole("heading", { name: "Uma base para cada tela." })).toBeVisible();
    await page.screenshot({ path: "test-results/styleguide-light.png", fullPage: true });
    await page.getByRole("button", { name: "Tema escuro", exact: true }).click();
    await expect(page.getByRole("button", { name: "Tema claro", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: "test-results/styleguide-dark.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/login");
    await signin(page, ownerEmail);
    await expect(page).toHaveURL(/\/empresas$/);
    await page.getByLabel("Nome da conta").fill("Empresa E2E");
    await page.getByLabel("CPF ou CNPJ").fill("11111111111111");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page.getByText("Informe um CPF ou CNPJ válido.")).toBeVisible();
    await page.getByLabel("CPF ou CNPJ").fill("11.222.333/0001-81");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page).toHaveURL(/\/empresas\/[a-f0-9-]+$/);
    const empresaPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: "Empresa E2E" })).toBeVisible();
    const cadastroNames: Record<string,string> = {};
    for (const kind of ["categorias","centros-custo","clientes","fornecedores"]) {
      await page.goto(`${empresaPath}/cadastros/${kind}`);
      await expect(page.getByRole("navigation",{name:"Tipos de cadastro"}).getByRole("link",{name:kind === "categorias" ? "Categorias" : kind === "centros-custo" ? "Centros de custo" : kind === "clientes" ? "Clientes" : "Fornecedores",exact:true})).toHaveCSS("color","rgb(255, 255, 255)");
      const name = `Cadastro E2E ${kind}`;
      await page.getByLabel("Nome", { exact: true }).fill(name);
      if (kind === "categorias") await page.getByLabel("Custo fixo",{exact:true}).check();
      if (kind === "centros-custo") await page.getByLabel("Descrição").fill("Área de teste");
      if (kind === "clientes" || kind === "fornecedores") {
        await page.getByLabel("CPF ou CNPJ").fill("11111111111");
        await page.getByRole("button",{ name: "Salvar cadastro",exact:true }).click();
        await expect(page.getByRole("alert").filter({hasText:"Informe um CPF ou CNPJ válido."})).toBeVisible();
        await expect(page.getByLabel("Nome",{exact:true})).toHaveValue(name);
        await page.getByLabel("CPF ou CNPJ").fill("529.982.247-25");
        await page.getByLabel("E-mail",{exact:false}).fill("CONTATO@example.com");
      }
      await page.getByRole("button",{ name: "Salvar cadastro",exact:true }).click();
      const row = page.getByTestId("cadastro-row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await row.getByRole("button",{name:`Editar ${name}`,exact:true}).click();
      const edited = `${name} revisado`;
      await page.getByLabel("Nome",{exact:true}).fill(edited);
      await page.getByRole("button",{name:"Salvar alterações",exact:true}).click();
      const editedRow = page.getByTestId("cadastro-row").filter({ hasText: edited });
      await expect(editedRow).toBeVisible();
      await editedRow.getByRole("button",{name:`Arquivar ${edited}`,exact:true}).click();
      await expect(editedRow).toHaveCount(0);
      await page.getByLabel("Mostrar",{exact:true}).selectOption("arquivados");
      await page.getByRole("button",{name:"Filtrar",exact:true}).click();
      await expect(editedRow).toBeVisible();
      await editedRow.getByRole("button",{name:`Reativar ${edited}`,exact:true}).click();
      await expect(editedRow).toHaveCount(0);
      await page.getByLabel("Mostrar",{exact:true}).selectOption("ativos");
      await page.getByRole("button",{name:"Filtrar",exact:true}).click();
      await expect(editedRow).toBeVisible();
      cadastroNames[kind] = edited;
    }
    const { error: paginationError } = await admin.from("centros_custo").insert(Array.from({length:51},(_,index)=>({empresa_id:empresaPath.split("/").at(-1),nome:`Centro paginação ${String(index).padStart(2,"0")}`})));
    if (paginationError) throw new Error("Não foi possível criar fixtures de paginação.");
    await page.goto(`${empresaPath}/cadastros/centros-custo`);
    await expect(page.getByTestId("cadastro-row")).toHaveCount(50);
    await page.getByRole("link",{name:"Próxima →",exact:true}).click();
    await expect(page.getByTestId("cadastro-row")).toHaveCount(2);
    await page.getByLabel("Buscar por nome").fill(cadastroNames["centros-custo"]);
    await page.getByRole("button",{name:"Filtrar",exact:true}).click();
    await expect(page.getByTestId("cadastro-row")).toHaveCount(1);
    await page.goto(`${empresaPath}/cadastros/clientes`);
    const concurrentPage = await page.context().newPage();
    try {
      await concurrentPage.goto(`${empresaPath}/cadastros/clientes`);
      await page.getByRole("button",{name:`Editar ${cadastroNames.clientes}`,exact:true}).click();
      await concurrentPage.getByRole("button",{name:`Editar ${cadastroNames.clientes}`,exact:true}).click();
      await page.getByLabel("Nome",{exact:true}).fill("Cliente edição atual");
      await page.getByRole("button",{name:"Salvar alterações",exact:true}).click();
      await expect(page.getByTestId("cadastro-row").filter({hasText:"Cliente edição atual"})).toBeVisible();
      await concurrentPage.getByLabel("Nome",{exact:true}).fill("Cliente edição antiga");
      await concurrentPage.getByRole("button",{name:"Salvar alterações",exact:true}).click();
      await expect(concurrentPage.getByRole("alert").filter({hasText:"Este cadastro mudou"})).toBeVisible();
      cadastroNames.clientes = "Cliente edição atual";
    } finally { await concurrentPage.close(); }
    await page.goto(`${empresaPath}/cadastros/categorias`);
    await page.getByLabel("Nome",{exact:true}).fill("Subcategoria E2E");
    await page.getByLabel("Categoria principal",{exact:true}).selectOption({label:cadastroNames.categorias});
    await page.getByRole("button",{name:"Salvar cadastro",exact:true}).click();
    await expect(page.getByTestId("cadastro-row").filter({hasText:"Subcategoria E2E"})).toBeVisible();
    await page.getByRole("button",{name:`Arquivar ${cadastroNames.categorias}`,exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:"arquive as subcategorias antes"})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:"test-results/cadastros.png",fullPage:true});
    await page.goto(empresaPath);
    await page.getByLabel("E-mail do convidado").fill(readerEmail);
    await page.getByRole("button", { name: "Criar convite", exact: true }).click();
    const inviteCode = page.locator("code").filter({ hasText: "/convites/" });
    await expect(inviteCode).toBeVisible();
    const invitePath = (await inviteCode.innerText()).trim();
    const readerPage = await readerContext.newPage();
    await readerPage.goto(new URL(invitePath, page.url()).href);
    await expect(readerPage).toHaveURL(/\/login\?next=/);
    await signin(readerPage, readerEmail);
    await expect(readerPage).toHaveURL(new RegExp(invitePath + "$"));
    await readerPage.getByRole("button", { name: "Aceitar convite" }).click();
    await expect(readerPage).toHaveURL(new RegExp(empresaPath + "$"));
    await expect(readerPage.getByText("Somente leitura", { exact: true })).toBeVisible();
    await expect(readerPage.getByLabel("E-mail do convidado")).toHaveCount(0);
    for (const kind of ["categorias","centros-custo","clientes","fornecedores"]) {
      await readerPage.goto(new URL(`${empresaPath}/cadastros/${kind}`,page.url()).href);
      await expect(readerPage.getByTestId("cadastro-row").filter({has:readerPage.getByText(cadastroNames[kind],{exact:true})})).toBeVisible();
      await expect(readerPage.getByRole("button",{name:"Salvar cadastro",exact:true})).toHaveCount(0);
      await expect(readerPage.getByRole("button",{name:/^Editar /})).toHaveCount(0);
    }
    await readerPage.goto(new URL(empresaPath,page.url()).href);
    await page.reload();
    const accessCard = page.locator('[data-slot="card"]').filter({ has: page.getByText("Acessos desta conta", { exact: true }) });
    await accessCard.getByRole("combobox", { name: "Nível de acesso" }).selectOption("operador");
    await accessCard.getByRole("button", { name: "Salvar acesso" }).click();
    await expect(page.getByText("Permissão atualizada.")).toBeVisible();
    await readerPage.reload();
    await expect(readerPage.getByText("Operador", { exact: true })).toBeVisible();
    await readerPage.goto(new URL(`${empresaPath}/cadastros/clientes`,page.url()).href);
    await readerPage.getByLabel("Nome",{exact:true}).fill("Cliente criado por operador");
    await readerPage.getByRole("button",{name:"Salvar cadastro",exact:true}).click();
    await expect(readerPage.getByTestId("cadastro-row").filter({hasText:"Cliente criado por operador"})).toBeVisible();
    await page.reload();
    await expect(accessCard.getByText(readerEmail, { exact: true })).toBeVisible();
    await page.getByLabel("Nome da conta", { exact: true }).fill("Conta E2E renomeada");
    await page.getByRole("button", { name: "Renomear", exact: true }).click();
    await expect(page.getByText("Nome atualizado.")).toBeVisible();
    await readerPage.goto(new URL(empresaPath, page.url()).href);
    await expect(readerPage.getByRole("heading", { name: "Conta E2E renomeada" })).toBeVisible();
    await expect(readerPage.getByLabel("Nome da conta", { exact: true })).toHaveCount(0);
    await expect(readerPage.getByRole("button", { name: "Remover acesso" })).toHaveCount(0);
    await readerPage.getByRole("button", { name: "Sair desta conta", exact: true }).click();
    await expect(readerPage).toHaveURL(/\/empresas$/);
    expect((await readerPage.goto(new URL(empresaPath, page.url()).href))?.status()).toBe(404);
    await page.reload();
    await expect(page.getByText(readerEmail, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: "test-results/empresa.png", fullPage: true });
    await page.getByRole("link", { name: "Trocar de conta" }).click();
    await expect(page).toHaveURL(/\/empresas$/);
    await page.getByLabel("Nome da conta").fill("Conta privada E2E");
    await page.getByLabel("Pessoal · CPF").click();
    await page.getByLabel("CPF ou CNPJ").fill("52998224725");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Conta privada E2E" })).toBeVisible();
    const deniedResponse = await readerPage.goto(page.url());
    expect(deniedResponse?.status()).toBe(404);
    const deniedCadastros = await readerPage.goto(new URL(`${new URL(page.url()).pathname}/cadastros/clientes`,page.url()).href);
    expect(deniedCadastros?.status()).toBe(404);
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(empresaPath);
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    await readerContext.close();
    if (created.length) {
      const database = databaseClient();
      try { await database.connect(); await database.query("delete from public.empresas where dono_id = any($1::uuid[])", [created]); }
      finally { await database.end(); }
      for (const id of created) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw new Error("Falha na remoção de um usuário de teste.");
      }
    }
  }
});
