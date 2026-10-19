-- Cadastros por empresa. Arquivamento preserva referências dos módulos financeiros.
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  tipo text not null check (tipo in ('receita','despesa')),
  cor text not null default 'vermelho' check (cor in ('vermelho','ambar','verde','azul','escuro','cinza')),
  custo_fixo boolean not null default false check (not custo_fixo or tipo = 'despesa'),
  pai_id uuid,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id),
  constraint categorias_pai_empresa_fk foreign key (empresa_id,pai_id)
    references public.categorias(empresa_id,id),
  check (pai_id is null or pai_id <> id)
);
create unique index categorias_nome_raiz_idx on public.categorias (empresa_id, tipo, lower(btrim(nome))) where pai_id is null;
create unique index categorias_nome_sub_idx on public.categorias (empresa_id, pai_id, lower(btrim(nome))) where pai_id is not null;
create index categorias_pai_idx on public.categorias (empresa_id,pai_id) where pai_id is not null;

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  descricao text check (char_length(descricao) <= 500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id,id)
);
create unique index centros_custo_nome_idx on public.centros_custo (empresa_id,lower(btrim(nome)));

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 160),
  documento text check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  email text check (char_length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  telefone text check (telefone ~ '^[0-9]{8,15}$'),
  cidade text check (char_length(cidade) <= 120),
  uf text check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  observacoes text check (char_length(observacoes) <= 500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id,id)
);
create unique index clientes_documento_idx on public.clientes (empresa_id,documento) where documento is not null;

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 160),
  documento text check (documento ~ '^([0-9]{11}|[0-9]{14})$'),
  email text check (char_length(email) <= 254 and email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  telefone text check (telefone ~ '^[0-9]{8,15}$'),
  cidade text check (char_length(cidade) <= 120),
  uf text check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  observacoes text check (char_length(observacoes) <= 500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id,id)
);
create unique index fornecedores_documento_idx on public.fornecedores (empresa_id,documento) where documento is not null;

create function private.atualizar_cadastro_timestamp()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.atualizado_em = clock_timestamp(); return new; end;
$$;
revoke all on function private.atualizar_cadastro_timestamp() from public, anon, authenticated;

create function private.validar_categoria()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare pai public.categorias;
begin
  if new.pai_id is not null then
    select * into pai from public.categorias
      where empresa_id = new.empresa_id and id = new.pai_id;
    if not found or pai.pai_id is not null or pai.tipo <> new.tipo or (new.ativo and not pai.ativo) then
      raise check_violation using message = 'Categoria pai incompatível.';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (new.pai_id is not null or new.tipo <> old.tipo) and exists (
      select 1 from public.categorias where empresa_id = new.empresa_id and pai_id = new.id
    ) then raise check_violation using message = 'Categoria com subcategorias não pode mudar de tipo ou nível.'; end if;
    if not new.ativo and exists (
      select 1 from public.categorias where empresa_id = new.empresa_id and pai_id = new.id and ativo
    ) then raise check_violation using message = 'Arquive primeiro as subcategorias ativas.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_categoria() from public, anon, authenticated;
create trigger validar_categoria before insert or update on public.categorias
  for each row execute function private.validar_categoria();

alter table public.categorias enable row level security;
revoke all on public.categorias from anon, authenticated;
grant select on public.categorias to authenticated;
grant insert (empresa_id,nome,tipo,cor,custo_fixo,pai_id,ativo) on public.categorias to authenticated;
grant update (nome,tipo,cor,custo_fixo,pai_id,ativo) on public.categorias to authenticated;
create index categorias_listagem_idx on public.categorias (empresa_id,ativo,nome,id);
create policy categorias_select on public.categorias for select to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura'])
);
create policy categorias_insert on public.categorias for insert to authenticated with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create policy categorias_update on public.categorias for update to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
) with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create trigger categorias_timestamp before update on public.categorias
  for each row execute function private.atualizar_cadastro_timestamp();

alter table public.centros_custo enable row level security;
revoke all on public.centros_custo from anon, authenticated;
grant select on public.centros_custo to authenticated;
grant insert (empresa_id,nome,descricao,ativo) on public.centros_custo to authenticated;
grant update (nome,descricao,ativo) on public.centros_custo to authenticated;
create index centros_custo_listagem_idx on public.centros_custo (empresa_id,ativo,nome,id);
create policy centros_custo_select on public.centros_custo for select to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura'])
);
create policy centros_custo_insert on public.centros_custo for insert to authenticated with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create policy centros_custo_update on public.centros_custo for update to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
) with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create trigger centros_custo_timestamp before update on public.centros_custo
  for each row execute function private.atualizar_cadastro_timestamp();

alter table public.clientes enable row level security;
revoke all on public.clientes from anon, authenticated;
grant select on public.clientes to authenticated;
grant insert (empresa_id,nome,documento,email,telefone,cidade,uf,observacoes,ativo) on public.clientes to authenticated;
grant update (nome,documento,email,telefone,cidade,uf,observacoes,ativo) on public.clientes to authenticated;
create index clientes_listagem_idx on public.clientes (empresa_id,ativo,nome,id);
create policy clientes_select on public.clientes for select to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura'])
);
create policy clientes_insert on public.clientes for insert to authenticated with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create policy clientes_update on public.clientes for update to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
) with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create trigger clientes_timestamp before update on public.clientes
  for each row execute function private.atualizar_cadastro_timestamp();

alter table public.fornecedores enable row level security;
revoke all on public.fornecedores from anon, authenticated;
grant select on public.fornecedores to authenticated;
grant insert (empresa_id,nome,documento,email,telefone,cidade,uf,observacoes,ativo) on public.fornecedores to authenticated;
grant update (nome,documento,email,telefone,cidade,uf,observacoes,ativo) on public.fornecedores to authenticated;
create index fornecedores_listagem_idx on public.fornecedores (empresa_id,ativo,nome,id);
create policy fornecedores_select on public.fornecedores for select to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura'])
);
create policy fornecedores_insert on public.fornecedores for insert to authenticated with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create policy fornecedores_update on public.fornecedores for update to authenticated using (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
) with check (
  private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo'])
);
create trigger fornecedores_timestamp before update on public.fornecedores
  for each row execute function private.atualizar_cadastro_timestamp();
