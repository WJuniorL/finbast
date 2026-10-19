import {test,expect,type Page} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
import {databaseClient} from "../../scripts/db-client.mjs";
import {cashFixture,fixtureRpc} from "../../scripts/fluxo-fixture.mjs";

test("fluxo de caixa: saldos, previsões, contas, origens, filtros e acesso de leitura",async({page,browser})=>{
 test.setTimeout(180000);
 const created:string[]=[],prefix=randomUUID(),password=`Test-${randomUUID()}!`,emails=[`cash-owner-${prefix}@example.com`,`cash-reader-${prefix}@example.com`];
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY??process.env.SERVICE_ROLE!,{auth:{persistSession:false,autoRefreshToken:false}}),db=databaseClient(),otherContext=await browser.newContext();
 async function login(current:Page,email:string){await current.goto("/login");await current.getByLabel("E-mail",{exact:true}).fill(email);await current.getByLabel("Senha",{exact:true}).fill(password);await current.getByRole("button",{name:"Entrar",exact:true}).click();await expect(current).toHaveURL(/\/empresas$/);}
 try {
  await db.connect();for(const email of emails){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw new Error("Falha na fixture de fluxo de caixa.");created.push(data.user.id);}
  await db.query("begin");const fixture=await cashFixture(db,created[0]);await db.query("reset role");await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'contador_leitura')",[fixture.empresa,created[1]]);await db.query("commit");
  const empresaPath=`/empresas/${fixture.empresa}`,path=`${empresaPath}/fluxo-caixa`,filter="?inicio=2026-01-29&fim=2026-02-02";
  await login(page,emails[0]);await page.goto(empresaPath);await page.getByRole("link",{name:"Abrir fluxo de caixa",exact:true}).click();await expect(page.getByRole("heading",{name:"Fluxo de caixa",exact:true})).toBeVisible();
  await page.getByLabel("Período de",{exact:true}).fill("2026-01-29");await page.getByLabel("Até",{exact:true}).fill("2026-02-02");await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();
  await expect(page.getByTestId("Saldo realizado inicial")).toHaveText("R$ 954,00");await expect(page.getByTestId("Saldo realizado final")).toHaveText("R$ 1.079,00");await expect(page.getByTestId("Saldo projetado final")).toHaveText("R$ 1.136,00");
  await expect(page.getByTestId("Saídas realizadas")).toHaveText("R$ 105,00");await expect(page.getByTestId("Vencidos anteriores · a pagar")).toHaveText("R$ 7,00");
  await expect(page.getByRole("link",{name:"Pagamento conciliado",exact:true})).toHaveCount(0);
  await page.getByRole("link",{name:"Saída no extrato",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/bancos/${fixture.conta}/movimentos/${fixture.debito}$`));await page.goto(`${path}${filter}`);
  await page.getByRole("link",{name:"Pagamento previsto",exact:true}).click();await expect(page).toHaveURL(new RegExp(`/pagar/${fixture.aberto.id}$`));await page.goto(`${path}${filter}`);
  await page.getByLabel("Agrupar por",{exact:true}).selectOption("mensal");await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await expect(page.getByText("Evolução mensal",{exact:true})).toBeVisible();
  const evolution=page.getByRole("table").first();await expect(evolution.getByRole("row")).toHaveCount(3);await expect(evolution.getByRole("row").filter({hasText:"01/2026"})).toContainText("R$ 1.079,00");
  await page.getByLabel("Conta bancária",{exact:true}).selectOption(fixture.conta);await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await expect(page.getByTestId("Saldo realizado final")).toHaveText("R$ 1.095,00");await expect(page.getByTestId("Saídas previstas no período")).toHaveText("R$ 0,00");await expect(page.getByRole("alert").filter({hasText:"Esta conta mostra o extrato"})).toBeVisible();
  await page.getByLabel("Conta bancária",{exact:true}).selectOption(fixture.segunda);await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await expect(page.getByTestId("Saldo realizado final")).toHaveText("− R$ 50,00");await expect(page.getByText("Nenhum movimento neste filtro.",{exact:true})).toBeVisible();
  await page.getByLabel("Conta bancária",{exact:true}).selectOption("sem-conta");await page.getByRole("button",{name:"Aplicar filtros",exact:true}).click();await expect(page.getByTestId("Saldo realizado final")).toHaveText("R$ 34,00");await expect(page.getByTestId("Saldo projetado final")).toHaveText("R$ 91,00");
  await page.goto(`${path}?inicio=2026-02-03&fim=2026-02-02`);await expect(page.getByRole("alert").filter({hasText:"Filtros inválidos"})).toContainText("Filtros inválidos");await expect(page.getByTestId("Saldo realizado final")).toHaveCount(0);
  await page.goto(`${path}?inicio=2026-01-01&fim=2027-01-02`);await expect(page.getByRole("alert").filter({hasText:"Filtros inválidos"})).toContainText("no máximo 366 dias");
  await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[0]]);await db.query("set local role authenticated");for(let i=0;i<52;i++)await fixture.title("receber",`Página ${i}`,1,"2026-02-02");await db.query("commit");await db.query("reset role");
  await page.goto(`${path}${filter}`);await expect(page.getByRole("table").last().getByRole("row")).toHaveCount(51);await expect(page.getByTestId("Saldo projetado final")).toHaveText("R$ 1.136,52");await page.getByRole("link",{name:"Próxima →",exact:true}).click();await expect(page.getByText("59 origem(ns) · Página 2 de 2",{exact:true})).toBeVisible();await expect(page.getByTestId("Saldo projetado final")).toHaveText("R$ 1.136,52");
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:"test-results/fluxo-caixa-mobile.png"});await page.setViewportSize({width:1280,height:900});
  const reader=await otherContext.newPage();await login(reader,emails[1]);await reader.goto(`${path}${filter}`);await expect(reader.getByTestId("Saldo realizado final")).toHaveText("R$ 1.079,00");
  await db.query("begin");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[created[1]]);await db.query("set local role authenticated");const other=(await db.query("select public.criar_empresa('Fluxo isolado','CPF','11144477735') as id")).rows[0].id;
  const foreign=(await fixtureRpc(db,"salvar_conta_bancaria",[other,null,null,{nome:"Conta isolada",banco:"Teste",numero:"123",saldo_inicial_centavos:0,data_saldo_inicial:"2026-01-01"}])).id;await db.query("commit");await db.query("reset role");
  expect((await page.goto(`/empresas/${other}/fluxo-caixa${filter}`))?.status()).toBe(404);expect((await page.goto(`${path}${filter}&conta=${foreign}`))?.status()).toBe(404);
  await db.query("delete from public.usuarios_empresas where empresa_id=$1 and usuario_id=$2",[fixture.empresa,created[1]]);expect((await reader.goto(`${path}${filter}`))?.status()).toBe(404);
 }finally {
  await otherContext.close();await db.query("rollback").catch(()=>{});await db.query("reset role").catch(()=>{});
  try{if(created.length)await db.query("delete from public.empresas where dono_id=any($1::uuid[])",[created]);}finally{await db.end();}
  for(const id of created){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error("Falha na remoção da fixture de fluxo de caixa.");}
 }
});
