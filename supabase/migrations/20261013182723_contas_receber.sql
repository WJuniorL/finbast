create table public.series_receber (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 request_id uuid not null, request_hash text not null,
 descricao text not null check (char_length(btrim(descricao)) between 2 and 160), documento text check (char_length(documento)<=120),
 cliente_id uuid not null, categoria_id uuid not null, centro_custo_id uuid,
 tipo_categoria text not null default 'receita' check (tipo_categoria='receita'),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000),
 primeiro_vencimento date not null check (primeiro_vencimento between date '2000-01-01' and date '2100-12-31'),
 modo text not null check (modo in ('unica','parcelado','recorrente')),
 parcelas integer check (parcelas between 1 and 120),
 ativo boolean not null default true,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique (empresa_id,id), unique (empresa_id,request_id),
 check ((modo='unica' and parcelas is not null and parcelas=1) or (modo='parcelado' and parcelas is not null and parcelas>=2 and valor_centavos>=parcelas) or (modo='recorrente' and parcelas is null)),
 foreign key (empresa_id,cliente_id) references public.clientes(empresa_id,id),
 foreign key (empresa_id,categoria_id,tipo_categoria) references public.categorias(empresa_id,id,tipo),
 foreign key (empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id)
);
create table public.lancamentos_receber (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 serie_id uuid not null, descricao text not null check (char_length(btrim(descricao)) between 2 and 160),
 documento text check (char_length(documento)<=120), cliente_id uuid not null, categoria_id uuid not null, centro_custo_id uuid,
 tipo_categoria text not null default 'receita' check (tipo_categoria='receita'),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000), vencimento date not null check (vencimento between date '2000-01-01' and date '2201-12-31'),
 parcela integer not null check (parcela between 1 and 1212), 
 status text not null default 'aberto' check (status in ('aberto','recebido','cancelado')),
 recebido_em date, recebido_por uuid references auth.users(id), valor_recebido_centavos bigint,
 juros_centavos bigint not null default 0 check (juros_centavos between 0 and 1000000000000),
 multa_centavos bigint not null default 0 check (multa_centavos between 0 and 1000000000000),
 desconto_centavos bigint not null default 0 check (desconto_centavos between 0 and 1000000000000),
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique (empresa_id,id), unique (serie_id,parcela),
 check ((status='recebido' and recebido_em is not null and recebido_por is not null and valor_recebido_centavos is not null and valor_recebido_centavos between 1 and 1000000000000
   and valor_recebido_centavos=valor_centavos+juros_centavos+multa_centavos-desconto_centavos)
   or (status<>'recebido' and recebido_em is null and recebido_por is null and valor_recebido_centavos is null and juros_centavos=0 and multa_centavos=0 and desconto_centavos=0)),
 foreign key (empresa_id,serie_id) references public.series_receber(empresa_id,id),
 foreign key (empresa_id,cliente_id) references public.clientes(empresa_id,id),
 foreign key (empresa_id,categoria_id,tipo_categoria) references public.categorias(empresa_id,id,tipo),
 foreign key (empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id)
);
create table public.baixas_receber (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 lancamento_id uuid not null, tipo text not null check (tipo in ('baixa','estorno')),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000),
 valor_original_centavos bigint not null check (valor_original_centavos between 1 and 1000000000000),
 juros_centavos bigint not null check (juros_centavos between 0 and 1000000000000),
 multa_centavos bigint not null check (multa_centavos between 0 and 1000000000000),
 desconto_centavos bigint not null check (desconto_centavos between 0 and 1000000000000),
 check (valor_centavos=valor_original_centavos+juros_centavos+multa_centavos-desconto_centavos),
 data_recebimento date not null, autor_id uuid not null references auth.users(id), observacao text check (char_length(observacao)<=500),
 criado_em timestamptz not null default clock_timestamp(),
 foreign key (empresa_id,lancamento_id) references public.lancamentos_receber(empresa_id,id)
);
create function private.validar_refs_receber(p_empresa uuid,p_cliente uuid,p_categoria uuid,p_centro uuid) returns boolean
 language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.clientes where empresa_id=p_empresa and id=p_cliente and ativo for share;
 if not found then return false; end if;
 perform 1 from public.categorias where empresa_id=p_empresa and id=p_categoria and ativo and tipo='receita' for share;
 if not found then return false; end if;
 if p_centro is not null then
  perform 1 from public.centros_custo where empresa_id=p_empresa and id=p_centro and ativo for share;
  if not found then return false; end if;
 end if;
 return true;
end;
$$;

create function private.gerar_serie_receber(p_serie uuid,p_ate integer) returns integer
 language plpgsql security invoker set search_path='' as $$
declare serie public.series_receber; inicio integer; fim integer; n integer; valor bigint; gerados integer:=0;
begin
 select * into serie from public.series_receber where id=p_serie for update;
 if not found or not serie.ativo then return 0; end if;
 if not private.validar_refs_receber(serie.empresa_id,serie.cliente_id,serie.categoria_id,serie.centro_custo_id) then return 0; end if;
 select coalesce(max(parcela),0)+1 into inicio from public.lancamentos_receber where serie_id=serie.id;
 fim := case when serie.modo='recorrente' then least(greatest(p_ate,12),1212) else serie.parcelas end;
 for n in inicio..fim loop
  valor:=case when serie.modo='parcelado' then serie.valor_centavos/serie.parcelas + case when n<=serie.valor_centavos%serie.parcelas then 1 else 0 end else serie.valor_centavos end;
  insert into public.lancamentos_receber(empresa_id,serie_id,descricao,documento,cliente_id,categoria_id,centro_custo_id,valor_centavos,vencimento,parcela)
   values(serie.empresa_id,serie.id,serie.descricao,serie.documento,serie.cliente_id,serie.categoria_id,serie.centro_custo_id,valor,
   private.vencimento_mensal(serie.primeiro_vencimento,n-1),n);
  gerados:=gerados+1;
 end loop;
 return gerados;
end;
$$;
create function private.criar_receber(p_empresa uuid,p_request uuid,p_dados jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare serie public.series_receber; pedido_hash text; gerados integer; modo text:=p_dados->>'modo'; qtd integer;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 pedido_hash:=encode(extensions.digest(p_dados::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_empresa::text||p_request::text,0));
 select * into serie from public.series_receber where empresa_id=p_empresa and request_id=p_request;
 if found then return jsonb_build_object('codigo',case when serie.request_hash=pedido_hash then 'ok' else 'pedido_alterado' end,'serie_id',serie.id); end if;
 if not private.validar_refs_receber(p_empresa,(p_dados->>'cliente_id')::uuid,(p_dados->>'categoria_id')::uuid,nullif(p_dados->>'centro_custo_id','')::uuid) then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 qtd:=case when modo='unica' then 1 when modo='parcelado' then (p_dados->>'parcelas')::integer else null end;
 insert into public.series_receber(empresa_id,request_id,request_hash,descricao,documento,cliente_id,categoria_id,centro_custo_id,valor_centavos,primeiro_vencimento,modo,parcelas)
 values(p_empresa,p_request,pedido_hash,btrim(p_dados->>'descricao'),nullif(btrim(p_dados->>'documento'),''),
 (p_dados->>'cliente_id')::uuid,(p_dados->>'categoria_id')::uuid,nullif(p_dados->>'centro_custo_id','')::uuid,
 (p_dados->>'valor_centavos')::bigint,(p_dados->>'vencimento')::date,modo,qtd) returning * into serie;
 gerados:=private.gerar_serie_receber(serie.id,12);
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento,quantidade) values(p_empresa,auth.uid(),'contas_receber','criar',gerados);
 return jsonb_build_object('codigo','ok','serie_id',serie.id,'gerados',gerados);
end;
$$;
create function private.expandir_receber(p_empresa uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare serie public.series_receber; n integer; total integer:=0; bloqueadas integer:=0; horizonte date;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 horizonte:=(date_trunc('month',private.hoje_financeiro())+interval '11 months')::date;
 for serie in select * from public.series_receber where empresa_id=p_empresa and modo='recorrente' and ativo order by id loop
  if not private.validar_refs_receber(p_empresa,serie.cliente_id,serie.categoria_id,serie.centro_custo_id) then bloqueadas:=bloqueadas+1; continue; end if;
  n:=(extract(year from horizonte)::integer-extract(year from serie.primeiro_vencimento)::integer)*12+extract(month from horizonte)::integer-extract(month from serie.primeiro_vencimento)::integer+1;
  total:=total+private.gerar_serie_receber(serie.id,n);
 end loop;
 if total>0 then insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento,quantidade) values(p_empresa,auth.uid(),'contas_receber','gerar_recorrencia',total); end if;
 return jsonb_build_object('codigo','ok','gerados',total,'bloqueadas',bloqueadas);
end;
$$;
create function private.editar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_receber; cat uuid:=(p_dados->>'categoria_id')::uuid; cli uuid:=(p_dados->>'cliente_id')::uuid; centro uuid:=nullif(p_dados->>'centro_custo_id','')::uuid;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_receber where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if (cat<>atual.categoria_id or cli<>atual.cliente_id or centro is distinct from atual.centro_custo_id)
  and not private.validar_refs_receber(p_empresa,cli,cat,centro) then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 perform 1 from public.categorias c where c.id=cat and c.empresa_id=p_empresa and c.tipo='receita';
 if not found then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 update public.lancamentos_receber set descricao=btrim(p_dados->>'descricao'),documento=nullif(btrim(p_dados->>'documento'),''),cliente_id=cli,categoria_id=cat,centro_custo_id=centro,
 valor_centavos=(p_dados->>'valor_centavos')::bigint,vencimento=(p_dados->>'vencimento')::date,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_receber','editar');
 return jsonb_build_object('codigo','ok');
end;
$$;
create function private.cancelar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_serie boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_receber; n integer;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_receber where empresa_id=p_empresa and id=p_id;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 -- Mesmo lock usado na geração, antes de bloquear a ocorrência.
 perform 1 from public.series_receber where id=atual.serie_id for update;
 select * into atual from public.lancamentos_receber where empresa_id=p_empresa and id=p_id for update;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_serie then
  if not exists(select 1 from public.series_receber where id=atual.serie_id and modo='recorrente' and ativo) then return jsonb_build_object('codigo','estado_invalido'); end if;
  update public.series_receber set ativo=false,atualizado_em=clock_timestamp() where id=atual.serie_id;
  update public.lancamentos_receber set status='cancelado',atualizado_em=clock_timestamp() where serie_id=atual.serie_id and status='aberto' and vencimento>private.hoje_financeiro();
  get diagnostics n=row_count;
 else
  if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
  update public.lancamentos_receber set status='cancelado',atualizado_em=clock_timestamp() where id=atual.id;
  n:=1;
 end if;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_receber',case when p_serie then 'interromper_recorrencia' else 'cancelar' end);
 return jsonb_build_object('codigo','ok','cancelados',n);
end;
$$;
create function private.baixar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_receber; juros bigint:=(p_dados->>'juros_centavos')::bigint; multa bigint:=(p_dados->>'multa_centavos')::bigint; desconto bigint:=(p_dados->>'desconto_centavos')::bigint; valor bigint; data_recebido date:=(p_dados->>'recebido_em')::date;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_receber where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 valor:=atual.valor_centavos+juros+multa-desconto;
 if juros is null or multa is null or desconto is null or juros<0 or multa<0 or desconto<0 or juros>1000000000000 or multa>1000000000000 or desconto>1000000000000 or valor is null or valor<1 or valor>1000000000000 or data_recebido is null or data_recebido>private.hoje_financeiro() or data_recebido<date '2000-01-01' then return jsonb_build_object('codigo','valor_invalido'); end if;
 update public.lancamentos_receber set status='recebido',recebido_em=data_recebido,recebido_por=auth.uid(),valor_recebido_centavos=valor,juros_centavos=juros,multa_centavos=multa,desconto_centavos=desconto,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.baixas_receber(empresa_id,lancamento_id,tipo,valor_centavos,valor_original_centavos,juros_centavos,multa_centavos,desconto_centavos,data_recebimento,autor_id,observacao) values(p_empresa,atual.id,'baixa',valor,atual.valor_centavos,juros,multa,desconto,data_recebido,auth.uid(),nullif(btrim(p_dados->>'observacao'),''));
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_receber','recebimento_manual');
 return jsonb_build_object('codigo','ok');
end;
$$;
create function private.estornar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_receber;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_receber where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if atual.status<>'recebido' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_motivo is null or char_length(btrim(p_motivo))<5 or char_length(p_motivo)>500 then return jsonb_build_object('codigo','motivo_invalido'); end if;
 insert into public.baixas_receber(empresa_id,lancamento_id,tipo,valor_centavos,valor_original_centavos,juros_centavos,multa_centavos,desconto_centavos,data_recebimento,autor_id,observacao) values(p_empresa,atual.id,'estorno',atual.valor_recebido_centavos,atual.valor_centavos,atual.juros_centavos,atual.multa_centavos,atual.desconto_centavos,atual.recebido_em,auth.uid(),btrim(p_motivo));
 update public.lancamentos_receber set status='aberto',recebido_em=null,recebido_por=null,valor_recebido_centavos=null,juros_centavos=0,multa_centavos=0,desconto_centavos=0,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_receber','estorno_manual');
 return jsonb_build_object('codigo','ok');
end;
$$;


-- Consulta por empresa; mutacoes somente pelas rotinas com autorizacao.
alter table public.series_receber enable row level security;
revoke all on public.series_receber from public,anon,authenticated;
grant select on public.series_receber to authenticated;
create policy series_receber_consulta on public.series_receber for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
alter table public.lancamentos_receber enable row level security;
revoke all on public.lancamentos_receber from public,anon,authenticated;
grant select on public.lancamentos_receber to authenticated;
create policy lancamentos_receber_consulta on public.lancamentos_receber for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
alter table public.baixas_receber enable row level security;
revoke all on public.baixas_receber from public,anon,authenticated;
grant select on public.baixas_receber to authenticated;
create policy baixas_receber_consulta on public.baixas_receber for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
create index series_receber_cliente on public.series_receber(empresa_id,cliente_id);
create index series_receber_categoria on public.series_receber(empresa_id,categoria_id,tipo_categoria);
create index series_receber_centro on public.series_receber(empresa_id,centro_custo_id);
create index receber_vencimento on public.lancamentos_receber(empresa_id,vencimento,id);
create index receber_status on public.lancamentos_receber(empresa_id,status,vencimento);
create index receber_serie on public.lancamentos_receber(empresa_id,serie_id);
create index receber_cliente on public.lancamentos_receber(empresa_id,cliente_id);
create index receber_categoria on public.lancamentos_receber(empresa_id,categoria_id,tipo_categoria);
create index receber_centro on public.lancamentos_receber(empresa_id,centro_custo_id);
create index receber_autor on public.lancamentos_receber(recebido_por);
create index baixas_receber_lancamento on public.baixas_receber(empresa_id,lancamento_id,criado_em);
create index baixas_receber_autor on public.baixas_receber(autor_id);
create function public.criar_receber(p_empresa uuid,p_request uuid,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.criar_receber(p_empresa,p_request,p_dados); $$;
revoke all on function private.criar_receber(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.criar_receber(uuid,uuid,jsonb) to authenticated;
revoke all on function public.criar_receber(uuid,uuid,jsonb) from public,anon;
grant execute on function public.criar_receber(uuid,uuid,jsonb) to authenticated;
create function public.expandir_receber(p_empresa uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.expandir_receber(p_empresa); $$;
revoke all on function private.expandir_receber(uuid) from public,anon,authenticated;
grant execute on function private.expandir_receber(uuid) to authenticated;
revoke all on function public.expandir_receber(uuid) from public,anon;
grant execute on function public.expandir_receber(uuid) to authenticated;
create function public.editar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.editar_receber(p_empresa,p_id,p_versao,p_dados); $$;
revoke all on function private.editar_receber(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.editar_receber(uuid,uuid,timestamptz,jsonb) to authenticated;
revoke all on function public.editar_receber(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.editar_receber(uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.cancelar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_serie boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.cancelar_receber(p_empresa,p_id,p_versao,p_serie); $$;
revoke all on function private.cancelar_receber(uuid,uuid,timestamptz,boolean) from public,anon,authenticated;
grant execute on function private.cancelar_receber(uuid,uuid,timestamptz,boolean) to authenticated;
revoke all on function public.cancelar_receber(uuid,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.cancelar_receber(uuid,uuid,timestamptz,boolean) to authenticated;
create function public.baixar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.baixar_receber(p_empresa,p_id,p_versao ,p_dados); $$;
revoke all on function private.baixar_receber(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.baixar_receber(uuid,uuid,timestamptz,jsonb) to authenticated;
revoke all on function public.baixar_receber(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.baixar_receber(uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.estornar_receber(p_empresa uuid,p_id uuid,p_versao timestamptz,p_motivo text) returns jsonb language sql security invoker set search_path='' as $$ select private.estornar_receber(p_empresa,p_id,p_versao ,p_motivo); $$;
revoke all on function private.estornar_receber(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function private.estornar_receber(uuid,uuid,timestamptz,text) to authenticated;
revoke all on function public.estornar_receber(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.estornar_receber(uuid,uuid,timestamptz,text) to authenticated;
revoke all on function private.validar_refs_receber(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.gerar_serie_receber(uuid,integer) from public,anon,authenticated;
create function public.resumo_receber(p_empresa uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'aberto',coalesce(sum(valor_centavos) filter(where status='aberto'),0)::text,
 'vencido',coalesce(sum(valor_centavos) filter(where status='aberto' and vencimento<timezone('America/Bahia',now())::date),0)::text,
 'recebido',coalesce(sum(valor_recebido_centavos) filter(where status='recebido'),0)::text,
 'previsto_mes',coalesce(sum(valor_centavos) filter(where status='aberto' and date_trunc('month',vencimento)=date_trunc('month',timezone('America/Bahia',now()))),0)::text)
 from public.lancamentos_receber where empresa_id=p_empresa;
$$;
revoke all on function public.resumo_receber(uuid) from public,anon;
grant execute on function public.resumo_receber(uuid) to authenticated;
