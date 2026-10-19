import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/empresas/:path*",
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/atualizar-senha",
    "/auth/:path*",
    "/convites/:path*",
  ],
};
