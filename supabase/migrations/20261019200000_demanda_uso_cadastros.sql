-- Botões de demanda: um interesse por usuário/empresa/recurso (idempotente). Sem painel de gestão.
create table public.interesses_demanda (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 usuario_id uuid not null references auth.users(id),
 recurso text not null check (recurso in ('open_finance','boleto_pix','conta_pagamento','painel_contador','assistente_ia')),
 origem text not null check (char_length(origem) between 1 and 60),
 criado_em timestamptz not null default now(),
 unique (empresa_id,usuario_id,recurso)
);
alter table public.interesses_demanda enable row level security;
revoke all on public.interesses_demanda from public,anon,authenticated;
grant select on public.interesses_demanda to authenticated;
create policy interesses_demanda_proprio on public.interesses_demanda for select to authenticated
 using (usuario_id=(select auth.uid()) and private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
create index interesses_demanda_empresa on public.interesses_demanda(empresa_id,recurso);
create index interesses_demanda_usuario on public.interesses_demanda(usuario_id);

create function public.registrar_interesse_demanda(p_empresa uuid,p_recurso text,p_origem text)
returns boolean language plpgsql security definer set search_path='' as $$
declare novo boolean;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']) then
  raise exception 'Acesso negado.' using errcode='42501'; end if;
 insert into public.interesses_demanda(empresa_id,usuario_id,recurso,origem) values(p_empresa,auth.uid(),p_recurso,p_origem)
  on conflict (empresa_id,usuario_id,recurso) do nothing;
 get diagnostics novo = row_count;
 if novo then insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'demanda',p_recurso); end if;
 return novo;
end $$;
revoke execute on function public.registrar_interesse_demanda(uuid,text,text) from public,anon;
grant execute on function public.registrar_interesse_demanda(uuid,text,text) to authenticated;

-- Medição de uso dos cadastros: só o registro do evento, sem alterar a regra das tabelas.
create function private.registrar_uso_cadastro() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento)
  values(new.empresa_id,auth.uid(),'cadastros:'||tg_table_name,case tg_op when 'INSERT' then 'criar' else 'editar' end);
 end if;
 return null;
end $$;
revoke execute on function private.registrar_uso_cadastro() from public,anon,authenticated;
create trigger categorias_uso after insert or update on public.categorias for each row execute function private.registrar_uso_cadastro();
create trigger centros_custo_uso after insert or update on public.centros_custo for each row execute function private.registrar_uso_cadastro();
create trigger clientes_uso after insert or update on public.clientes for each row execute function private.registrar_uso_cadastro();
create trigger fornecedores_uso after insert or update on public.fornecedores for each row execute function private.registrar_uso_cadastro();
