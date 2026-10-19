import {test,expect,type Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
import {databaseClient} from "../../scripts/db-client.mjs";

test("contas a pagar: parcelas, recorrência, aprovação, estorno e permissões",async({page,browser})=>{
  const created:string[]=[],prefix=randomUUID(),password=`Test-${randomUUID()}!`;
  const emails=[`pagar-owner-${prefix}@example.com`,`pagar-contador-${prefix}@example.com`];
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY??process.env.SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}});
  const accountantContext=await browser.newContext();
  const db=databaseClient();
  const alert=(current:Page,text:string)=>current.getByRole("alert").filter({hasText:text});
  async function login(current:Page,email:string){await current.goto("/login");await current.getByLabel("E-mail",{exact:true}).fill(email);await current.getByLabel("Senha",{exact:true}).fill(password);await current.getByRole("button",{name:"Entrar",exact:true}).click();await expect(current).toHaveURL(/\/empresas$/);}
  try{
    await db.connect();
    for(const email of emails){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw new Error("Não foi possível criar usuário financeiro de teste.");created.push(data.user.id);}
    await login(page,emails[0]);await page.getByLabel("Nome da conta").fill("Financeiro E2E");await page.getByLabel("CPF ou CNPJ").fill("11222333000181");await page.getByRole("button",{name:"Criar conta",exact:true}).click();await expect(page).toHaveURL(/\/empresas\/[a-f0-9-]+$/);
    const empresaPath=new URL(page.url()).pathname,empresaId=empresaPath.split("/").at(-1)!;
    const cat=await admin.from("categorias").insert({empresa_id:empresaId,nome:"Serviços",tipo:"despesa",custo_fixo:true}).select("id").single();
    const supplier=await admin.from("fornecedores").insert({empresa_id:empresaId,nome:"Fornecedor E2E"}).select("id").single();
    const member=await admin.from("usuarios_empresas").insert({empresa_id:empresaId,usuario_id:created[1],papel:"contador_completo"});
    if(cat.error||supplier.error||member.error)throw new Error("Não foi possível preparar os cadastros financeiros de teste.");
    await page.getByRole("link",{name:"Abrir Contas a Pagar",exact:true}).click();const pagarPath=`${empresaPath}/pagar`;
    await page.goto(`${pagarPath}?status=todos`);
    await page.getByLabel("Nova senha de aprovação",{exact:true}).fill("193750");await page.getByLabel("Confirmar senha de aprovação",{exact:true}).fill("193750");await page.getByRole("button",{name:"Configurar senha",exact:true}).click();await expect(alert(page,"Senha de aprovação configurada.")).toBeVisible();
    async function launch(descricao:string,mode="unica",value="100,00",due="2026-01-31"){
      const form=page.getByRole("form",{name:"Novo lançamento",exact:true});
      await form.getByLabel("Descrição",{exact:true}).fill(descricao);await form.getByLabel("Fornecedor",{exact:true}).selectOption(supplier.data!.id);await form.getByLabel("Categoria de despesa",{exact:true}).selectOption(cat.data!.id);await form.getByLabel("Tipo de lançamento",{exact:true}).selectOption(mode);
      if(mode==="parcelado")await form.getByLabel("Número de parcelas",{exact:true}).fill("3");
      await form.getByLabel(mode==="parcelado"?"Valor total (R$)":mode==="recorrente"?"Valor mensal (R$)":"Valor (R$)",{exact:true}).fill(value);await form.getByLabel("Primeiro vencimento",{exact:true}).fill(due);await form.getByRole("button",{name:"Criar lançamento",exact:true}).click();await expect(alert(page,"Lançamento criado.")).toBeVisible();
    }
    await launch("Compra única");
    let row=page.getByRole("row").filter({hasText:"Compra única"});await expect(row).toContainText("R$ 100,00");await expect(row).toContainText("Custo fixo");
    await row.getByRole("button",{name:"Baixar",exact:true}).click();
    const payment=page.getByRole("form",{name:"Registrar baixa manual",exact:true});
    await payment.getByLabel("Juros (R$)",{exact:true}).fill("2,00");await payment.getByLabel("Multa (R$)",{exact:true}).fill("3,00");await payment.getByLabel("Desconto (R$)",{exact:true}).fill("1,25");await payment.getByLabel("Senha de aprovação",{exact:true}).fill("000000");await payment.getByRole("button",{name:"Registrar baixa manual",exact:true}).click();await expect(alert(page,"Senha de aprovação incorreta.")).toBeVisible();
    await expect(payment.getByLabel("Juros (R$)",{exact:true})).toHaveValue("2,00");await expect(payment.getByLabel("Senha de aprovação",{exact:true})).toHaveValue("");
    await payment.getByLabel("Senha de aprovação",{exact:true}).fill("193750");await payment.getByRole("button",{name:"Registrar baixa manual",exact:true}).click();await expect(alert(page,"Baixa manual registrada.")).toBeVisible();await expect(row).toContainText("R$ 103,75");await expect(row.getByRole("button",{name:"Baixar",exact:true})).toHaveCount(0);
    await row.getByRole("button",{name:"Desfazer baixa",exact:true}).click();const undo=page.getByRole("form",{name:"Desfazer baixa",exact:true});await undo.getByLabel("Motivo para desfazer a baixa",{exact:true}).fill("Pagamento registrado incorretamente");await undo.getByLabel("Senha de aprovação",{exact:true}).fill("193750");await undo.getByRole("button",{name:"Desfazer baixa",exact:true}).click();await expect(alert(page,"Baixa desfeita.")).toBeVisible();
    await row.getByRole("link",{name:"Histórico",exact:true}).click();await expect(page.getByRole("heading",{name:"Histórico de pagamentos",exact:true})).toBeVisible();await expect(page.getByRole("row").filter({hasText:"Baixa manual"})).toHaveCount(1);await expect(page.getByRole("row").filter({hasText:"Estorno"})).toHaveCount(1);await page.goto(`${pagarPath}?status=todos`);
    await launch("Compra parcelada","parcelado");const installments=page.getByRole("row").filter({hasText:"Compra parcelada"});await expect(installments).toHaveCount(3);await expect(installments.nth(0)).toContainText("R$ 33,34");await expect(installments.nth(1)).toContainText("28/02/2026");await expect(installments.nth(2)).toContainText("31/03/2026");
    await launch("Assinatura mensal","recorrente","49,90","2026-10-31");const recurring=page.getByRole("row").filter({hasText:"Assinatura mensal"});await expect(recurring).toHaveCount(12);await recurring.first().getByRole("button",{name:"Interromper",exact:true}).click();await page.getByRole("form",{name:"Interromper recorrência",exact:true}).getByRole("button",{name:"Interromper recorrência",exact:true}).click();await expect(alert(page,"Recorrência interrompida.")).toBeVisible();await expect(recurring.first()).toContainText("Cancelado");
    await page.getByRole("button",{name:"Atualizar recorrências",exact:true}).click();await expect(alert(page,"0 ocorrência(s) gerada(s).")).toBeVisible();
    // O link administrativo fornece OTP sem enviar e-mail. A confirmação usa Auth real e JWT real.
    await page.getByRole("button",{name:"Trocar senha de aprovação",exact:true}).click();
    const generated=await admin.auth.admin.generateLink({type:"magiclink",email:emails[0]});if(generated.error||!generated.data.properties.email_otp)throw new Error("Não foi possível gerar OTP para validar troca de aprovação.");
    await page.getByLabel("Código recebido por e-mail",{exact:true}).fill(generated.data.properties.email_otp);await page.getByLabel("Nova senha de aprovação",{exact:true}).fill("284061");await page.getByLabel("Confirmar senha de aprovação",{exact:true}).fill("284061");await page.getByRole("button",{name:"Confirmar troca",exact:true}).click();await expect(alert(page,"Senha de aprovação alterada.")).toBeVisible();
    const approved=(await db.query("select extensions.crypt('284061',hash)=hash as valid from private.senhas_aprovacao where usuario_id=$1",[created[0]])).rows[0];expect(approved.valid).toBe(true);
    row=page.getByRole("row").filter({hasText:"Compra única"});await row.getByRole("button",{name:"Baixar",exact:true}).click();await page.getByRole("form",{name:"Registrar baixa manual",exact:true}).getByLabel("Senha de aprovação",{exact:true}).fill("284061");await page.getByRole("form",{name:"Registrar baixa manual",exact:true}).getByRole("button",{name:"Registrar baixa manual",exact:true}).click();await expect(alert(page,"Baixa manual registrada.")).toBeVisible();
    const accountant=await accountantContext.newPage();await login(accountant,emails[1]);await accountant.goto(`${pagarPath}?status=todos`);await expect(accountant.getByRole("button",{name:"Baixar",exact:true})).toHaveCount(0);await expect(accountant.getByRole("heading",{name:"Senha de aprovação",exact:true})).toHaveCount(0);
    const editable=accountant.getByRole("row").filter({hasText:"Compra parcelada"}).first();await editable.getByRole("button",{name:"Editar",exact:true}).click();await expect(accountant.getByRole("form",{name:"Editar lançamento",exact:true})).toBeVisible();
    const changedRole=await admin.from("usuarios_empresas").update({papel:"leitura"}).eq("empresa_id",empresaId).eq("usuario_id",created[1]);if(changedRole.error)throw new Error("Não foi possível revogar a escrita na fixture.");
    await accountant.getByRole("form",{name:"Editar lançamento",exact:true}).getByRole("button",{name:"Salvar alteração",exact:true}).click();await expect(alert(accountant,"Seu acesso não permite esta operação.")).toBeVisible();await accountant.reload();await expect(accountant.getByRole("button",{name:"Criar lançamento",exact:true})).toHaveCount(0);await expect(accountant.getByRole("link",{name:"Histórico",exact:true})).toHaveCount(16);
    await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[0]]);await db.query("set local role authenticated");
    const fixture={descricao:"Paginação",fornecedor_id:supplier.data!.id,categoria_id:cat.data!.id,valor_centavos:100,vencimento:"2026-12-01",modo:"unica",parcelas:1};
    await db.query("select public.criar_pagar($1,gen_random_uuid(),$2::jsonb||jsonb_build_object('descricao','Paginação '||n::text)) from generate_series(1,51) n",[empresaId,fixture]);await db.query("commit");await db.query("reset role");
    await page.goto(`${pagarPath}?q=Paginação&status=todos`);await expect(page.getByRole("row").filter({hasText:"Paginação"})).toHaveCount(50);await page.getByRole("link",{name:"Próxima →",exact:true}).click();await expect(page.getByRole("row").filter({hasText:"Paginação"})).toHaveCount(1);
    await page.goto(`${pagarPath}?status=todos`);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:"test-results/contas-pagar-mobile.png",fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:"test-results/contas-pagar.png",fullPage:true});
    await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[1]]);await db.query("set local role authenticated");
    const privateCompany=(await db.query("select public.criar_empresa('Privada E2E','CPF','52998224725') as id")).rows[0].id;await db.query("commit");await db.query("reset role");
    const denied=await page.goto(`/empresas/${privateCompany}/pagar`);expect(denied?.status()).toBe(404);
  }finally{
    await accountantContext.close();await db.query("rollback").catch(()=>{});await db.query("reset role").catch(()=>{});
    try{if(created.length)await db.query("delete from public.empresas where dono_id=any($1::uuid[])",[created]);}finally{await db.end();}
    for(const id of created){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error("Falha na remoção da fixture financeira.");}
  }
});
