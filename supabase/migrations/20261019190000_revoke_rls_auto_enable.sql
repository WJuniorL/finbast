-- Função do event trigger ensure_rls; não deve ser chamável via /rest/v1/rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
