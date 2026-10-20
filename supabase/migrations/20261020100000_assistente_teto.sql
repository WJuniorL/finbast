-- Teto diário de chamadas ao modelo por conta (empresa). A base local de ajuda não passa por aqui.
create table public.assistente_uso_diario (
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 dia date not null,
 perguntas integer not null default 0 check (perguntas >= 0),
 primary key (empresa_id, dia)
);
alter table public.assistente_uso_diario enable row level security;
revoke all on public.assistente_uso_diario from public, anon, authenticated;

-- Incrementa de forma atômica e devolve true se ainda havia cota; false se o teto já foi atingido.
create function public.registrar_pergunta_assistente(p_empresa uuid, p_limite integer default 40)
returns boolean language plpgsql security definer set search_path='' as $$
declare ok boolean;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória.' using errcode='42501'; end if;
 if not private.tem_papel_empresa(p_empresa, array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']) then
  raise exception 'Acesso negado.' using errcode='42501'; end if;
 if p_limite is null or p_limite < 1 or p_limite > 1000 then raise exception 'Limite inválido.' using errcode='22023'; end if;
 insert into public.assistente_uso_diario(empresa_id, dia, perguntas) values (p_empresa, private.hoje_financeiro(), 1)
  on conflict (empresa_id, dia) do update set perguntas = public.assistente_uso_diario.perguntas + 1
  where public.assistente_uso_diario.perguntas < p_limite
  returning true into ok;
 if coalesce(ok,false) then
  insert into public.eventos_uso(empresa_id, usuario_id, modulo, evento) values (p_empresa, auth.uid(), 'assistente', 'pergunta_modelo');
 end if;
 return coalesce(ok, false);
end $$;
revoke execute on function public.registrar_pergunta_assistente(uuid, integer) from public, anon;
grant execute on function public.registrar_pergunta_assistente(uuid, integer) to authenticated;
