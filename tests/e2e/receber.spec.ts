import {test,expect,type Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
import {databaseClient} from "../../scripts/db-client.mjs";

test("contas a receber: clientes, encargos, estorno, parcelas, recorrência e acessos",async({page,browser})=>{
  test.setTimeout(180000);
  const created:string[]=[],prefix=randomUUID(),password=`Test-${randomUUID()}!`;
  const emails=[`receber-owner-${prefix}@example.com`,`receber-contador-${prefix}@example.com`];
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY??process.env.SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}});
  const accountantContext=await browser.newContext(),db=databaseClient();
  const alert=(current:Page,text:string)=>current.getByRole("alert").filter({hasText:text});
  const row=(text:string)=>page.getByRole("row").filter({hasText:text});
  async function login(current:Page,email:string){await current.goto("/login");await current.getByLabel("E-mail",{exact:true}).fill(email);await current.getByLabel("Senha",{exact:true}).fill(password);await current.getByRole("button",{name:"Entrar",exact:true}).click();await expect(current).toHaveURL(/\/empresas$/);}
  try{
    await db.connect();
    for(const email of emails){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw new Error("Não foi possível criar usuário de teste de receitas.");created.push(data.user.id);}
    await login(page,emails[0]);await page.getByLabel("Nome da conta").fill("Receitas E2E");await page.getByLabel("CPF ou CNPJ").fill("11222333000181");await page.getByRole("button",{name:"Criar conta",exact:true}).click();await expect(page).toHaveURL(/\/empresas\/[a-f0-9-]+$/);
    const empresaPath=new URL(page.url()).pathname,empresaId=empresaPath.split("/").at(-1)!;
    const cat=await admin.from("categorias").insert({empresa_id:empresaId,nome:"Vendas",tipo:"receita"}).select("id").single();
    const expense=await admin.from("categorias").insert({empresa_id:empresaId,nome:"Despesas invisíveis",tipo:"despesa"});
    const customer=await admin.from("clientes").insert({empresa_id:empresaId,nome:"Cliente E2E"}).select("id").single();
    const member=await admin.from("usuarios_empresas").insert({empresa_id:empresaId,usuario_id:created[1],papel:"contador_completo"});
    if(cat.error||expense.error||customer.error||member.error)throw new Error("Não foi possível preparar os cadastros de receitas de teste.");
    await page.getByRole("link",{name:"Abrir Contas a Receber",exact:true}).click();const receberPath=`${empresaPath}/receber`;
    await expect(page.getByRole("heading",{name:"Contas a Receber",exact:true})).toBeVisible();
    await expect(page.getByRole("option",{name:"Despesas invisíveis",exact:true})).toHaveCount(0);
    await expect(page.getByLabel("Senha de aprovação",{exact:true})).toHaveCount(0);
    await page.goto(`${receberPath}?status=todos`);
    async function launch(descricao:string,mode="unica",value="100,00",due="2026-01-31"){
      const form=page.getByRole("form",{name:"Novo lançamento",exact:true});
      await form.getByLabel("Descrição",{exact:true}).fill(descricao);await form.getByLabel("Cliente",{exact:true}).selectOption(customer.data!.id);await form.getByLabel("Categoria de receita",{exact:true}).selectOption(cat.data!.id);await form.getByLabel("Tipo de lançamento",{exact:true}).selectOption(mode);
      if(mode==="parcelado")await form.getByLabel("Número de parcelas",{exact:true}).fill("3");
      await form.getByLabel(mode==="parcelado"?"Valor total (R$)":mode==="recorrente"?"Valor mensal (R$)":"Valor (R$)",{exact:true}).fill(value);await form.getByLabel("Primeiro vencimento",{exact:true}).fill(due);await form.getByRole("button",{name:"Criar lançamento",exact:true}).click();await expect(alert(page,"Lançamento criado.")).toBeVisible();
    }
    await launch("Venda única");await expect(row("Venda única")).toContainText("R$ 100,00");
    await row("Venda única").getByRole("button",{name:"Receber",exact:true}).click();
    const receipt=page.getByRole("form",{name:"Registrar recebimento manual",exact:true});
    await receipt.getByLabel("Juros (R$)",{exact:true}).fill("2,00");await receipt.getByLabel("Multa (R$)",{exact:true}).fill("3,00");await receipt.getByLabel("Desconto (R$)",{exact:true}).fill("999,00");await receipt.getByRole("button",{name:"Registrar recebimento manual",exact:true}).click();await expect(alert(page,"Confira os valores e a data do recebimento.")).toBeVisible();await expect(receipt.getByLabel("Juros (R$)",{exact:true})).toHaveValue("2,00");
    await receipt.getByLabel("Desconto (R$)",{exact:true}).fill("1,25");await receipt.getByRole("button",{name:"Registrar recebimento manual",exact:true}).click();await expect(alert(page,"Recebimento manual registrado.")).toBeVisible();await expect(row("Venda única")).toContainText("R$ 103,75");await expect(row("Venda única").getByRole("button",{name:"Receber",exact:true})).toHaveCount(0);
    await row("Venda única").getByRole("button",{name:"Desfazer recebimento",exact:true}).click();const undo=page.getByRole("form",{name:"Desfazer recebimento",exact:true});await undo.getByLabel("Motivo para desfazer o recebimento",{exact:true}).fill("Data de recebimento incorreta");await undo.getByRole("button",{name:"Desfazer recebimento",exact:true}).click();await expect(alert(page,"Recebimento desfeito.")).toBeVisible();
    await row("Venda única").getByRole("link",{name:"Histórico",exact:true}).click();await expect(page.getByRole("heading",{name:"Histórico de recebimentos",exact:true})).toBeVisible();await expect(page.getByRole("row").filter({hasText:"Recebimento manual"})).toHaveCount(1);await expect(page.getByRole("row").filter({hasText:"Estorno"})).toContainText("Juros: R$ 2,00");await page.goto(`${receberPath}?status=todos`);
    await launch("Venda parcelada","parcelado");await expect(row("Venda parcelada")).toHaveCount(3);await expect(row("Venda parcelada").nth(0)).toContainText("R$ 33,34");await expect(row("Venda parcelada").nth(1)).toContainText("28/02/2026");await expect(row("Venda parcelada").nth(2)).toContainText("31/03/2026");
    const concurrent=await page.context().newPage();
    try{
      await row("Venda única").getByRole("button",{name:"Editar",exact:true}).click();await concurrent.goto(`${receberPath}?status=todos`);await concurrent.getByRole("row").filter({hasText:"Venda única"}).getByRole("button",{name:"Editar",exact:true}).click();
      const current=page.getByRole("form",{name:"Editar lançamento",exact:true});await current.getByLabel("Descrição",{exact:true}).fill("Venda revisada");await current.getByRole("button",{name:"Salvar alteração",exact:true}).click();await expect(row("Venda revisada")).toHaveCount(1);
      await concurrent.getByRole("form",{name:"Editar lançamento",exact:true}).getByRole("button",{name:"Salvar alteração",exact:true}).click();await expect(alert(concurrent,"Este lançamento mudou.")).toBeVisible();
    }finally{await concurrent.close();}
    await launch("Contrato mensal","recorrente","49,90","2026-10-31");await expect(row("Contrato mensal")).toHaveCount(12);
    await row("Contrato mensal").first().getByRole("button",{name:"Receber",exact:true}).click();await page.getByRole("form",{name:"Registrar recebimento manual",exact:true}).getByRole("button",{name:"Registrar recebimento manual",exact:true}).click();await expect(alert(page,"Recebimento manual registrado.")).toBeVisible();
    await row("Contrato mensal").first().getByRole("button",{name:"Interromper",exact:true}).click();await page.getByRole("form",{name:"Interromper recorrência",exact:true}).getByRole("button",{name:"Interromper recorrência",exact:true}).click();await expect(alert(page,"Recorrência interrompida.")).toBeVisible();await expect(row("Contrato mensal").first()).toContainText("Recebido");await expect(row("Contrato mensal").nth(1)).toContainText("Cancelado");
    await page.getByRole("button",{name:"Atualizar recorrências",exact:true}).click();await expect(alert(page,"0 ocorrência(s) gerada(s).")).toBeVisible();
    await launch("Venda cancelável");await row("Venda cancelável").getByRole("button",{name:"Cancelar",exact:true}).click();await page.getByRole("form",{name:"Cancelar lançamento",exact:true}).getByRole("button",{name:"Cancelar lançamento",exact:true}).click();await expect(row("Venda cancelável")).toContainText("Cancelado");
    const accountant=await accountantContext.newPage();await login(accountant,emails[1]);await accountant.goto(`${receberPath}?status=todos`);
    const accountantRow=accountant.getByRole("row").filter({hasText:"Venda revisada"});await accountantRow.getByRole("button",{name:"Receber",exact:true}).click();await accountant.getByRole("form",{name:"Registrar recebimento manual",exact:true}).getByRole("button",{name:"Registrar recebimento manual",exact:true}).click();await expect(alert(accountant,"Recebimento manual registrado.")).toBeVisible();
    await accountantRow.getByRole("button",{name:"Desfazer recebimento",exact:true}).click();const accountantUndo=accountant.getByRole("form",{name:"Desfazer recebimento",exact:true});await accountantUndo.getByLabel("Motivo para desfazer o recebimento",{exact:true}).fill("Recibo equivocado");await accountantUndo.getByRole("button",{name:"Desfazer recebimento",exact:true}).click();await expect(alert(accountant,"Recebimento desfeito.")).toBeVisible();
    await accountantRow.getByRole("button",{name:"Receber",exact:true}).click();await expect(accountant.getByRole("form",{name:"Registrar recebimento manual",exact:true})).toBeVisible();const revoke=await admin.from("usuarios_empresas").update({papel:"leitura"}).eq("empresa_id",empresaId).eq("usuario_id",created[1]);if(revoke.error)throw new Error("Não foi possível revogar acesso da fixture.");await accountant.getByRole("form",{name:"Registrar recebimento manual",exact:true}).getByRole("button",{name:"Registrar recebimento manual",exact:true}).click();await expect(alert(accountant,"Seu acesso não permite esta operação.")).toBeVisible();await accountant.reload();await expect(accountant.getByRole("button",{name:"Receber",exact:true})).toHaveCount(0);await expect(accountant.getByRole("button",{name:"Criar lançamento",exact:true})).toHaveCount(0);await expect(accountant.getByRole("link",{name:"Histórico",exact:true})).toHaveCount(17);
    await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[0]]);await db.query("set local role authenticated");
    const fixture={cliente_id:customer.data!.id,categoria_id:cat.data!.id,valor_centavos:100,vencimento:"2026-12-01",modo:"unica",parcelas:1};await db.query("select public.criar_receber($1,gen_random_uuid(),$2::jsonb||jsonb_build_object('descricao','Paginação '||n::text)) from generate_series(1,51) n",[empresaId,fixture]);await db.query("commit");await db.query("reset role");
    await page.goto(`${receberPath}?q=Paginação&status=todos`);await expect(row("Paginação")).toHaveCount(50);await page.getByRole("link",{name:"Próxima →",exact:true}).click();await expect(row("Paginação")).toHaveCount(1);
    await page.goto(`${receberPath}?status=recebido`);await expect(row("Contrato mensal")).toHaveCount(1);await expect(row("Venda cancelável")).toHaveCount(0);
    await page.screenshot({path:"test-results/contas-receber.png",fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:"test-results/contas-receber-mobile.png"});
    await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[1]]);await db.query("set local role authenticated");const other=(await db.query("select public.criar_empresa('Privada receitas','CPF','52998224725') as id")).rows[0].id;await db.query("commit");await db.query("reset role");expect((await page.goto(`/empresas/${other}/receber`))?.status()).toBe(404);
  }finally{
    await accountantContext.close();await db.query("rollback").catch(()=>{});await db.query("reset role").catch(()=>{});
    try{if(created.length)await db.query("delete from public.empresas where dono_id=any($1::uuid[])",[created]);}finally{await db.end();}
    for(const id of created){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error("Falha na remoção da fixture de receitas.");}
  }
});
