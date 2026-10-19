import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Roda em todo request (ver src/proxy.ts) só pra manter a sessão do Supabase Auth
 * atualizada nos cookies. Páginas e Server Actions também verificam a sessão.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Necessário para manter o token válido — não remover.
  const { data, error } = await supabase.auth.getUser();

  const protectedPath = request.nextUrl.pathname === "/empresas" ||
    request.nextUrl.pathname.startsWith("/empresas/") || request.nextUrl.pathname === "/atualizar-senha";
  if (protectedPath && (error || !data.user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  supabaseResponse.headers.set("Cache-Control", "private, no-store");

  return supabaseResponse;
}
