alter table public.plano_linhas add constraint plano_linhas_cenario_id unique(empresa_id,cenario_id,id);
alter table public.plano_linhas add column copiada_de uuid references public.plano_linhas(id) on delete set null;
create index plano_copiada_de on public.plano_linhas(copiada_de);
create table public.execucoes_plano (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references public.empresas(id) on delete cascade,cenario_id uuid not null,linha_id uuid not null,
 pagar_id uuid,receber_id uuid,autor_id uuid not null references auth.users(id),criado_em timestamptz not null default clock_timestamp(),
 check((pagar_id is null)<>(receber_id is null)),unique(empresa_id,cenario_id,linha_id),
 foreign key(empresa_id,cenario_id,linha_id) references public.plano_linhas(empresa_id,cenario_id,id) on delete cascade,
 foreign key(empresa_id,pagar_id) references public.lancamentos_pagar(empresa_id,id) on delete cascade,
 foreign key(empresa_id,receber_id) references public.lancamentos_receber(empresa_id,id) on delete cascade
);
create unique index execucao_plano_pagar on public.execucoes_plano(cenario_id,pagar_id) where pagar_id is not null;
create unique index execucao_plano_receber on public.execucoes_plano(cenario_id,receber_id) where receber_id is not null;
create index execucao_plano_pagar_fk on public.execucoes_plano(empresa_id,pagar_id);
create index execucao_plano_receber_fk on public.execucoes_plano(empresa_id,receber_id);
create index execucao_plano_autor on public.execucoes_plano(autor_id);
alter table public.execucoes_plano enable row level security;
revoke all on public.execucoes_plano from public,anon,authenticated;
grant select on public.execucoes_plano to authenticated;
create policy consulta on public.execucoes_plano for select to authenticated using(private.tem_papel_empresa(empresa_id,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']));

create function public.adicionais_planejamento(p_cenario uuid) returns table(mes date,receitas text,despesas text)
language sql stable security invoker set search_path='' as $$
 with validos as (
  select v.linha_id from public.execucoes_plano v join public.lancamentos_pagar l on l.empresa_id=v.empresa_id and l.id=v.pagar_id where v.cenario_id=p_cenario and l.status<>'cancelado'
  union all select v.linha_id from public.execucoes_plano v join public.lancamentos_receber l on l.empresa_id=v.empresa_id and l.id=v.receber_id where v.cenario_id=p_cenario and l.status<>'cancelado'
 ) select l.mes,coalesce(sum(l.valor_centavos::numeric) filter(where l.tipo='receita'),0)::text,coalesce(sum(l.valor_centavos::numeric) filter(where l.tipo='despesa'),0)::text
 from public.plano_linhas l where l.cenario_id=p_cenario and not exists(select 1 from validos v where v.linha_id=l.id) group by l.mes;
$$;
revoke all on function public.adicionais_planejamento(uuid) from public,anon;
grant execute on function public.adicionais_planejamento(uuid) to authenticated;

create function private.fotografar_adicionais_plano() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.snapshot:=new.snapshot||jsonb_build_object('adicionais',coalesce((select jsonb_build_object('receitas',a.receitas,'despesas',a.despesas) from public.adicionais_planejamento(new.cenario_id) a where a.mes=new.mes),jsonb_build_object('receitas','0','despesas','0')));
 return new;
end; $$;
revoke all on function private.fotografar_adicionais_plano() from public,anon,authenticated;
create trigger fotografar_adicionais before insert on public.fechamentos_planejamento for each row execute function private.fotografar_adicionais_plano();

create function private.proteger_execucao_plano() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' and (not exists(select 1 from public.empresas where id=old.empresa_id) or not exists(select 1 from public.cenarios_planejamento where id=old.cenario_id)) then return old; end if;
 if (tg_op='DELETE' or new.tipo<>old.tipo) and exists(select 1 from public.execucoes_plano where linha_id=old.id) then
  raise exception 'Desvincule a execução antes de excluir a linha ou alterar seu tipo.' using errcode='23514';
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end; $$;
revoke all on function private.proteger_execucao_plano() from public,anon,authenticated;
create trigger proteger_execucao before update or delete on public.plano_linhas for each row execute function private.proteger_execucao_plano();

create function private.vincular_execucao_plano(p_empresa uuid,p_cenario uuid,p_versao integer,p_linha uuid,p_tipo text,p_lancamento uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.cenarios_planejamento; l public.plano_linhas;
begin
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into c from public.cenarios_planejamento where empresa_id=p_empresa and id=p_cenario for update;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_versao is null or p_versao<>c.versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if c.arquivado then return jsonb_build_object('codigo','arquivado'); end if;
 select * into l from public.plano_linhas where empresa_id=p_empresa and cenario_id=c.id and id=p_linha;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if exists(select 1 from public.fechamentos_planejamento where cenario_id=c.id and mes=l.mes and reaberto_em is null) then return jsonb_build_object('codigo','mes_fechado'); end if;
 if p_tipo is null or p_tipo<>l.tipo then return jsonb_build_object('codigo','referencia_invalida'); end if;
 if p_lancamento is not null then
  if (l.tipo='despesa' and not exists(select 1 from public.lancamentos_pagar where empresa_id=p_empresa and id=p_lancamento and status<>'cancelado'))
   or (l.tipo='receita' and not exists(select 1 from public.lancamentos_receber where empresa_id=p_empresa and id=p_lancamento and status<>'cancelado')) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if exists(select 1 from public.execucoes_plano where cenario_id=c.id and linha_id<>l.id and ((l.tipo='despesa' and pagar_id=p_lancamento) or (l.tipo='receita' and receber_id=p_lancamento))) then return jsonb_build_object('codigo','ja_vinculado'); end if;
 end if;
 delete from public.execucoes_plano where empresa_id=p_empresa and cenario_id=c.id and linha_id=l.id;
 if p_lancamento is not null then insert into public.execucoes_plano(empresa_id,cenario_id,linha_id,pagar_id,receber_id,autor_id) values(p_empresa,c.id,l.id,case when l.tipo='despesa' then p_lancamento end,case when l.tipo='receita' then p_lancamento end,auth.uid()); end if;
 update public.cenarios_planejamento set versao=versao+1 where id=c.id;
 insert into public.historico_planejamento(empresa_id,cenario_id,autor_id,evento,dados) values(p_empresa,c.id,auth.uid(),'vincular_execucao',jsonb_build_object('linha_id',l.id,'lancamento_id',p_lancamento,'tipo',l.tipo));
 return jsonb_build_object('codigo','ok','id',c.id);
end; $$;
create function public.vincular_execucao_plano(p_empresa uuid,p_cenario uuid,p_versao integer,p_linha uuid,p_tipo text,p_lancamento uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.vincular_execucao_plano(p_empresa,p_cenario,p_versao,p_linha,p_tipo,p_lancamento); $$;
revoke all on function private.vincular_execucao_plano(uuid,uuid,integer,uuid,text,uuid),public.vincular_execucao_plano(uuid,uuid,integer,uuid,text,uuid) from public,anon;
grant execute on function private.vincular_execucao_plano(uuid,uuid,integer,uuid,text,uuid),public.vincular_execucao_plano(uuid,uuid,integer,uuid,text,uuid) to authenticated;

create or replace function public.grade_planejamento(p_cenario uuid)
returns table(tipo text,categoria_id uuid,centro_custo_id uuid,mes date,base text,plano text,realizado text,fixos text)
language sql stable security invoker set search_path='' as $$
 with c as (select * from public.cenarios_planejamento where id=p_cenario), fontes as (
 select 'despesa'::text tipo,l.categoria_id,l.centro_custo_id,date_trunc('month',l.vencimento)::date mes,case when exists(select 1 from public.execucoes_plano v where v.cenario_id=c.id and v.pagar_id=l.id) then 0::numeric else l.valor_centavos::numeric end base,0::numeric plano,0::numeric realizado,case when l.custo_fixo then l.valor_centavos else 0 end::numeric fixos
 from public.lancamentos_pagar l join c on c.empresa_id=l.empresa_id where l.status<>'cancelado' and extract(year from l.vencimento)=c.ano
 union all select 'receita',l.categoria_id,l.centro_custo_id,date_trunc('month',l.vencimento)::date,case when exists(select 1 from public.execucoes_plano v where v.cenario_id=c.id and v.receber_id=l.id) then 0::numeric else l.valor_centavos::numeric end,0,0,0 from public.lancamentos_receber l join c on c.empresa_id=l.empresa_id where l.status<>'cancelado' and extract(year from l.vencimento)=c.ano
 union all select l.tipo,l.categoria_id,l.centro_custo_id,l.mes,0,l.valor_centavos::numeric,0,0 from public.plano_linhas l join c on c.id=l.cenario_id and c.empresa_id=l.empresa_id
 union all select 'despesa',coalesce(p.categoria_id,l.categoria_id),case when p.id is null then l.centro_custo_id else p.centro_custo_id end,date_trunc('month',l.pago_em)::date,0,0,l.valor_pago_centavos::numeric,0 from public.lancamentos_pagar l join c on c.empresa_id=l.empresa_id left join public.execucoes_plano v on v.empresa_id=c.empresa_id and v.cenario_id=c.id and v.pagar_id=l.id left join public.plano_linhas p on p.id=v.linha_id and p.empresa_id=c.empresa_id where l.status='pago' and extract(year from l.pago_em)=c.ano
 union all select 'receita',coalesce(p.categoria_id,l.categoria_id),case when p.id is null then l.centro_custo_id else p.centro_custo_id end,date_trunc('month',l.recebido_em)::date,0,0,l.valor_recebido_centavos::numeric,0 from public.lancamentos_receber l join c on c.empresa_id=l.empresa_id left join public.execucoes_plano v on v.empresa_id=c.empresa_id and v.cenario_id=c.id and v.receber_id=l.id left join public.plano_linhas p on p.id=v.linha_id and p.empresa_id=c.empresa_id where l.status='recebido' and extract(year from l.recebido_em)=c.ano
 ), fechados as (select f.* from public.fechamentos_planejamento f join c on c.id=f.cenario_id and c.empresa_id=f.empresa_id where f.reaberto_em is null), grade as (
 select s.tipo,s.categoria_id,s.centro_custo_id,s.mes,sum(s.base) base,sum(s.plano) plano,sum(s.realizado) realizado,sum(s.fixos) fixos from fontes s where not exists(select 1 from fechados f where f.mes=s.mes) group by s.tipo,s.categoria_id,s.centro_custo_id,s.mes
 union all select g.tipo,g.categoria_id,g.centro_custo_id,g.mes,g.base,g.plano,g.realizado,g.fixos from fechados f cross join lateral jsonb_to_recordset(f.snapshot->'grade') g(tipo text,categoria_id uuid,centro_custo_id uuid,mes date,base numeric,plano numeric,realizado numeric,fixos numeric)
 ) select tipo,categoria_id,centro_custo_id,mes,base::text,plano::text,realizado::text,fixos::text from grade;
$$;

create or replace function public.resumo_planejamento(p_empresa uuid,p_cenario uuid,p_pagina integer default 1) returns jsonb
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
 ), totais_grade as (
  select m.mes,coalesce(sum(g.plano::numeric) filter(where g.tipo='receita'),0) receitas,coalesce(sum(g.plano::numeric) filter(where g.tipo='despesa'),0) despesas,coalesce(sum(g.fixos::numeric),0) fixos from meses m left join grade g on g.mes=m.mes group by m.mes
 ), totais as (
 select t.mes,t.fixos,
 case when f.id is not null then coalesce((f.snapshot->'adicionais'->>'receitas')::numeric,t.receitas) else coalesce(a.receitas::numeric,0) end receitas,
 case when f.id is not null then coalesce((f.snapshot->'adicionais'->>'despesas')::numeric,t.despesas) else coalesce(a.despesas::numeric,0) end despesas
 from totais_grade t left join public.adicionais_planejamento(c.id) a on a.mes=t.mes left join public.fechamentos_planejamento f on f.empresa_id=p_empresa and f.cenario_id=c.id and f.mes=t.mes and f.reaberto_em is null
 ) select jsonb_build_object('cenario',jsonb_build_object('id',c.id,'nome',c.nome,'ano',c.ano,'versao',c.versao,'arquivado',c.arquivado),'total',p.total,'pagina',p.pagina,
  'grade',coalesce((select jsonb_agg(jsonb_build_object('tipo',p.tipo,'categoria_id',p.categoria_id,'centro_custo_id',p.centro_custo_id,'categoria',p.categoria,'centro',p.centro,'meses',(select jsonb_agg(to_jsonb(g) order by g.mes) from grade g where g.tipo=p.tipo and g.categoria_id=p.categoria_id and g.centro_custo_id is not distinct from p.centro_custo_id)) order by p.tipo,p.centro,p.categoria,p.categoria_id,p.centro_custo_id) from pagina p),'[]'::jsonb),
  'meses',(select jsonb_agg(jsonb_build_object('mes',t.mes,'receitas',t.receitas::text,'despesas',t.despesas::text,'fixos',t.fixos::text,'caixa',coalesce((f.snapshot->>'caixa')::numeric,x.saldo_projetado)::text,'fechado',f.id is not null) order by t.mes) from totais t join caixa x on x.mes=t.mes left join public.fechamentos_planejamento f on f.empresa_id=p_empresa and f.cenario_id=c.id and f.mes=t.mes and f.reaberto_em is null)) into resultado from paginacao p;
 return resultado;
end; $$;

create or replace function private.operar_planejamento(p_empresa uuid,p_cenario uuid,p_versao integer,p_acao text,p_dados jsonb) returns jsonb
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
   insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade,copiada_de)
    select p_empresa,novo,categoria_id,centro_custo_id,tipo,make_date(ano,extract(month from mes)::integer,1),descricao,valor_unitario_centavos,quantidade,id from public.plano_linhas where cenario_id=c.id and empresa_id=p_empresa;
   if ano=c.ano then insert into public.execucoes_plano(empresa_id,cenario_id,linha_id,pagar_id,receber_id,autor_id) select p_empresa,novo,l.id,v.pagar_id,v.receber_id,auth.uid() from public.plano_linhas l join public.execucoes_plano v on v.linha_id=l.copiada_de and v.cenario_id=c.id where l.cenario_id=novo and l.empresa_id=p_empresa; end if;
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
