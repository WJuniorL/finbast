// Destinos internos permitidos; valores arbitrários nunca chegam a redirect().
export function authDestination(value: unknown): string {
  if (value === "/atualizar-senha") return value;
  if (typeof value === "string" && /^\/convites\/[a-f0-9]{64}$/.test(value)) return value;
  return "/empresas";
}
