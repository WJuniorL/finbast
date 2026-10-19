-- Empresas e permissões: toda autorização deriva de auth.uid(), nunca do formulário.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  tipo text not null check (tipo in ('CPF', 'CNPJ')),
  documento text not null check (
    (tipo = 'CPF' and documento ~ '^[0-9]{11}$') or
    (tipo = 'CNPJ' and documento ~ '^[0-9]{14}$')
  ),
  dono_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  unique (dono_id, documento)
);

create table public.usuarios_empresas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('proprietario', 'administrador', 'operador', 'leitura', 'contador_completo', 'contador_leitura')),
  criado_em timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);
create index usuarios_empresas_usuario_idx on public.usuarios_empresas (usuario_id, empresa_id);

alter table public.empresas enable row level security;
alter table public.usuarios_empresas enable row level security;
revoke all on public.empresas, public.usuarios_empresas from anon, authenticated;
grant select, insert on public.empresas to authenticated;
grant update (nome) on public.empresas to authenticated;
grant select, insert, delete on public.usuarios_empresas to authenticated;
grant update (papel) on public.usuarios_empresas to authenticated;

-- Consultas internas evitam recursão de RLS entre empresas e vínculos.
-- Não são expostas pela Data API. A identidade vem exclusivamente do token verificado.
create function private.tem_papel_empresa(p_empresa uuid, p_papeis text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.usuarios_empresas
    where empresa_id = p_empresa and usuario_id = (select auth.uid())
      and papel = any(p_papeis)
  );
$$;
create function private.dono_empresa(p_empresa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.empresas where id = p_empresa and dono_id = (select auth.uid())
  );
$$;
revoke all on function private.tem_papel_empresa(uuid, text[]), private.dono_empresa(uuid) from public, anon;
grant execute on function private.tem_papel_empresa(uuid, text[]), private.dono_empresa(uuid) to authenticated;

create policy empresas_select on public.empresas for select to authenticated using (
  dono_id = (select auth.uid()) or private.tem_papel_empresa(id,
    array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura'])
);
create policy empresas_insert on public.empresas for insert to authenticated
  with check (dono_id = (select auth.uid()));
create policy empresas_update on public.empresas for update to authenticated
  using (dono_id = (select auth.uid())) with check (dono_id = (select auth.uid()));

create policy vinculos_select on public.usuarios_empresas for select to authenticated
  using (usuario_id = (select auth.uid()) or private.dono_empresa(empresa_id));
create policy vinculos_insert on public.usuarios_empresas for insert to authenticated
  with check (private.dono_empresa(empresa_id) and (
    (usuario_id = (select auth.uid()) and papel = 'proprietario') or
    (usuario_id <> (select auth.uid()) and papel <> 'proprietario')
  ));
create policy vinculos_update on public.usuarios_empresas for update to authenticated
  using (private.dono_empresa(empresa_id) and usuario_id <> (select auth.uid()) and papel <> 'proprietario')
  with check (private.dono_empresa(empresa_id) and usuario_id <> (select auth.uid()) and papel <> 'proprietario');
create policy vinculos_delete on public.usuarios_empresas for delete to authenticated
  using (private.dono_empresa(empresa_id) and usuario_id <> (select auth.uid()) and papel <> 'proprietario');

-- Criação atômica da empresa e de seu vínculo proprietário, respeitando RLS.
create function public.criar_empresa(p_nome text, p_tipo text, p_documento text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare nova_empresa uuid;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  insert into public.empresas (nome, tipo, documento, dono_id)
    values (btrim(p_nome), p_tipo, p_documento, auth.uid()) returning id into nova_empresa;
  insert into public.usuarios_empresas (empresa_id, usuario_id, papel)
    values (nova_empresa, auth.uid(), 'proprietario');
  return nova_empresa;
end;
$$;
revoke all on function public.criar_empresa(text, text, text) from public, anon;
grant execute on function public.criar_empresa(text, text, text) to authenticated;

create table public.convites_empresas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
  papel text not null check (papel in ('administrador','operador','leitura','contador_completo','contador_leitura')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now() check (criado_em <= now()),
  expira_em timestamptz not null default now() + interval '7 days',
  aceito_em timestamptz,
  check (expira_em > criado_em and expira_em <= criado_em + interval '7 days')
);
create index convites_empresas_empresa_idx on public.convites_empresas (empresa_id);
create index convites_empresas_criado_por_idx on public.convites_empresas (criado_por);
alter table public.convites_empresas enable row level security;
revoke all on public.convites_empresas from anon, authenticated;
grant select, insert, delete on public.convites_empresas to authenticated;
create policy convites_select on public.convites_empresas for select to authenticated
  using (private.dono_empresa(empresa_id));
create policy convites_insert on public.convites_empresas for insert to authenticated
  with check (private.dono_empresa(empresa_id) and criado_por = (select auth.uid()) and aceito_em is null);
create policy convites_delete on public.convites_empresas for delete to authenticated
  using (private.dono_empresa(empresa_id) and aceito_em is null);

-- Aceitação precisa gravar o vínculo de um destinatário que ainda não tem acesso.
-- Operação privilegiada fica no schema privado e valida token, e-mail confirmado e prazo.
create function private.aceitar_convite(p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare convite public.convites_empresas; email_usuario text;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select lower(email) into email_usuario from auth.users
    where id = auth.uid() and email_confirmed_at is not null;
  select * into convite from public.convites_empresas
    where token_hash = p_hash and email = email_usuario and aceito_em is null
      and expira_em > now() for update;
  if not found then raise insufficient_privilege; end if;
  -- Um convite não altera permissões de um usuário já vinculado.
  if exists (select 1 from public.usuarios_empresas where empresa_id = convite.empresa_id and usuario_id = auth.uid())
    then raise insufficient_privilege; end if;
  insert into public.usuarios_empresas (empresa_id, usuario_id, papel)
    values (convite.empresa_id, auth.uid(), convite.papel);
  update public.convites_empresas set aceito_em = now() where id = convite.id;
  return convite.empresa_id;
end;
$$;
revoke all on function private.aceitar_convite(text) from public, anon;
grant execute on function private.aceitar_convite(text) to authenticated;
create function public.aceitar_convite(p_hash text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.aceitar_convite(p_hash);
$$;
revoke all on function public.aceitar_convite(text) from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;
