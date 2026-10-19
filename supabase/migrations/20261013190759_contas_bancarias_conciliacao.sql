create table public.contas_bancarias (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check(char_length(btrim(nome)) between 2 and 120),banco text not null check(char_length(btrim(banco)) between 2 and 120),
 codigo_banco text check(codigo_banco ~ '^[0-9]{1,10}$'),agencia text check(char_length(agencia)<=30),
 numero text not null check(char_length(btrim(numero)) between 1 and 50),
 saldo_inicial_centavos bigint not null check(abs(saldo_inicial_centavos)<=1000000000000),data_saldo_inicial date not null check(data_saldo_inicial>=date '2000-01-01'),
 ativo boolean not null default true,criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),unique(empresa_id,id)
);
create unique index contas_bancarias_nome on public.contas_bancarias(empresa_id,lower(btrim(nome)));
create table public.importacoes_bancarias (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,conta_id uuid not null,
 nome_arquivo text not null check(char_length(nome_arquivo) between 1 and 160),formato text not null check(formato in('csv','xlsx','ofx')),
 hash_arquivo text not null check(hash_arquivo ~ '^[a-f0-9]{64}$'),linhas jsonb not null check(jsonb_typeof(linhas)='array' and jsonb_array_length(linhas) between 1 and 1000),
 status text not null default 'previa' check(status in('previa','concluida')),autor_id uuid not null references auth.users(id),confirmado_por uuid references auth.users(id),
 importados integer,ignorados integer,criado_em timestamptz not null default clock_timestamp(),confirmado_em timestamptz,
 unique(empresa_id,id),unique(conta_id,hash_arquivo),foreign key(empresa_id,conta_id) references public.contas_bancarias(empresa_id,id)
);
create table public.lancamentos_importados (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,conta_id uuid not null,importacao_id uuid not null,
 chave text not null check(char_length(chave) between 1 and 180),data_movimento date not null,descricao text not null check(char_length(btrim(descricao)) between 1 and 500),
 valor_centavos bigint not null check(valor_centavos<>0 and abs(valor_centavos)<=1000000000000),
 criado_em timestamptz not null default clock_timestamp(),unique(empresa_id,id),unique(conta_id,chave),
 foreign key(empresa_id,conta_id) references public.contas_bancarias(empresa_id,id),foreign key(empresa_id,importacao_id) references public.importacoes_bancarias(empresa_id,id)
);
create table public.conciliacoes (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,movimento_id uuid not null,
 pagar_id uuid,receber_id uuid,valor_centavos bigint not null,data_liquidacao date not null,autor_id uuid not null references auth.users(id),
 criado_em timestamptz not null default clock_timestamp(),desfeita_em timestamptz,desfeita_por uuid references auth.users(id),motivo text,
 unique(empresa_id,id),check((pagar_id is null)<>(receber_id is null)),
 foreign key(empresa_id,movimento_id) references public.lancamentos_importados(empresa_id,id),
 foreign key(empresa_id,pagar_id) references public.lancamentos_pagar(empresa_id,id),
 foreign key(empresa_id,receber_id) references public.lancamentos_receber(empresa_id,id)
);
create unique index conciliacao_movimento_ativo on public.conciliacoes(movimento_id) where desfeita_em is null;
create unique index conciliacao_pagar_ativa on public.conciliacoes(pagar_id) where desfeita_em is null;
create unique index conciliacao_receber_ativa on public.conciliacoes(receber_id) where desfeita_em is null;
create table public.historico_conciliacoes (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,conciliacao_id uuid not null,
 evento text not null check(evento in('conciliar','desfazer')),autor_id uuid not null references auth.users(id),motivo text,
 criado_em timestamptz not null default clock_timestamp(),foreign key(empresa_id,conciliacao_id) references public.conciliacoes(empresa_id,id)
);
create function private.salvar_conta_bancaria(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare conta public.contas_bancarias; novo uuid; saldo bigint:=(p_dados->>'saldo_inicial_centavos')::bigint; data_inicio date:=(p_dados->>'data_saldo_inicial')::date;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if saldo is null or abs(saldo)>1000000000000 or data_inicio is null or data_inicio<date '2000-01-01' or data_inicio>private.hoje_financeiro() then return jsonb_build_object('codigo','dados_invalidos'); end if;
 if p_id is not null then
  select * into conta from public.contas_bancarias where empresa_id=p_empresa and id=p_id for update;
  if not found then return jsonb_build_object('codigo','indisponivel'); end if;
  if p_versao is null or conta.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
  if exists(select 1 from public.importacoes_bancarias where conta_id=conta.id) and (conta.saldo_inicial_centavos<>saldo or conta.data_saldo_inicial<>data_inicio or conta.numero<>btrim(p_dados->>'numero') or conta.banco<>btrim(p_dados->>'banco') or conta.codigo_banco is distinct from nullif(p_dados->>'codigo_banco','') or conta.agencia is distinct from nullif(btrim(p_dados->>'agencia'),'')) then return jsonb_build_object('codigo','conta_com_extrato'); end if;
  update public.contas_bancarias set nome=btrim(p_dados->>'nome'),banco=btrim(p_dados->>'banco'),codigo_banco=nullif(p_dados->>'codigo_banco',''),agencia=nullif(btrim(p_dados->>'agencia'),''),numero=btrim(p_dados->>'numero'),saldo_inicial_centavos=saldo,data_saldo_inicial=data_inicio,atualizado_em=clock_timestamp() where id=conta.id;
  novo:=conta.id;
 else
  insert into public.contas_bancarias(empresa_id,nome,banco,codigo_banco,agencia,numero,saldo_inicial_centavos,data_saldo_inicial)
  values(p_empresa,btrim(p_dados->>'nome'),btrim(p_dados->>'banco'),nullif(p_dados->>'codigo_banco',''),nullif(btrim(p_dados->>'agencia'),''),btrim(p_dados->>'numero'),saldo,data_inicio) returning id into novo;
 end if;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'bancos','salvar_conta');
 return jsonb_build_object('codigo','ok','id',novo);
end; $$;
create function private.status_conta_bancaria(p_empresa uuid,p_id uuid,p_versao timestamptz,p_ativo boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare conta public.contas_bancarias;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into conta from public.contas_bancarias where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_versao is null or conta.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_ativo is null then return jsonb_build_object('codigo','dados_invalidos'); end if;
 update public.contas_bancarias set ativo=p_ativo,atualizado_em=clock_timestamp() where id=conta.id;
 return jsonb_build_object('codigo','ok');
end; $$;
create function private.previa_importacao(p_empresa uuid,p_conta uuid,p_nome text,p_formato text,p_hash text,p_linhas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare conta public.contas_bancarias; item jsonb; novo uuid;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into conta from public.contas_bancarias where empresa_id=p_empresa and id=p_conta for update;
 if not found or not conta.ativo then return jsonb_build_object('codigo','conta_inativa'); end if;
 if p_linhas is null or jsonb_typeof(p_linhas)<>'array' or jsonb_array_length(p_linhas) not between 1 and 1000 then return jsonb_build_object('codigo','arquivo_invalido'); end if;
 for item in select value from jsonb_array_elements(p_linhas) loop
  if (item->>'data_movimento')::date<conta.data_saldo_inicial or (item->>'data_movimento')::date>private.hoje_financeiro() or (item->>'data_movimento') is null
   or (item->>'valor_centavos') is null or (item->>'valor_centavos')::bigint=0 or abs((item->>'valor_centavos')::bigint)>1000000000000
   or coalesce(char_length(btrim(item->>'descricao')),0) not between 1 and 500 or coalesce(char_length(item->>'chave'),0) not between 1 and 180 then return jsonb_build_object('codigo','arquivo_invalido'); end if;
 end loop;
 if (select count(distinct value->>'chave') from jsonb_array_elements(p_linhas))<>jsonb_array_length(p_linhas) then return jsonb_build_object('codigo','arquivo_invalido'); end if;
 insert into public.importacoes_bancarias(empresa_id,conta_id,nome_arquivo,formato,hash_arquivo,linhas,autor_id)
 values(p_empresa,p_conta,p_nome,p_formato,p_hash,p_linhas,auth.uid()) on conflict(conta_id,hash_arquivo) do nothing returning id into novo;
 if novo is null then select id into novo from public.importacoes_bancarias where conta_id=p_conta and hash_arquivo=p_hash; end if;
 return jsonb_build_object('codigo','ok','id',novo);
end; $$;
create function private.confirmar_importacao(p_empresa uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare lote public.importacoes_bancarias; conta public.contas_bancarias; n integer;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into lote from public.importacoes_bancarias where empresa_id=p_empresa and id=p_id;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 select * into conta from public.contas_bancarias where id=lote.conta_id for update;
 select * into lote from public.importacoes_bancarias where id=p_id for update;
 if lote.status='concluida' then return jsonb_build_object('codigo','ok','importados',lote.importados,'ignorados',lote.ignorados,'reenvio',true); end if;
 if not conta.ativo then return jsonb_build_object('codigo','conta_inativa'); end if;
 if exists(select 1 from jsonb_array_elements(lote.linhas) item join public.lancamentos_importados m on m.conta_id=conta.id and m.chave=item->>'chave'
 where m.data_movimento<>(item->>'data_movimento')::date or m.valor_centavos<>(item->>'valor_centavos')::bigint or m.descricao<>item->>'descricao') then return jsonb_build_object('codigo','identificador_conflitante'); end if;
 insert into public.lancamentos_importados(empresa_id,conta_id,importacao_id,chave,data_movimento,descricao,valor_centavos)
 select p_empresa,conta.id,lote.id,item->>'chave',(item->>'data_movimento')::date,item->>'descricao',(item->>'valor_centavos')::bigint from jsonb_array_elements(lote.linhas) item on conflict(conta_id,chave) do nothing;
 get diagnostics n=row_count;
 update public.importacoes_bancarias set status='concluida',confirmado_por=auth.uid(),confirmado_em=clock_timestamp(),importados=n,ignorados=jsonb_array_length(lote.linhas)-n where id=lote.id;
 if n>0 then insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento,quantidade) values(p_empresa,auth.uid(),'bancos','importar',n); end if;
 return jsonb_build_object('codigo','ok','importados',n,'ignorados',jsonb_array_length(lote.linhas)-n);
end; $$;
create function private.conciliar_movimento(p_empresa uuid,p_movimento uuid,p_tipo text,p_lancamento uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.lancamentos_importados; conta public.contas_bancarias; valor bigint; data_pago date; novo uuid;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into m from public.lancamentos_importados where empresa_id=p_empresa and id=p_movimento;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 select * into conta from public.contas_bancarias where id=m.conta_id for update;
 if not conta.ativo then return jsonb_build_object('codigo','conta_inativa'); end if;
 select * into m from public.lancamentos_importados where id=p_movimento for update;
 if exists(select 1 from public.conciliacoes where movimento_id=m.id and desfeita_em is null) then return jsonb_build_object('codigo','ja_conciliado'); end if;
 if p_tipo='pagar' then
  select valor_pago_centavos,pago_em into valor,data_pago from public.lancamentos_pagar where empresa_id=p_empresa and id=p_lancamento and status='pago' for update;
 elsif p_tipo='receber' then
  select valor_recebido_centavos,recebido_em into valor,data_pago from public.lancamentos_receber where empresa_id=p_empresa and id=p_lancamento and status='recebido' for update;
 else return jsonb_build_object('codigo','dados_invalidos'); end if;
 if not found then return jsonb_build_object('codigo','liquidacao_invalida'); end if;
 if (p_tipo='pagar' and m.valor_centavos>0) or (p_tipo='receber' and m.valor_centavos<0) or abs(m.valor_centavos)<>valor then return jsonb_build_object('codigo','valor_incompativel'); end if;
 if exists(select 1 from public.conciliacoes where desfeita_em is null and (pagar_id=p_lancamento or receber_id=p_lancamento)) then return jsonb_build_object('codigo','ja_conciliado'); end if;
 insert into public.conciliacoes(empresa_id,movimento_id,pagar_id,receber_id,valor_centavos,data_liquidacao,autor_id)
 values(p_empresa,m.id,case when p_tipo='pagar' then p_lancamento end,case when p_tipo='receber' then p_lancamento end,valor,data_pago,auth.uid()) returning id into novo;
 insert into public.historico_conciliacoes(empresa_id,conciliacao_id,evento,autor_id) values(p_empresa,novo,'conciliar',auth.uid());
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'bancos','conciliar');
 return jsonb_build_object('codigo','ok','id',novo);
end; $$;
create function private.desfazer_conciliacao(p_empresa uuid,p_id uuid,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.conciliacoes; m public.lancamentos_importados;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into c from public.conciliacoes where empresa_id=p_empresa and id=p_id;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_motivo is null or char_length(btrim(p_motivo)) not between 5 and 500 then return jsonb_build_object('codigo','motivo_invalido'); end if;
 select * into m from public.lancamentos_importados where id=c.movimento_id;
 perform 1 from public.contas_bancarias where id=m.conta_id for update;
 perform 1 from public.lancamentos_importados where id=m.id for update;
 if c.pagar_id is not null then perform 1 from public.lancamentos_pagar where id=c.pagar_id for update;
 else perform 1 from public.lancamentos_receber where id=c.receber_id for update; end if;
 select * into c from public.conciliacoes where id=p_id for update;
 if c.desfeita_em is not null then return jsonb_build_object('codigo','ja_desfeita'); end if;
 update public.conciliacoes set desfeita_em=clock_timestamp(),desfeita_por=auth.uid(),motivo=btrim(p_motivo) where id=c.id;
 insert into public.historico_conciliacoes(empresa_id,conciliacao_id,evento,autor_id,motivo) values(p_empresa,c.id,'desfazer',auth.uid(),btrim(p_motivo));
 return jsonb_build_object('codigo','ok');
end; $$;
create function private.proteger_liquidacao_conciliada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_table_name='lancamentos_pagar' and exists(select 1 from public.conciliacoes where empresa_id=old.empresa_id and pagar_id=old.id and desfeita_em is null))
 or (tg_table_name='lancamentos_receber' and exists(select 1 from public.conciliacoes where empresa_id=old.empresa_id and receber_id=old.id and desfeita_em is null)) then
  raise exception 'Desfaca a conciliacao antes de alterar a liquidacao' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function private.proteger_liquidacao_conciliada() from public,anon,authenticated;
create trigger proteger_conciliacao_pagar before update on public.lancamentos_pagar for each row execute function private.proteger_liquidacao_conciliada();
create trigger proteger_conciliacao_receber before update on public.lancamentos_receber for each row execute function private.proteger_liquidacao_conciliada();
alter table public.contas_bancarias enable row level security;
revoke all on public.contas_bancarias from public,anon,authenticated;
grant select on public.contas_bancarias to authenticated;
create policy contas_bancarias_consulta on public.contas_bancarias for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));
alter table public.importacoes_bancarias enable row level security;
revoke all on public.importacoes_bancarias from public,anon,authenticated;
grant select on public.importacoes_bancarias to authenticated;
create policy importacoes_bancarias_consulta on public.importacoes_bancarias for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));
alter table public.lancamentos_importados enable row level security;
revoke all on public.lancamentos_importados from public,anon,authenticated;
grant select on public.lancamentos_importados to authenticated;
create policy lancamentos_importados_consulta on public.lancamentos_importados for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));
alter table public.conciliacoes enable row level security;
revoke all on public.conciliacoes from public,anon,authenticated;
grant select on public.conciliacoes to authenticated;
create policy conciliacoes_consulta on public.conciliacoes for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));
alter table public.historico_conciliacoes enable row level security;
revoke all on public.historico_conciliacoes from public,anon,authenticated;
grant select on public.historico_conciliacoes to authenticated;
create policy historico_conciliacoes_consulta on public.historico_conciliacoes for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));
create index importacoes_bancarias_conta_id_idx on public.importacoes_bancarias(empresa_id,conta_id);
create index importacoes_bancarias_autor_id_idx on public.importacoes_bancarias(autor_id);
create index importacoes_bancarias_confirmado_por_idx on public.importacoes_bancarias(confirmado_por);
create index lancamentos_importados_conta_id_idx on public.lancamentos_importados(empresa_id,conta_id);
create index lancamentos_importados_importacao_id_idx on public.lancamentos_importados(empresa_id,importacao_id);
create index conciliacoes_movimento_id_idx on public.conciliacoes(empresa_id,movimento_id);
create index conciliacoes_pagar_id_idx on public.conciliacoes(empresa_id,pagar_id);
create index conciliacoes_receber_id_idx on public.conciliacoes(empresa_id,receber_id);
create index conciliacoes_autor_id_idx on public.conciliacoes(autor_id);
create index conciliacoes_desfeita_por_idx on public.conciliacoes(desfeita_por);
create index historico_conciliacoes_conciliacao_id_idx on public.historico_conciliacoes(empresa_id,conciliacao_id);
create index historico_conciliacoes_autor_id_idx on public.historico_conciliacoes(autor_id);
create index movimentos_conta_data on public.lancamentos_importados(empresa_id,conta_id,data_movimento,id);
create function public.salvar_conta_bancaria(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.salvar_conta_bancaria(p_empresa,p_id,p_versao,p_dados); $$;
revoke all on function public.salvar_conta_bancaria(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.salvar_conta_bancaria(uuid,uuid,timestamptz,jsonb) to authenticated;
revoke all on function private.salvar_conta_bancaria(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.salvar_conta_bancaria(uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.status_conta_bancaria(p_empresa uuid,p_id uuid,p_versao timestamptz,p_ativo boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.status_conta_bancaria(p_empresa,p_id,p_versao,p_ativo); $$;
revoke all on function public.status_conta_bancaria(uuid,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.status_conta_bancaria(uuid,uuid,timestamptz,boolean) to authenticated;
revoke all on function private.status_conta_bancaria(uuid,uuid,timestamptz,boolean) from public,anon,authenticated;
grant execute on function private.status_conta_bancaria(uuid,uuid,timestamptz,boolean) to authenticated;
create function public.previa_importacao(p_empresa uuid,p_conta uuid,p_nome text,p_formato text,p_hash text,p_linhas jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.previa_importacao(p_empresa,p_conta,p_nome,p_formato,p_hash,p_linhas); $$;
revoke all on function public.previa_importacao(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.previa_importacao(uuid,uuid,text,text,text,jsonb) to authenticated;
revoke all on function private.previa_importacao(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.previa_importacao(uuid,uuid,text,text,text,jsonb) to authenticated;
create function public.confirmar_importacao(p_empresa uuid,p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.confirmar_importacao(p_empresa,p_id); $$;
revoke all on function public.confirmar_importacao(uuid,uuid) from public,anon;
grant execute on function public.confirmar_importacao(uuid,uuid) to authenticated;
revoke all on function private.confirmar_importacao(uuid,uuid) from public,anon,authenticated;
grant execute on function private.confirmar_importacao(uuid,uuid) to authenticated;
create function public.conciliar_movimento(p_empresa uuid,p_movimento uuid,p_tipo text,p_lancamento uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.conciliar_movimento(p_empresa,p_movimento,p_tipo,p_lancamento); $$;
revoke all on function public.conciliar_movimento(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.conciliar_movimento(uuid,uuid,text,uuid) to authenticated;
revoke all on function private.conciliar_movimento(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.conciliar_movimento(uuid,uuid,text,uuid) to authenticated;
create function public.desfazer_conciliacao(p_empresa uuid,p_id uuid,p_motivo text) returns jsonb language sql security invoker set search_path='' as $$ select private.desfazer_conciliacao(p_empresa,p_id,p_motivo); $$;
revoke all on function public.desfazer_conciliacao(uuid,uuid,text) from public,anon;
grant execute on function public.desfazer_conciliacao(uuid,uuid,text) to authenticated;
revoke all on function private.desfazer_conciliacao(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.desfazer_conciliacao(uuid,uuid,text) to authenticated;
create function public.resumo_conta_bancaria(p_empresa uuid,p_conta uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('saldo',(c.saldo_inicial_centavos+coalesce((select sum(valor_centavos) from public.lancamentos_importados where empresa_id=p_empresa and conta_id=c.id),0))::text,
 'movimentos',(select count(*) from public.lancamentos_importados where empresa_id=p_empresa and conta_id=c.id),
 'conciliados',(select count(*) from public.conciliacoes v join public.lancamentos_importados m on m.empresa_id=v.empresa_id and m.id=v.movimento_id where v.empresa_id=p_empresa and m.conta_id=c.id and v.desfeita_em is null))
 from public.contas_bancarias c where c.empresa_id=p_empresa and c.id=p_conta;
$$;
revoke all on function public.resumo_conta_bancaria(uuid,uuid) from public,anon;
grant execute on function public.resumo_conta_bancaria(uuid,uuid) to authenticated;
