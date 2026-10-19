-- Acessos com e-mail (só o proprietário) e saída voluntária de uma conta (não-proprietário).
create function public.listar_acessos(p_empresa uuid)
returns table(usuario_id uuid, email text, papel text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.dono_empresa(p_empresa) then return; end if;
 return query select v.usuario_id, u.email::text, v.papel from public.usuarios_empresas v join auth.users u on u.id=v.usuario_id
  where v.empresa_id=p_empresa order by (v.papel='proprietario') desc, u.email;
end $$;
revoke execute on function public.listar_acessos(uuid) from public,anon;
grant execute on function public.listar_acessos(uuid) to authenticated;

create function public.sair_da_empresa(p_empresa uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare removidos integer;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 delete from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=auth.uid() and papel<>'proprietario';
 get diagnostics removidos=row_count;
 return removidos>0;
end $$;
revoke execute on function public.sair_da_empresa(uuid) from public,anon;
grant execute on function public.sair_da_empresa(uuid) to authenticated;
