import { test } from "node:test";
import assert from "node:assert/strict";
import { empresaSchema, validDocument, papelSchema } from "../src/lib/validation.ts";
import { authDestination } from "../src/lib/auth-redirect.ts";

test("valida dígitos verificadores de CPF e CNPJ, rejeitando repetições", () => {
  assert.equal(validDocument("52998224725"), true);
  assert.equal(validDocument("11222333000181"), true);
  for (const invalid of ["52998224724", "11222333000182", "11111111111", "00000000000000", "123", "abc"]) assert.equal(validDocument(invalid), false);
});
test("normaliza o documento e exige correspondência com o tipo de conta", () => {
  const parsed = empresaSchema.parse({ nome: "  Empresa teste  ", tipo: "CNPJ", documento: "11.222.333/0001-81" });
  assert.equal(parsed.nome, "Empresa teste");
  assert.equal(parsed.documento, "11222333000181");
  assert.equal(empresaSchema.safeParse({ nome: "Conta", tipo: "CPF", documento: parsed.documento }).success, false);
});
test("não permite atribuir proprietário pelo formulário de permissões", () => {
  assert.equal(papelSchema.safeParse("proprietario").success, false);
  assert.equal(papelSchema.safeParse("contador_completo").success, true);
});
test("redirecionamentos de autenticação aceitam apenas destinos internos conhecidos", () => {
  assert.equal(authDestination("/convites/" + "a".repeat(64)), "/convites/" + "a".repeat(64));
  for (const invalid of ["https://evil.example", "//evil.example", "/convites/../login", "/convites/a?next=evil", null]) assert.equal(authDestination(invalid), "/empresas");
});
