import { expect, test } from "@playwright/test";

test("CSP com nonce: scripts carregam sem violação e o aviso de nova versão aparece", async ({ page }) => {
  const violacoes: string[] = [];
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violacoes.push(m.text()); });

  const res = await page.goto("/login");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  // Nonce muda a cada requisição.
  const outra = await page.request.get("/login");
  expect(outra.headers()["content-security-policy"]).not.toBe(csp);

  // Mesma versão: nada aparece.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(500);
  await expect(page.getByText("Nova versão disponível")).toHaveCount(0);

  // Servidor publicado de novo: a faixa aparece (prova que o JS hidratou sob a CSP).
  await page.route("**/api/versao", (r) => r.fulfill({ json: { versao: "outra-versao" } }));
  await page.getByLabel("E-mail", { exact: true }).fill("digitado@test.invalid");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("status").filter({ hasText: "Nova versão disponível" })).toBeVisible();
  // Não recarrega sozinho: o texto digitado continua no campo.
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("digitado@test.invalid");

  expect(violacoes).toEqual([]);
});

test("rota inexistente responde 404 em português, com CSP", async ({ page }) => {
  const res = await page.goto("/rota-que-nao-existe");
  expect(res?.status()).toBe(404);
  expect(res?.headers()["content-security-policy"]).toContain("nonce-");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("versão exposta sem cache", async ({ request }) => {
  const res = await request.get("/api/versao");
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect((await res.json()).versao).toBeTruthy();
});
