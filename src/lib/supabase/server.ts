import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Precisa ser chamado a cada request (não dá pra criar uma instância global) porque
 * lê os cookies da requisição atual para saber quem está logado.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de dentro de um Server Component (não pode setar cookie) — tudo bem,
            // o proxy.ts cuida de manter a sessão atualizada nesse caso.
          }
        },
      },
    },
  );
}
