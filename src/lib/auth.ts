import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authDestination } from "@/lib/auth-redirect";

export async function requireUser(next?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(next ? `/login?next=${encodeURIComponent(authDestination(next))}` : "/login");
  return { supabase, user: data.user };
}
