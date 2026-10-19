create table public.cenarios_planejamento (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check(char_length(btrim(nome)) between 2 and 120),ano integer not null check(ano between 2000 and 2100),
 arquivado boolean not null default false,versao integer not null default 1,request_id uuid not null,request_hash text not null,
 autor_id uuid not null references auth.users(id),criado_em timestamptz not null default clock_timestamp(),unique(empresa_id,id),unique(empresa_id,request_id)
);
create unique index cenarios_nome on public.cenarios_planejamento(empresa_id,ano,lower(btrim(nome)));
create index cenarios_autor on public.cenarios_planejamento(autor_id);
create table public.convites_planejamento (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,cenario_id uuid not null,
 centro_custo_id uuid not null,email text not null check(char_length(email) between 3 and 254 and email=lower(btrim(email)) and email~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 token_hash text not null unique check(token_hash~'^[a-f0-9]{64}$'),expira_em timestamptz not null,revogado_em timestamptz,
 autor_id uuid not null references auth.users(id),criado_em timestamptz not null default clock_timestamp(),
 versao integer not null default 1,revisao integer not null default 0,importada integer,status text not null default 'pendente' check(status in('pendente','recebido','revisado')),
 linhas jsonb not null default '[]'::jsonb,unique(empresa_id,id),
 foreign key(empresa_id,cenario_id) references public.cenarios_planejamento(empresa_id,id) on delete cascade,
 foreign key(empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id)
);
create index convites_plano_cenario on public.convites_planejamento(empresa_id,cenario_id);
create index convites_plano_centro on public.convites_planejamento(empresa_id,centro_custo_id);
create index convites_plano_autor on public.convites_planejamento(autor_id);
create table public.plano_linhas (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,cenario_id uuid not null,
 categoria_id uuid not null,centro_custo_id uuid,tipo text not null check(tipo in('receita','despesa')),
 mes date not null check(extract(day from mes)=1),descricao text not null check(char_length(btrim(descricao)) between 2 and 160),
 valor_unitario_centavos bigint not null check(valor_unitario_centavos between 1 and 1000000000000),quantidade integer not null default 1 check(quantidade between 1 and 1000000),
 valor_centavos bigint generated always as(valor_unitario_centavos*quantidade) stored check(valor_centavos between 1 and 1000000000000),
 convite_id uuid,origem_revisao integer,origem_indice integer,
 foreign key(empresa_id,cenario_id) references public.cenarios_planejamento(empresa_id,id) on delete cascade,
 foreign key(empresa_id,categoria_id,tipo) references public.categorias(empresa_id,id,tipo),
 foreign key(empresa_id,centro_custo_id) references public.centros_custo(empresa_id,id),
 foreign key(empresa_id,convite_id) references public.convites_planejamento(empresa_id,id),unique(cenario_id,convite_id,origem_revisao,origem_indice)
);
create index plano_cenario_mes on public.plano_linhas(empresa_id,cenario_id,mes);
create index plano_categoria on public.plano_linhas(empresa_id,categoria_id,tipo);
create index plano_centro on public.plano_linhas(empresa_id,centro_custo_id);
create index plano_convite on public.plano_linhas(empresa_id,convite_id);
create table public.historico_planejamento (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,cenario_id uuid not null,
 autor_id uuid references auth.users(id),evento text not null,dados jsonb not null,criado_em timestamptz not null default clock_timestamp(),
 foreign key(empresa_id,cenario_id) references public.cenarios_planejamento(empresa_id,id) on delete cascade
);
create index historico_plano_cenario on public.historico_planejamento(empresa_id,cenario_id,criado_em);
create index historico_plano_autor on public.historico_planejamento(autor_id);
create table public.fechamentos_planejamento (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,cenario_id uuid not null,mes date not null,
 snapshot jsonb not null,autor_id uuid not null references auth.users(id),criado_em timestamptz not null default clock_timestamp(),
 reaberto_em timestamptz,reaberto_por uuid references auth.users(id),motivo text,
 foreign key(empresa_id,cenario_id) references public.cenarios_planejamento(empresa_id,id) on delete cascade
);
create unique index fechamento_plano_ativo on public.fechamentos_planejamento(empresa_id,cenario_id,mes) where reaberto_em is null;
create index fechamento_plano_autor on public.fechamentos_planejamento(autor_id);
create index fechamento_plano_reaberto_por on public.fechamentos_planejamento(reaberto_por);
-- Espelhos imutáveis das revisões do líder ficam no histórico, separados do plano.
do $$ declare t text; begin
 foreach t in array array['cenarios_planejamento','convites_planejamento','plano_linhas','historico_planejamento','fechamentos_planejamento'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy consulta on public.%I for select to authenticated using(private.tem_papel_empresa(empresa_id,array[''proprietario'',''administrador'',''operador'',''contador_completo'',''leitura'',''contador_leitura'']))',t);
 end loop;
end $$;

create function public.grade_planejamento(p_cenario uuid)
returns table(tipo text,categoria_id uuid,centro_custo_id uuid,mes date,base text,plano text,realizado text,fixos text)
language sql stable security invoker set search_path='' as $$
 with c as (select * from public.cenarios_planejamento where id=p_cenario), fontes as (
 select 'despesa'::text tipo,l.categoria_id,l.centro_custo_id,date_trunc('month',l.vencimento)::date mes,l.valor_centavos::numeric base,0::numeric plano,0::numeric realizado,case when l.custo_fixo then l.valor_centavos else 0 end::numeric fixos
 from public.lancamentos_pagar l join c on c.empresa_id=l.empresa_id where l.status<>'cancelado' and extract(year from l.vencimento)=c.ano
 union all select 'receita',l.categoria_id,l.centro_custo_id,date_trunc('month',l.vencimento)::date,l.valor_centavos::numeric,0,0,0 from public.lancamentos_receber l join c on c.empresa_id=l.empresa_id where l.status<>'cancelado' and extract(year from l.vencimento)=c.ano
 union all select l.tipo,l.categoria_id,l.centro_custo_id,l.mes,0,l.valor_centavos::numeric,0,0 from public.plano_linhas l join c on c.id=l.cenario_id and c.empresa_id=l.empresa_id
 union all select 'despesa',l.categoria_id,l.centro_custo_id,date_trunc('month',l.pago_em)::date,0,0,l.valor_pago_centavos::numeric,0 from public.lancamentos_pagar l join c on c.empresa_id=l.empresa_id where l.status='pago' and extract(year from l.pago_em)=c.ano
 union all select 'receita',l.categoria_id,l.centro_custo_id,date_trunc('month',l.recebido_em)::date,0,0,l.valor_recebido_centavos::numeric,0 from public.lancamentos_receber l join c on c.empresa_id=l.empresa_id where l.status='recebido' and extract(year from l.recebido_em)=c.ano
 ), fechados as (select f.* from public.fechamentos_planejamento f join c on c.id=f.cenario_id and c.empresa_id=f.empresa_id where f.reaberto_em is null), grade as (
 select s.tipo,s.categoria_id,s.centro_custo_id,s.mes,sum(s.base) base,sum(s.plano) plano,sum(s.realizado) realizado,sum(s.fixos) fixos from fontes s where not exists(select 1 from fechados f where f.mes=s.mes) group by s.tipo,s.categoria_id,s.centro_custo_id,s.mes
 union all select g.tipo,g.categoria_id,g.centro_custo_id,g.mes,g.base,g.plano,g.realizado,g.fixos from fechados f cross join lateral jsonb_to_recordset(f.snapshot->'grade') g(tipo text,categoria_id uuid,centro_custo_id uuid,mes date,base numeric,plano numeric,realizado numeric,fixos numeric)
 ) select tipo,categoria_id,centro_custo_id,mes,base::text,plano::text,realizado::text,fixos::text from grade;
$$;
revoke all on function public.grade_planejamento(uuid) from public,anon;
grant execute on function public.grade_planejamento(uuid) to authenticated;

create function public.resumo_planejamento(p_empresa uuid,p_cenario uuid,p_pagina integer default 1) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare c public.cenarios_planejamento; fluxo jsonb; resultado jsonb;
begin
 select * into c from public.cenarios_planejamento where empresa_id=p_empresa and id=p_cenario;
 if not found then return null; end if;
 if p_pagina is null or p_pagina not between 1 and 1000000 then raise exception 'Pagina invalida' using errcode='22023'; end if;
 fluxo:=public.fluxo_caixa(p_empresa,make_date(c.ano,1,1),make_date(c.ano,12,31),null,false,1);
 with grade as materialized(select * from public.grade_planejamento(c.id)), grupos as (
  select distinct g.tipo,g.categoria_id,g.centro_custo_id,cat.nome categoria,coalesce(cc.nome,'Sem centro de custo') centro
  from grade g join public.categorias cat on cat.empresa_id=p_empresa and cat.id=g.categoria_id left join public.centros_custo cc on cc.empresa_id=p_empresa and cc.id=g.centro_custo_id
 ), contagem as(select count(*) total from grupos), paginacao as(select total,least(p_pagina,greatest(1,ceil(total/50.0)::integer)) pagina from contagem), pagina as (
  select * from grupos order by tipo,centro,categoria,categoria_id,centro_custo_id nulls first limit 50 offset(select (pagina-1)*50 from paginacao)
 ), meses as(select make_date(c.ano,n,1) mes from generate_series(1,12) n), diario as(select * from jsonb_to_recordset(fluxo->'dias') d(data date,saldo_projetado numeric)), caixa as (
  select distinct on(date_trunc('month',data)) date_trunc('month',data)::date mes,saldo_projetado from diario order by date_trunc('month',data),data desc
 ), totais as (
  select m.mes,coalesce(sum(g.plano::numeric) filter(where g.tipo='receita'),0) receitas,coalesce(sum(g.plano::numeric) filter(where g.tipo='despesa'),0) despesas,coalesce(sum(g.fixos::numeric),0) fixos from meses m left join grade g on g.mes=m.mes group by m.mes
 ) select jsonb_build_object('cenario',jsonb_build_object('id',c.id,'nome',c.nome,'ano',c.ano,'versao',c.versao,'arquivado',c.arquivado),'total',p.total,'pagina',p.pagina,
  'grade',coalesce((select jsonb_agg(jsonb_build_object('tipo',p.tipo,'categoria_id',p.categoria_id,'centro_custo_id',p.centro_custo_id,'categoria',p.categoria,'centro',p.centro,'meses',(select jsonb_agg(to_jsonb(g) order by g.mes) from grade g where g.tipo=p.tipo and g.categoria_id=p.categoria_id and g.centro_custo_id is not distinct from p.centro_custo_id)) order by p.tipo,p.centro,p.categoria,p.categoria_id,p.centro_custo_id) from pagina p),'[]'::jsonb),
  'meses',(select jsonb_agg(jsonb_build_object('mes',t.mes,'receitas',t.receitas::text,'despesas',t.despesas::text,'fixos',t.fixos::text,'caixa',coalesce((f.snapshot->>'caixa')::numeric,x.saldo_projetado)::text,'fechado',f.id is not null) order by t.mes) from totais t join caixa x on x.mes=t.mes left join public.fechamentos_planejamento f on f.empresa_id=p_empresa and f.cenario_id=c.id and f.mes=t.mes and f.reaberto_em is null)) into resultado from paginacao p;
 return resultado;
end; $$;
revoke all on function public.resumo_planejamento(uuid,uuid,integer) from public,anon;
grant execute on function public.resumo_planejamento(uuid,uuid,integer) to authenticated;

create function private.operar_planejamento(p_empresa uuid,p_cenario uuid,p_versao integer,p_acao text,p_dados jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.cenarios_planejamento; novo uuid; linha public.plano_linhas; convite public.convites_planejamento; v_mes date; ano integer; item jsonb; indice integer:=0; snap jsonb; hash text:=md5(jsonb_build_object('acao',p_acao,'cenario',p_cenario,'dados',p_dados)::text);
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_dados is null or jsonb_typeof(p_dados)<>'object' then return jsonb_build_object('codigo','dados_invalidos'); end if;
 if p_acao in('criar','duplicar') then
  if p_dados->>'request_id' is null then return jsonb_build_object('codigo','dados_invalidos'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_empresa::text||(p_dados->>'request_id'),0));
 end if;
 if p_acao='criar' then
  select id into novo from public.cenarios_planejamento where empresa_id=p_empresa and request_id=(p_dados->>'request_id')::uuid and request_hash=hash;
  if found then return jsonb_build_object('codigo','ok','id',novo,'reenvio',true); end if;
  insert into public.cenarios_planejamento(empresa_id,nome,ano,autor_id,request_id,request_hash) values(p_empresa,btrim(p_dados->>'nome'),(p_dados->>'ano')::integer,auth.uid(),(p_dados->>'request_id')::uuid,hash) returning id into novo;
 else
  select * into c from public.cenarios_planejamento where empresa_id=p_empresa and id=p_cenario for update;
  if not found then return jsonb_build_object('codigo','indisponivel'); end if;
  if p_acao='duplicar' then
   select id into novo from public.cenarios_planejamento where empresa_id=p_empresa and request_id=(p_dados->>'request_id')::uuid and request_hash=hash;
   if found then return jsonb_build_object('codigo','ok','id',novo,'reenvio',true); end if;
  end if;
  if p_versao is null or c.versao<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
  if c.arquivado and p_acao<>'reativar' then return jsonb_build_object('codigo','arquivado'); end if;
  novo:=c.id;
  if p_acao='renomear' then update public.cenarios_planejamento set nome=btrim(p_dados->>'nome') where id=c.id;
  elsif p_acao in('arquivar','reativar') then update public.cenarios_planejamento set arquivado=(p_acao='arquivar') where id=c.id;
  elsif p_acao='duplicar' then
   ano:=(p_dados->>'ano')::integer;
   insert into public.cenarios_planejamento(empresa_id,nome,ano,autor_id,request_id,request_hash) values(p_empresa,btrim(p_dados->>'nome'),ano,auth.uid(),(p_dados->>'request_id')::uuid,hash) returning id into novo;
   insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade)
    select p_empresa,novo,categoria_id,centro_custo_id,tipo,make_date(ano,extract(month from mes)::integer,1),descricao,valor_unitario_centavos,quantidade from public.plano_linhas where cenario_id=c.id and empresa_id=p_empresa;
  elsif p_acao in('linha','excluir') then
   if nullif(p_dados->>'id','') is not null then
    select * into linha from public.plano_linhas where empresa_id=p_empresa and cenario_id=c.id and id=(p_dados->>'id')::uuid;
    if not found then return jsonb_build_object('codigo','indisponivel'); end if;
    if exists(select 1 from public.fechamentos_planejamento where empresa_id=p_empresa and cenario_id=c.id and mes=linha.mes and reaberto_em is null) then return jsonb_build_object('codigo','mes_fechado'); end if;
   elsif p_acao='excluir' then return jsonb_build_object('codigo','indisponivel'); end if;
   if p_acao='excluir' then delete from public.plano_linhas where id=linha.id;
   else
    v_mes:=(p_dados->>'mes')::date;
    if v_mes is null or extract(year from v_mes)<>c.ano or extract(day from v_mes)<>1 then return jsonb_build_object('codigo','dados_invalidos'); end if;
    if exists(select 1 from public.fechamentos_planejamento where empresa_id=p_empresa and cenario_id=c.id and mes=v_mes and reaberto_em is null) then return jsonb_build_object('codigo','mes_fechado'); end if;
    if not exists(select 1 from public.categorias where empresa_id=p_empresa and id=(p_dados->>'categoria_id')::uuid and tipo=p_dados->>'tipo' and ativo)
     or (nullif(p_dados->>'centro_custo_id','') is not null and not exists(select 1 from public.centros_custo where empresa_id=p_empresa and id=(p_dados->>'centro_custo_id')::uuid and ativo)) then return jsonb_build_object('codigo','referencia_invalida'); end if;
    if linha.id is null then insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade) values(p_empresa,c.id,(p_dados->>'categoria_id')::uuid,nullif(p_dados->>'centro_custo_id','')::uuid,p_dados->>'tipo',v_mes,btrim(p_dados->>'descricao'),(p_dados->>'valor_unitario_centavos')::bigint,(p_dados->>'quantidade')::integer);
    else update public.plano_linhas set categoria_id=(p_dados->>'categoria_id')::uuid,centro_custo_id=nullif(p_dados->>'centro_custo_id','')::uuid,tipo=p_dados->>'tipo',mes=v_mes,descricao=btrim(p_dados->>'descricao'),valor_unitario_centavos=(p_dados->>'valor_unitario_centavos')::bigint,quantidade=(p_dados->>'quantidade')::integer where id=linha.id; end if;
   end if;
  elsif p_acao in('fechar','reabrir') then
   v_mes:=(p_dados->>'mes')::date;
   if v_mes is null or extract(year from v_mes)<>c.ano or extract(day from v_mes)<>1 or v_mes>=date_trunc('month',private.hoje_financeiro())::date then return jsonb_build_object('codigo','mes_invalido'); end if;
   if p_acao='fechar' then
    if exists(select 1 from public.fechamentos_planejamento f where f.cenario_id=c.id and f.mes=v_mes and f.reaberto_em is null) then return jsonb_build_object('codigo','mes_fechado'); end if;
    snap:=jsonb_build_object('grade',coalesce((select jsonb_agg(to_jsonb(g)) from public.grade_planejamento(c.id) g where g.mes=v_mes),'[]'::jsonb),'caixa',(public.fluxo_caixa(p_empresa,v_mes,(v_mes+interval '1 month'-interval '1 day')::date,null,false,1)->'dias'->-1->>'saldo_projetado'));
    insert into public.fechamentos_planejamento(empresa_id,cenario_id,mes,snapshot,autor_id) values(p_empresa,c.id,v_mes,snap,auth.uid());
   else
    if coalesce(char_length(btrim(p_dados->>'motivo')),0) not between 5 and 500 then return jsonb_build_object('codigo','motivo_invalido'); end if;
    update public.fechamentos_planejamento f set reaberto_em=clock_timestamp(),reaberto_por=auth.uid(),motivo=btrim(p_dados->>'motivo') where f.cenario_id=c.id and f.mes=v_mes and f.reaberto_em is null;
    if not found then return jsonb_build_object('codigo','mes_aberto'); end if;
   end if;
  elsif p_acao='convite' then
   if not exists(select 1 from public.centros_custo where empresa_id=p_empresa and id=(p_dados->>'centro_custo_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
   if (p_dados->>'expira_em')::timestamptz is null or (p_dados->>'expira_em')::timestamptz<=now() or (p_dados->>'expira_em')::timestamptz>now()+interval '7 days' then return jsonb_build_object('codigo','prazo_invalido'); end if;
   insert into public.convites_planejamento(empresa_id,cenario_id,centro_custo_id,email,token_hash,expira_em,autor_id) values(p_empresa,c.id,(p_dados->>'centro_custo_id')::uuid,lower(btrim(p_dados->>'email')),p_dados->>'token_hash',(p_dados->>'expira_em')::timestamptz,auth.uid());
  elsif p_acao in('revogar','revisar','importar') then
   select * into convite from public.convites_planejamento where empresa_id=p_empresa and cenario_id=c.id and id=(p_dados->>'convite_id')::uuid for update;
   if not found then return jsonb_build_object('codigo','indisponivel'); end if;
   if p_acao='revogar' then update public.convites_planejamento set revogado_em=clock_timestamp(),versao=versao+1 where id=convite.id;
   else
    if convite.revisao=0 or convite.revisao<>(p_dados->>'revisao')::integer or (p_dados->>'revisao') is null then return jsonb_build_object('codigo','contribuicao_mudou'); end if;
    if p_acao='revisar' then update public.convites_planejamento set status='revisado',versao=versao+1 where id=convite.id;
    else
     if convite.importada=convite.revisao then return jsonb_build_object('codigo','ok','id',c.id,'reenvio',true); end if;
     if exists(select 1 from jsonb_array_elements(convite.linhas) incoming(value) where not exists(select 1 from public.categorias cat where cat.empresa_id=p_empresa and cat.id=(incoming.value->>'categoria_id')::uuid and cat.tipo='despesa' and cat.ativo)) then return jsonb_build_object('codigo','referencia_invalida'); end if;
     if exists(select 1 from public.fechamentos_planejamento f where f.cenario_id=c.id and f.reaberto_em is null and (f.mes in(select (value->>'mes')::date from jsonb_array_elements(convite.linhas)) or f.mes in(select l.mes from public.plano_linhas l where l.convite_id=convite.id))) then return jsonb_build_object('codigo','mes_fechado'); end if;
     delete from public.plano_linhas where empresa_id=p_empresa and cenario_id=c.id and convite_id=convite.id;
     for item in select value from jsonb_array_elements(convite.linhas) loop
      indice:=indice+1;
      insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade,convite_id,origem_revisao,origem_indice)
       values(p_empresa,c.id,(item->>'categoria_id')::uuid,convite.centro_custo_id,'despesa',(item->>'mes')::date,item->>'descricao',(item->>'valor_centavos')::bigint,1,convite.id,convite.revisao,indice);
     end loop;
     update public.convites_planejamento set importada=revisao,status='revisado',versao=versao+1 where id=convite.id;
    end if;
   end if;
  else return jsonb_build_object('codigo','acao_invalida'); end if;
  update public.cenarios_planejamento set versao=versao+1 where id=c.id;
 end if;
 insert into public.historico_planejamento(empresa_id,cenario_id,autor_id,evento,dados) values(p_empresa,novo,auth.uid(),p_acao,p_dados-'token_hash');
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'planejamento',p_acao);
 return jsonb_build_object('codigo','ok','id',novo);
end; $$;
create function public.operar_planejamento(p_empresa uuid,p_cenario uuid,p_versao integer,p_acao text,p_dados jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.operar_planejamento(p_empresa,p_cenario,p_versao,p_acao,p_dados); $$;
revoke all on function private.operar_planejamento(uuid,uuid,integer,text,jsonb) from public,anon;
revoke all on function public.operar_planejamento(uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function private.operar_planejamento(uuid,uuid,integer,text,jsonb),public.operar_planejamento(uuid,uuid,integer,text,jsonb) to authenticated;

-- O link sozinho não autoriza leitura. A pré-validação só confirma hash + e-mail;
-- detalhes e envio exigem identidade confirmada por OTP recente no JWT assinado.
create function private.validar_link_lider(p_hash text,p_email text) returns boolean language sql stable security definer set search_path='' as $$
 select p_hash~'^[a-f0-9]{64}$' and exists(select 1 from public.convites_planejamento i join public.cenarios_planejamento c on c.id=i.cenario_id and c.empresa_id=i.empresa_id
 where i.token_hash=p_hash and i.email=lower(btrim(p_email)) and i.revogado_em is null and i.expira_em>now() and not c.arquivado);
$$;
-- Corpo SQL analisado na definição: resolve a função privada pelo OID sem dar
-- USAGE do schema privado ao papel anon. EXECUTE só permite esta pré-validação.
create function public.validar_link_lider(p_hash text,p_email text) returns boolean language sql stable security invoker set search_path=''
begin atomic
 select private.validar_link_lider(p_hash,p_email);
end;
revoke all on function private.validar_link_lider(text,text),public.validar_link_lider(text,text) from public;
grant execute on function private.validar_link_lider(text,text),public.validar_link_lider(text,text) to anon,authenticated;

create function private.lider_verificado(p_hash text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare email text; otp_time bigint;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'session_id','')='' then return false; end if;
 select u.email into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select max((a->>'timestamp')::bigint) into otp_time from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='otp';
 if otp_time is null or otp_time<extract(epoch from now()-interval '15 minutes') or otp_time>extract(epoch from now()+interval '30 seconds') then return false; end if;
 return private.validar_link_lider(p_hash,email) and exists(select 1 from public.convites_planejamento where token_hash=p_hash and extract(epoch from criado_em)::bigint<=otp_time+1);
end; $$;
revoke all on function private.lider_verificado(text) from public,anon,authenticated;

create function private.consultar_contribuicao(p_hash text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.convites_planejamento;
begin
 if not private.lider_verificado(p_hash) then return null; end if;
 select * into i from public.convites_planejamento where token_hash=p_hash;
 return jsonb_build_object('setor',(select nome from public.centros_custo where empresa_id=i.empresa_id and id=i.centro_custo_id),'ano',(select ano from public.cenarios_planejamento where id=i.cenario_id),
 'expira_em',i.expira_em,'versao',i.versao,'revisao',i.revisao,'linhas',i.linhas,'categorias',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome) order by nome,id) from public.categorias where empresa_id=i.empresa_id and tipo='despesa' and ativo),'[]'::jsonb));
end; $$;
create function public.consultar_contribuicao(p_hash text) returns jsonb language sql stable security invoker set search_path='' as $$ select private.consultar_contribuicao(p_hash); $$;
revoke all on function private.consultar_contribuicao(text),public.consultar_contribuicao(text) from public,anon;
grant execute on function private.consultar_contribuicao(text),public.consultar_contribuicao(text) to authenticated;

create function private.salvar_contribuicao(p_hash text,p_versao integer,p_linhas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.convites_planejamento; c public.cenarios_planejamento; item jsonb;
begin
 if not private.lider_verificado(p_hash) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into i from public.convites_planejamento where token_hash=p_hash;
 select * into c from public.cenarios_planejamento where id=i.cenario_id for update;
 select * into i from public.convites_planejamento where token_hash=p_hash for update;
 if not private.lider_verificado(p_hash) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_versao is null or p_versao<>i.versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_linhas is null or jsonb_typeof(p_linhas)<>'array' or jsonb_array_length(p_linhas) not between 0 and 120 then return jsonb_build_object('codigo','dados_invalidos'); end if;
 for item in select value from jsonb_array_elements(p_linhas) loop
  if coalesce(char_length(btrim(item->>'descricao')),0) not between 2 and 160 or (item->>'valor_centavos') is null or (item->>'valor_centavos')::bigint not between 1 and 1000000000000
   or (item->>'mes') is null or extract(year from (item->>'mes')::date)<>c.ano or extract(day from (item->>'mes')::date)<>1
   or not exists(select 1 from public.categorias where empresa_id=i.empresa_id and id=(item->>'categoria_id')::uuid and tipo='despesa' and ativo) then return jsonb_build_object('codigo','dados_invalidos'); end if;
 end loop;
 -- Reconstroi o DTO: ignora campos como empresa/centro/tipo fornecidos pelo líder.
 select coalesce(jsonb_agg(jsonb_build_object('categoria_id',value->>'categoria_id','mes',value->>'mes','descricao',btrim(value->>'descricao'),'valor_centavos',((value->>'valor_centavos')::bigint)::text) order by ord),'[]'::jsonb) into p_linhas from jsonb_array_elements(p_linhas) with ordinality rows(value,ord);
 update public.convites_planejamento set linhas=p_linhas,revisao=revisao+1,versao=versao+1,status='recebido' where id=i.id;
 insert into public.historico_planejamento(empresa_id,cenario_id,autor_id,evento,dados) values(i.empresa_id,i.cenario_id,auth.uid(),'contribuicao',jsonb_build_object('convite_id',i.id,'revisao',i.revisao+1,'linhas',p_linhas));
 return jsonb_build_object('codigo','ok','revisao',i.revisao+1);
end; $$;
create function public.salvar_contribuicao(p_hash text,p_versao integer,p_linhas jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.salvar_contribuicao(p_hash,p_versao,p_linhas); $$;
revoke all on function private.salvar_contribuicao(text,integer,jsonb),public.salvar_contribuicao(text,integer,jsonb) from public,anon;
grant execute on function private.salvar_contribuicao(text,integer,jsonb),public.salvar_contribuicao(text,integer,jsonb) to authenticated;
