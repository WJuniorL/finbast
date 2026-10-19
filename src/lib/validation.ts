import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(8, "Use pelo menos 8 caracteres.").max(128);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const signupSchema = z.object({ email: emailSchema, password: passwordSchema });

export function validDocument(value: string): boolean {
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  if (value.length === 11) {
    return digit(value, [10,9,8,7,6,5,4,3,2]) === Number(value[9]) &&
      digit(value, [11,10,9,8,7,6,5,4,3,2]) === Number(value[10]);
  }
  return digit(value, [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(value[12]) &&
    digit(value, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(value[13]);
}

export const empresaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  tipo: z.enum(["CPF", "CNPJ"]),
  documento: z.string().max(24).transform((value) => value.replace(/\D/g, "")),
}).refine(({ tipo, documento }) => documento.length === (tipo === "CPF" ? 11 : 14) && validDocument(documento),
  { message: "Informe um CPF ou CNPJ válido.", path: ["documento"] });

export const papelSchema = z.enum(["administrador", "operador", "leitura", "contador_completo", "contador_leitura"]);
