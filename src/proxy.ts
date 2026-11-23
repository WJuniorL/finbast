import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Rotas que leem/renovam a sessão do Supabase Auth. As demais só recebem a CSP.
const SESSION_PATHS = ["/empresas", "/login", "/cadastro", "/recuperar-senha", "/atualizar-senha", "/auth", "/convites"];

function buildCsp(nonce: string, isDev: boolean) {
  // style-src com 'unsafe-inline': React renderiza atributos style="" no SSR, que nonce não cobre.
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  // Next lê o nonce do CSP da requisição e aplica nos próprios scripts.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const path = request.nextUrl.pathname;
  const needsSession = path === "/" || SESSION_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const response = needsSession ? await updateSession(request) : NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Tudo menos assets estáticos e as prévias HTML em public/previews.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|previews/).*)"],
};
