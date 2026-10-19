import { test } from "node:test";
import assert from "node:assert/strict";
import { categorySchema, centroSchema, contactSchema } from "../src/lib/cadastros.ts";

const contact = { nome: "  Cliente Teste  ", documento: "", email: "", telefone: "", cidade: "", uf: "", observacoes: "" };
test("contatos podem ser cadastrados só com nome e campos vazios viram null",()=>{
  const parsed = contactSchema.parse(contact);
  assert.equal(parsed.nome,"Cliente Teste");
  assert.equal(parsed.documento,null);
  assert.equal(parsed.email,null);
  assert.equal(parsed.telefone,null);
});
test("normaliza contato e ignora campos de autorização injetados",()=>{
  const parsed = contactSchema.parse({ ...contact, documento: "529.982.247-25", email: "CONTATO@example.com", telefone: "+55 (71) 99999-9999", uf: "BA", empresa_id: "outra-empresa", papel: "proprietario" });
  assert.equal(parsed.documento,"52998224725");
  assert.equal(parsed.email,"contato@example.com");
  assert.equal(parsed.telefone,"5571999999999");
  assert.equal("empresa_id" in parsed,false);
  assert.equal("papel" in parsed,false);
});
test("recusa documento inválido, letras, telefone incompleto e UF inexistente",()=>{
  for (const fields of [{ documento: "52998224724" }, { documento: "abc" }, { telefone: "123" }, { uf: "ZZ" }]) assert.equal(contactSchema.safeParse({ ...contact,...fields }).success,false);
});
test("custo fixo é exclusivo de despesas e cor precisa pertencer à paleta",()=>{
  const category = { nome: "Salários", tipo: "despesa", cor: "vermelho", custo_fixo: true, pai_id: "" };
  assert.equal(categorySchema.parse(category).custo_fixo,true);
  assert.equal(categorySchema.safeParse({ ...category,tipo: "receita" }).success,false);
  assert.equal(categorySchema.safeParse({ ...category,cor: "url(https://example.com)" }).success,false);
});
test("limita textos e retira espaços dos centros de custo",()=>{
  assert.equal(centroSchema.parse({ nome: "  Marketing  ", descricao: "  " }).descricao,null);
  assert.equal(centroSchema.safeParse({ nome: "Marketing", descricao: "a".repeat(501) }).success,false);
});
