create extension if not exists pgcrypto with schema extensions;
alter table public.categorias add constraint categorias_empresa_tipo_unique unique (empresa_id,id,tipo);

create table public.series_pagar (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 request_id uuid not null, request_hash text not null,
 descricao text not null check (char_length(btrim(descricao)) between 2 and 160), documento text check (char_length(documento)<=120),
 fornecedor_id uuid not null, categoria_id uuid not null, centro_custo_id uuid,
 tipo_categoria text not null default 'despesa' check (tipo_categoria='despesa'),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000),
 primeiro_vencimento date not null check (primeiro_vencimento between date '2000-01-01' and date '2100-12-31'),
 modo text not null check (modo in ('unica','parcelado','recorrente')),
 parcelas integer check (parcelas between 1 and 120),
 custo_fixo_override boolean, ativo boolean not null default true,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique (empresa_id,id), unique (empresa_id,request_id),
 check ((modo='unica' and parcelas is not null and parcelas=1) or (modo='parcelado' and parcelas is not null and parcelas>=2 and valor_centavos>=parcelas) or (modo='recorrente' and parcelas is null)),
 foreign key (empresa_id,fornecedor_id) references public.fornecedores(empresa_id,id),
 foreign key (empresa_id,categoria_id,tipo_categoria) references public.categorias(empresa_id,id,tipo),
 foreign key (empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id)
);
create table public.lancamentos_pagar (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 serie_id uuid not null, descricao text not null check (char_length(btrim(descricao)) between 2 and 160),
 documento text check (char_length(documento)<=120), fornecedor_id uuid not null, categoria_id uuid not null, centro_custo_id uuid,
 tipo_categoria text not null default 'despesa' check (tipo_categoria='despesa'),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000), vencimento date not null check (vencimento between date '2000-01-01' and date '2201-12-31'),
 parcela integer not null check (parcela between 1 and 1212), custo_fixo boolean not null, custo_fixo_override boolean,
 status text not null default 'aberto' check (status in ('aberto','pago','cancelado')),
 pago_em date, pago_por uuid references auth.users(id), valor_pago_centavos bigint,
 juros_centavos bigint not null default 0 check (juros_centavos between 0 and 1000000000000),
 multa_centavos bigint not null default 0 check (multa_centavos between 0 and 1000000000000),
 desconto_centavos bigint not null default 0 check (desconto_centavos between 0 and 1000000000000),
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique (empresa_id,id), unique (serie_id,parcela),
 check ((status='pago' and pago_em is not null and pago_por is not null and valor_pago_centavos is not null and valor_pago_centavos between 1 and 1000000000000
   and valor_pago_centavos=valor_centavos+juros_centavos+multa_centavos-desconto_centavos)
   or (status<>'pago' and pago_em is null and pago_por is null and valor_pago_centavos is null and juros_centavos=0 and multa_centavos=0 and desconto_centavos=0)),
 foreign key (empresa_id,serie_id) references public.series_pagar(empresa_id,id),
 foreign key (empresa_id,fornecedor_id) references public.fornecedores(empresa_id,id),
 foreign key (empresa_id,categoria_id,tipo_categoria) references public.categorias(empresa_id,id,tipo),
 foreign key (empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id)
);
create table public.baixas_pagar (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 lancamento_id uuid not null, tipo text not null check (tipo in ('baixa','estorno')),
 valor_centavos bigint not null check (valor_centavos between 1 and 1000000000000),
 data_pagamento date not null, autor_id uuid not null references auth.users(id), observacao text check (char_length(observacao)<=500),
 criado_em timestamptz not null default now(),
 foreign key (empresa_id,lancamento_id) references public.lancamentos_pagar(empresa_id,id)
);
create table public.eventos_uso (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 usuario_id uuid not null references auth.users(id), modulo text not null, evento text not null,
 quantidade integer not null default 1 check (quantidade>0), criado_em timestamptz not null default now()
);
create table private.senhas_aprovacao (
 usuario_id uuid primary key references auth.users(id) on delete cascade, hash text not null,
 tentativas integer not null default 0 check (tentativas>=0), bloqueada_ate timestamptz,
 ultima_prova text, criada_em timestamptz not null default now(), alterada_em timestamptz not null default now()
);
alter table private.senhas_aprovacao enable row level security;
revoke all on private.senhas_aprovacao from public,anon,authenticated;

create function private.hoje_financeiro() returns date language sql stable set search_path='' as $$
 select timezone('America/Bahia',now())::date;
$$;
create function private.vencimento_mensal(p_base date,p_mes integer) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',p_base)::date+make_interval(months=>p_mes))::date
  + (least(extract(day from p_base)::integer,extract(day from (date_trunc('month',p_base)+make_interval(months=>p_mes+1)-interval '1 day'))::integer)-1);
$$;
create function private.pin_forte(p_pin text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p_pin ~ '^[0-9]{6}$' and (select count(distinct d)=6 from regexp_split_to_table(p_pin,'') d)
 and position(p_pin in '012345678901234')=0 and position(p_pin in '987654321098765')=0,false);
$$;
create function private.validar_refs_pagar(p_empresa uuid,p_fornecedor uuid,p_categoria uuid,p_centro uuid) returns boolean
 language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.fornecedores where empresa_id=p_empresa and id=p_fornecedor and ativo for share;
 if not found then return false; end if;
 perform 1 from public.categorias where empresa_id=p_empresa and id=p_categoria and ativo and tipo='despesa' for share;
 if not found then return false; end if;
 if p_centro is not null then
  perform 1 from public.centros_custo where empresa_id=p_empresa and id=p_centro and ativo for share;
  if not found then return false; end if;
 end if;
 return true;
end;
$$;

-- Credencial global por usuário, inacessível pela Data API.
create function private.status_aprovacao() returns jsonb language plpgsql security definer set search_path='' as $$
declare segredo private.senhas_aprovacao;
begin
 if auth.uid() is null then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into segredo from private.senhas_aprovacao where usuario_id=auth.uid();
 return jsonb_build_object('configurada',found,'bloqueada_ate',segredo.bloqueada_ate);
end;
$$;
create function private.configurar_aprovacao(p_pin text,p_trocar boolean default false) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare segredo private.senhas_aprovacao; otp_time bigint; prova text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if not private.pin_forte(p_pin) then return jsonb_build_object('codigo','pin_fraco'); end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':pin',0));
 select * into segredo from private.senhas_aprovacao where usuario_id=auth.uid() for update;
 if not p_trocar then
  if found then return jsonb_build_object('codigo','ja_configurada'); end if;
  insert into private.senhas_aprovacao(usuario_id,hash) values(auth.uid(),extensions.crypt(p_pin,extensions.gen_salt('bf',12)));
 else
  if not found then return jsonb_build_object('codigo','nao_configurada'); end if;
  select max((amr->>'timestamp')::bigint) into otp_time from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) amr where amr->>'method'='otp';
  prova := coalesce(auth.jwt()->>'session_id','')||':'||coalesce(otp_time::text,'');
  if otp_time is null or otp_time < extract(epoch from now()-interval '5 minutes') or otp_time > extract(epoch from now()+interval '30 seconds')
    or coalesce(auth.jwt()->>'session_id','')='' or prova=segredo.ultima_prova then return jsonb_build_object('codigo','confirmar_email'); end if;
  update private.senhas_aprovacao set hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),tentativas=0,bloqueada_ate=null,
   ultima_prova=prova,alterada_em=clock_timestamp() where usuario_id=auth.uid();
 end if;
 return jsonb_build_object('codigo','ok');
end;
$$;
create function private.verificar_aprovacao(p_pin text) returns text language plpgsql security definer set search_path='' as $$
declare segredo private.senhas_aprovacao; v_tentativas integer;
begin
 select * into segredo from private.senhas_aprovacao where usuario_id=auth.uid() for update;
 if not found then return 'nao_configurada'; end if;
 if segredo.bloqueada_ate>now() then return 'bloqueada'; end if;
 v_tentativas := case when segredo.bloqueada_ate is not null then 0 else segredo.tentativas end;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' or extensions.crypt(p_pin,segredo.hash)<>segredo.hash then
  v_tentativas := v_tentativas+1;
  update private.senhas_aprovacao set tentativas=v_tentativas,bloqueada_ate=case when v_tentativas>=5 then now()+interval '15 minutes' else null end where usuario_id=auth.uid();
  return case when v_tentativas>=5 then 'bloqueada' else 'senha_invalida' end;
 end if;
 update private.senhas_aprovacao set tentativas=0,bloqueada_ate=null where usuario_id=auth.uid();
 return 'ok';
end;
$$;

create function private.gerar_serie_pagar(p_serie uuid,p_ate integer) returns integer
 language plpgsql security invoker set search_path='' as $$
declare serie public.series_pagar; inicio integer; fim integer; n integer; valor bigint; fixo boolean; gerados integer:=0;
begin
 select * into serie from public.series_pagar where id=p_serie for update;
 if not found or not serie.ativo then return 0; end if;
 if not private.validar_refs_pagar(serie.empresa_id,serie.fornecedor_id,serie.categoria_id,serie.centro_custo_id) then return 0; end if;
 select coalesce(serie.custo_fixo_override,c.custo_fixo) into fixo from public.categorias c where c.id=serie.categoria_id and c.empresa_id=serie.empresa_id;
 select coalesce(max(parcela),0)+1 into inicio from public.lancamentos_pagar where serie_id=serie.id;
 fim := case when serie.modo='recorrente' then least(greatest(p_ate,12),1212) else serie.parcelas end;
 for n in inicio..fim loop
  valor:=case when serie.modo='parcelado' then serie.valor_centavos/serie.parcelas + case when n<=serie.valor_centavos%serie.parcelas then 1 else 0 end else serie.valor_centavos end;
  insert into public.lancamentos_pagar(empresa_id,serie_id,descricao,documento,fornecedor_id,categoria_id,centro_custo_id,valor_centavos,vencimento,parcela,custo_fixo,custo_fixo_override)
   values(serie.empresa_id,serie.id,serie.descricao,serie.documento,serie.fornecedor_id,serie.categoria_id,serie.centro_custo_id,valor,
   private.vencimento_mensal(serie.primeiro_vencimento,n-1),n,fixo,serie.custo_fixo_override);
  gerados:=gerados+1;
 end loop;
 return gerados;
end;
$$;
create function private.criar_pagar(p_empresa uuid,p_request uuid,p_dados jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare serie public.series_pagar; pedido_hash text; gerados integer; modo text:=p_dados->>'modo'; qtd integer;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 pedido_hash:=encode(extensions.digest(p_dados::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_empresa::text||p_request::text,0));
 select * into serie from public.series_pagar where empresa_id=p_empresa and request_id=p_request;
 if found then return jsonb_build_object('codigo',case when serie.request_hash=pedido_hash then 'ok' else 'pedido_alterado' end,'serie_id',serie.id); end if;
 if not private.validar_refs_pagar(p_empresa,(p_dados->>'fornecedor_id')::uuid,(p_dados->>'categoria_id')::uuid,nullif(p_dados->>'centro_custo_id','')::uuid) then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 qtd:=case when modo='unica' then 1 when modo='parcelado' then (p_dados->>'parcelas')::integer else null end;
 insert into public.series_pagar(empresa_id,request_id,request_hash,descricao,documento,fornecedor_id,categoria_id,centro_custo_id,valor_centavos,primeiro_vencimento,modo,parcelas,custo_fixo_override)
 values(p_empresa,p_request,pedido_hash,btrim(p_dados->>'descricao'),nullif(btrim(p_dados->>'documento'),''),
 (p_dados->>'fornecedor_id')::uuid,(p_dados->>'categoria_id')::uuid,nullif(p_dados->>'centro_custo_id','')::uuid,
 (p_dados->>'valor_centavos')::bigint,(p_dados->>'vencimento')::date,modo,qtd,(p_dados->>'custo_fixo_override')::boolean) returning * into serie;
 gerados:=private.gerar_serie_pagar(serie.id,12);
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento,quantidade) values(p_empresa,auth.uid(),'contas_pagar','criar',gerados);
 return jsonb_build_object('codigo','ok','serie_id',serie.id,'gerados',gerados);
end;
$$;
create function private.expandir_pagar(p_empresa uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare serie public.series_pagar; n integer; total integer:=0; bloqueadas integer:=0; horizonte date;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 horizonte:=(date_trunc('month',private.hoje_financeiro())+interval '11 months')::date;
 for serie in select * from public.series_pagar where empresa_id=p_empresa and modo='recorrente' and ativo order by id loop
  if not private.validar_refs_pagar(p_empresa,serie.fornecedor_id,serie.categoria_id,serie.centro_custo_id) then bloqueadas:=bloqueadas+1; continue; end if;
  n:=(extract(year from horizonte)::integer-extract(year from serie.primeiro_vencimento)::integer)*12+extract(month from horizonte)::integer-extract(month from serie.primeiro_vencimento)::integer+1;
  total:=total+private.gerar_serie_pagar(serie.id,n);
 end loop;
 if total>0 then insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento,quantidade) values(p_empresa,auth.uid(),'contas_pagar','gerar_recorrencia',total); end if;
 return jsonb_build_object('codigo','ok','gerados',total,'bloqueadas',bloqueadas);
end;
$$;
create function private.editar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_pagar; cat uuid:=(p_dados->>'categoria_id')::uuid; forn uuid:=(p_dados->>'fornecedor_id')::uuid; centro uuid:=nullif(p_dados->>'centro_custo_id','')::uuid; fixo boolean;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_pagar where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if (cat<>atual.categoria_id or forn<>atual.fornecedor_id or centro is distinct from atual.centro_custo_id)
  and not private.validar_refs_pagar(p_empresa,forn,cat,centro) then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 select coalesce((p_dados->>'custo_fixo_override')::boolean,c.custo_fixo) into fixo from public.categorias c where c.id=cat and c.empresa_id=p_empresa and c.tipo='despesa';
 if not found then return jsonb_build_object('codigo','cadastro_invalido'); end if;
 update public.lancamentos_pagar set descricao=btrim(p_dados->>'descricao'),documento=nullif(btrim(p_dados->>'documento'),''),fornecedor_id=forn,categoria_id=cat,centro_custo_id=centro,
 valor_centavos=(p_dados->>'valor_centavos')::bigint,vencimento=(p_dados->>'vencimento')::date,custo_fixo=fixo,custo_fixo_override=(p_dados->>'custo_fixo_override')::boolean,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_pagar','editar');
 return jsonb_build_object('codigo','ok');
end;
$$;
create function private.cancelar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_serie boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_pagar; n integer;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_pagar where empresa_id=p_empresa and id=p_id;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 -- Mesmo lock usado na geração, antes de bloquear a ocorrência.
 perform 1 from public.series_pagar where id=atual.serie_id for update;
 select * into atual from public.lancamentos_pagar where empresa_id=p_empresa and id=p_id for update;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_serie then
  if not exists(select 1 from public.series_pagar where id=atual.serie_id and modo='recorrente' and ativo) then return jsonb_build_object('codigo','estado_invalido'); end if;
  update public.series_pagar set ativo=false,atualizado_em=clock_timestamp() where id=atual.serie_id;
  update public.lancamentos_pagar set status='cancelado',atualizado_em=clock_timestamp() where serie_id=atual.serie_id and status='aberto' and vencimento>private.hoje_financeiro();
  get diagnostics n=row_count;
 else
  if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
  update public.lancamentos_pagar set status='cancelado',atualizado_em=clock_timestamp() where id=atual.id;
  n:=1;
 end if;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_pagar',case when p_serie then 'interromper_recorrencia' else 'cancelar' end);
 return jsonb_build_object('codigo','ok','cancelados',n);
end;
$$;
create function private.baixar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_pin text,p_dados jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_pagar; aprovacao text; juros bigint:=(p_dados->>'juros_centavos')::bigint; multa bigint:=(p_dados->>'multa_centavos')::bigint; desconto bigint:=(p_dados->>'desconto_centavos')::bigint; valor bigint; data_pago date:=(p_dados->>'pago_em')::date;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_pagar where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if atual.status<>'aberto' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 valor:=atual.valor_centavos+juros+multa-desconto;
 if juros is null or multa is null or desconto is null or juros<0 or multa<0 or desconto<0 or valor is null or valor<1 or valor>1000000000000 or data_pago is null or data_pago>private.hoje_financeiro() or data_pago<date '2000-01-01' then return jsonb_build_object('codigo','valor_invalido'); end if;
 aprovacao:=private.verificar_aprovacao(p_pin);
 -- Retornar em vez de lançar erro preserva as tentativas e o bloqueio no commit.
 if aprovacao<>'ok' then return jsonb_build_object('codigo',aprovacao); end if;
 update public.lancamentos_pagar set status='pago',pago_em=data_pago,pago_por=auth.uid(),valor_pago_centavos=valor,juros_centavos=juros,multa_centavos=multa,desconto_centavos=desconto,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.baixas_pagar(empresa_id,lancamento_id,tipo,valor_centavos,data_pagamento,autor_id,observacao) values(p_empresa,atual.id,'baixa',valor,data_pago,auth.uid(),nullif(btrim(p_dados->>'observacao'),''));
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_pagar','baixa_manual');
 return jsonb_build_object('codigo','ok');
end;
$$;
create function private.estornar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_pin text,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare atual public.lancamentos_pagar; aprovacao text;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into atual from public.lancamentos_pagar where empresa_id=p_empresa and id=p_id for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if atual.status<>'pago' then return jsonb_build_object('codigo','estado_invalido'); end if;
 if p_versao is null or atual.atualizado_em<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_motivo is null or char_length(btrim(p_motivo))<5 or char_length(p_motivo)>500 then return jsonb_build_object('codigo','motivo_invalido'); end if;
 aprovacao:=private.verificar_aprovacao(p_pin);
 if aprovacao<>'ok' then return jsonb_build_object('codigo',aprovacao); end if;
 insert into public.baixas_pagar(empresa_id,lancamento_id,tipo,valor_centavos,data_pagamento,autor_id,observacao) values(p_empresa,atual.id,'estorno',atual.valor_pago_centavos,atual.pago_em,auth.uid(),btrim(p_motivo));
 update public.lancamentos_pagar set status='aberto',pago_em=null,pago_por=null,valor_pago_centavos=null,juros_centavos=0,multa_centavos=0,desconto_centavos=0,atualizado_em=clock_timestamp() where id=atual.id;
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'contas_pagar','estorno_manual');
 return jsonb_build_object('codigo','ok');
end;
$$;

-- Mutacoes financeiras passam exclusivamente pelas rotinas autorizadas.
alter table public.series_pagar enable row level security;
revoke all on public.series_pagar from public,anon,authenticated;
grant select on public.series_pagar to authenticated;
create policy series_pagar_consulta on public.series_pagar for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
alter table public.lancamentos_pagar enable row level security;
revoke all on public.lancamentos_pagar from public,anon,authenticated;
grant select on public.lancamentos_pagar to authenticated;
create policy lancamentos_pagar_consulta on public.lancamentos_pagar for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
alter table public.baixas_pagar enable row level security;
revoke all on public.baixas_pagar from public,anon,authenticated;
grant select on public.baixas_pagar to authenticated;
create policy baixas_pagar_consulta on public.baixas_pagar for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));
alter table public.eventos_uso enable row level security;
revoke all on public.eventos_uso from public,anon,authenticated;
grant select on public.eventos_uso to authenticated;
create policy eventos_uso_consulta on public.eventos_uso for select to authenticated using (private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','leitura','contador_completo','contador_leitura']));

create index series_pagar_fornecedor on public.series_pagar(empresa_id,fornecedor_id);
create index series_pagar_categoria on public.series_pagar(empresa_id,categoria_id,tipo_categoria);
create index series_pagar_centro on public.series_pagar(empresa_id,centro_custo_id);
create index pagar_vencimento on public.lancamentos_pagar(empresa_id,vencimento,id);
create index pagar_status on public.lancamentos_pagar(empresa_id,status,vencimento);
create index pagar_serie on public.lancamentos_pagar(empresa_id,serie_id);
create index pagar_fornecedor on public.lancamentos_pagar(empresa_id,fornecedor_id);
create index pagar_categoria on public.lancamentos_pagar(empresa_id,categoria_id,tipo_categoria);
create index pagar_centro on public.lancamentos_pagar(empresa_id,centro_custo_id);
create index pagar_autor on public.lancamentos_pagar(pago_por);
create index baixas_pagar_lancamento on public.baixas_pagar(empresa_id,lancamento_id,criado_em);
create index baixas_pagar_autor on public.baixas_pagar(autor_id);
create index eventos_uso_empresa on public.eventos_uso(empresa_id,criado_em);
create index eventos_uso_usuario on public.eventos_uso(usuario_id);
create function public.status_aprovacao() returns jsonb language sql security invoker set search_path='' as $$ select private.status_aprovacao(); $$;
revoke all on function private.status_aprovacao() from public,anon,authenticated;
grant execute on function private.status_aprovacao() to authenticated;
revoke all on function public.status_aprovacao() from public,anon;
grant execute on function public.status_aprovacao() to authenticated;
create function public.configurar_aprovacao(p_pin text,p_trocar boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select private.configurar_aprovacao(p_pin,p_trocar); $$;
revoke all on function private.configurar_aprovacao(text,boolean) from public,anon,authenticated;
grant execute on function private.configurar_aprovacao(text,boolean) to authenticated;
revoke all on function public.configurar_aprovacao(text,boolean) from public,anon;
grant execute on function public.configurar_aprovacao(text,boolean) to authenticated;
create function public.criar_pagar(p_empresa uuid,p_request uuid,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.criar_pagar(p_empresa,p_request,p_dados); $$;
revoke all on function private.criar_pagar(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.criar_pagar(uuid,uuid,jsonb) to authenticated;
revoke all on function public.criar_pagar(uuid,uuid,jsonb) from public,anon;
grant execute on function public.criar_pagar(uuid,uuid,jsonb) to authenticated;
create function public.expandir_pagar(p_empresa uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.expandir_pagar(p_empresa); $$;
revoke all on function private.expandir_pagar(uuid) from public,anon,authenticated;
grant execute on function private.expandir_pagar(uuid) to authenticated;
revoke all on function public.expandir_pagar(uuid) from public,anon;
grant execute on function public.expandir_pagar(uuid) to authenticated;
create function public.editar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.editar_pagar(p_empresa,p_id,p_versao,p_dados); $$;
revoke all on function private.editar_pagar(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function private.editar_pagar(uuid,uuid,timestamptz,jsonb) to authenticated;
revoke all on function public.editar_pagar(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.editar_pagar(uuid,uuid,timestamptz,jsonb) to authenticated;
create function public.cancelar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_serie boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.cancelar_pagar(p_empresa,p_id,p_versao,p_serie); $$;
revoke all on function private.cancelar_pagar(uuid,uuid,timestamptz,boolean) from public,anon,authenticated;
grant execute on function private.cancelar_pagar(uuid,uuid,timestamptz,boolean) to authenticated;
revoke all on function public.cancelar_pagar(uuid,uuid,timestamptz,boolean) from public,anon;
grant execute on function public.cancelar_pagar(uuid,uuid,timestamptz,boolean) to authenticated;
create function public.baixar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_pin text,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.baixar_pagar(p_empresa,p_id,p_versao,p_pin,p_dados); $$;
revoke all on function private.baixar_pagar(uuid,uuid,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function private.baixar_pagar(uuid,uuid,timestamptz,text,jsonb) to authenticated;
revoke all on function public.baixar_pagar(uuid,uuid,timestamptz,text,jsonb) from public,anon;
grant execute on function public.baixar_pagar(uuid,uuid,timestamptz,text,jsonb) to authenticated;
create function public.estornar_pagar(p_empresa uuid,p_id uuid,p_versao timestamptz,p_pin text,p_motivo text) returns jsonb language sql security invoker set search_path='' as $$ select private.estornar_pagar(p_empresa,p_id,p_versao,p_pin,p_motivo); $$;
revoke all on function private.estornar_pagar(uuid,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function private.estornar_pagar(uuid,uuid,timestamptz,text,text) to authenticated;
revoke all on function public.estornar_pagar(uuid,uuid,timestamptz,text,text) from public,anon;
grant execute on function public.estornar_pagar(uuid,uuid,timestamptz,text,text) to authenticated;
revoke all on function private.hoje_financeiro() from public,anon,authenticated;
revoke all on function private.vencimento_mensal(date,integer) from public,anon,authenticated;
revoke all on function private.pin_forte(text) from public,anon,authenticated;
revoke all on function private.validar_refs_pagar(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function private.verificar_aprovacao(text) from public,anon,authenticated;
revoke all on function private.gerar_serie_pagar(uuid,integer) from public,anon,authenticated;

create function public.resumo_pagar(p_empresa uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'aberto',coalesce(sum(valor_centavos) filter(where status='aberto'),0)::text,
 'vencido',coalesce(sum(valor_centavos) filter(where status='aberto' and vencimento<timezone('America/Bahia',now())::date),0)::text,
 'pago',coalesce(sum(valor_pago_centavos) filter(where status='pago'),0)::text,
 'fixo',coalesce(sum(valor_centavos) filter(where status='aberto' and custo_fixo),0)::text)
 from public.lancamentos_pagar where empresa_id=p_empresa;
$$;
revoke all on function public.resumo_pagar(uuid) from public,anon;
grant execute on function public.resumo_pagar(uuid) to authenticated;

