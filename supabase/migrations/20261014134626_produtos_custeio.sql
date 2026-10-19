-- Custeio analítico: não altera títulos, baixas, conciliações ou saldos.
create table public.config_custeio (
 empresa_id uuid primary key references public.empresas(id) on delete cascade,
 versao integer not null default 0 check(versao>=0)
);
create table public.produtos (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check(char_length(btrim(nome)) between 2 and 120), ativo boolean not null default true,
 custo_unitario_centavos bigint not null default 0 check(custo_unitario_centavos between 0 and 1000000000000),
 custo_projeto_centavos bigint not null default 0 check(custo_projeto_centavos between 0 and 1000000000000),
 preco_centavos bigint not null default 0 check(preco_centavos between 0 and 1000000000000),
 volume integer not null default 1 check(volume between 1 and 1000000),
 margem_bps integer not null default 0 check(margem_bps between 0 and 9999),
 criado_em timestamptz not null default now(), unique(empresa_id,id),
 check(custo_unitario_centavos::numeric*volume+custo_projeto_centavos<=1000000000000),
 check(preco_centavos::numeric*volume<=1000000000000)
);
create unique index produtos_nome_idx on public.produtos(empresa_id,lower(nome));
create table public.regras_rateio (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check(char_length(btrim(nome)) between 2 and 120), ativo boolean not null default true,
 categoria_id uuid, fornecedor_id uuid, unique(empresa_id,id),
 check(num_nonnulls(categoria_id,fornecedor_id)=1),
 foreign key(empresa_id,categoria_id) references public.categorias(empresa_id,id),
 foreign key(empresa_id,fornecedor_id) references public.fornecedores(empresa_id,id)
);
create unique index regras_rateio_nome_idx on public.regras_rateio(empresa_id,lower(nome));
create unique index regras_rateio_categoria_idx on public.regras_rateio(empresa_id,categoria_id) where ativo and categoria_id is not null;
create unique index regras_rateio_fornecedor_idx on public.regras_rateio(empresa_id,fornecedor_id) where ativo and fornecedor_id is not null;
create index regras_rateio_categoria_fk_idx on public.regras_rateio(empresa_id,categoria_id);
create index regras_rateio_fornecedor_fk_idx on public.regras_rateio(empresa_id,fornecedor_id);
create table public.itens_rateio (
 empresa_id uuid not null references public.empresas(id) on delete cascade, regra_id uuid not null, produto_id uuid not null,
 peso_bps integer not null check(peso_bps between 1 and 10000), primary key(regra_id,produto_id),
 foreign key(empresa_id,regra_id) references public.regras_rateio(empresa_id,id) on delete cascade,
 foreign key(empresa_id,produto_id) references public.produtos(empresa_id,id)
);
create index itens_rateio_regra_fk_idx on public.itens_rateio(empresa_id,regra_id);
create index itens_rateio_produto_idx on public.itens_rateio(empresa_id,produto_id);
create table public.classificacoes_custos (
 empresa_id uuid not null references public.empresas(id) on delete cascade, lancamento_id uuid primary key,
 tipo text not null check(tipo in('direto','compartilhado','geral')), produto_id uuid, regra_id uuid,
 check((tipo='direto' and produto_id is not null and regra_id is null) or
 (tipo='compartilhado' and produto_id is null and regra_id is not null) or
 (tipo='geral' and produto_id is null and regra_id is null)),
 foreign key(empresa_id,lancamento_id) references public.lancamentos_pagar(empresa_id,id) on delete cascade,
 foreign key(empresa_id,produto_id) references public.produtos(empresa_id,id),
 foreign key(empresa_id,regra_id) references public.regras_rateio(empresa_id,id)
);
create index classificacoes_custos_lancamento_idx on public.classificacoes_custos(empresa_id,lancamento_id);
create index classificacoes_custos_produto_idx on public.classificacoes_custos(empresa_id,produto_id);
create index classificacoes_custos_regra_idx on public.classificacoes_custos(empresa_id,regra_id);
create table public.receitas_produtos (
 empresa_id uuid not null references public.empresas(id) on delete cascade, lancamento_id uuid primary key, produto_id uuid not null,
 foreign key(empresa_id,lancamento_id) references public.lancamentos_receber(empresa_id,id) on delete cascade,
 foreign key(empresa_id,produto_id) references public.produtos(empresa_id,id)
);
create index receitas_produtos_lancamento_idx on public.receitas_produtos(empresa_id,lancamento_id);
create index receitas_produtos_produto_idx on public.receitas_produtos(empresa_id,produto_id);
create table public.custos_avulsos (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 produto_id uuid not null, descricao text not null check(char_length(btrim(descricao)) between 2 and 160),
 dia date not null check(dia between date '2000-01-01' and date '2100-12-31'),
 valor_centavos bigint not null check(valor_centavos between 1 and 1000000000000), ativo boolean not null default true,
 foreign key(empresa_id,produto_id) references public.produtos(empresa_id,id)
);
create index custos_avulsos_produto_idx on public.custos_avulsos(empresa_id,produto_id);
create index custos_avulsos_periodo_idx on public.custos_avulsos(empresa_id,dia,id);
create table public.historico_produtos (
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null references public.empresas(id) on delete cascade,
 autor_id uuid not null references auth.users(id), evento text not null, dados jsonb not null,
 request_id uuid not null, request_hash text not null, resultado_id uuid,
 criado_em timestamptz not null default now(), unique(empresa_id,request_id)
);
create index historico_produtos_autor_idx on public.historico_produtos(autor_id);
create index historico_produtos_empresa_idx on public.historico_produtos(empresa_id,criado_em desc,id);
do $$ declare t text; begin
 foreach t in array array['config_custeio','produtos','regras_rateio','itens_rateio','classificacoes_custos','receitas_produtos','custos_avulsos','historico_produtos'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy membro_consulta on public.%I for select to authenticated using (empresa_id in (select empresa_id from public.usuarios_empresas where usuario_id=(select auth.uid())))',t);
 end loop;
end $$;

-- Classificação explícita > regra automática por fornecedor > categoria > geral.
-- As regras consultam ocorrências atuais, inclusive parcelas/recorrências já geradas.
create function public.fontes_custos_produtos(p_empresa uuid,p_inicio date,p_fim date,p_base text)
returns table(id uuid,descricao text,dia date,valor numeric,tipo text,produto_id uuid,regra_id uuid,origem text)
language sql stable security invoker set search_path='' as $$
 select l.id,l.descricao,case when p_base='realizado' then l.pago_em else l.vencimento end,
 case when p_base='realizado' then l.valor_pago_centavos else l.valor_centavos end::numeric,
 coalesce(c.tipo,case when r.id is not null then 'compartilhado' else 'geral' end),c.produto_id,coalesce(c.regra_id,r.id),
 case when c.lancamento_id is not null then 'explícita' when r.fornecedor_id is not null then 'fornecedor' when r.id is not null then 'categoria' else 'padrão geral' end
 from public.lancamentos_pagar l
 left join public.classificacoes_custos c on c.empresa_id=l.empresa_id and c.lancamento_id=l.id
 left join lateral(select rr.id,rr.fornecedor_id from public.regras_rateio rr where rr.empresa_id=l.empresa_id and rr.ativo
  and c.lancamento_id is null and (rr.fornecedor_id=l.fornecedor_id or rr.categoria_id=l.categoria_id)
  order by (rr.fornecedor_id is not null) desc,rr.id limit 1) r on true
 where l.empresa_id=p_empresa and l.status<>'cancelado' and p_base in('registrado','realizado')
 and (p_base='registrado' or l.status='pago')
 and (case when p_base='realizado' then l.pago_em else l.vencimento end) between p_inicio and p_fim
 and p_inicio>=date '2000-01-01' and p_fim<=date '2100-12-31' and p_fim-p_inicio between 0 and 365;
$$;
create function public.movimentos_produtos(p_empresa uuid,p_inicio date,p_fim date,p_base text)
returns table(id uuid,fonte text,descricao text,dia date,produto_id uuid,tipo text,valor numeric)
language sql stable security invoker set search_path='' as $$
 with custos as materialized(select * from public.fontes_custos_produtos(p_empresa,p_inicio,p_fim,p_base)),
 rateados as (
  select c.id,c.descricao,c.dia,i.produto_id,c.valor,
   div(c.valor*i.peso_bps,10000) inteiro,
   sum(div(c.valor*i.peso_bps,10000)) over(partition by c.id) soma,
   row_number() over(partition by c.id order by mod(c.valor*i.peso_bps,10000) desc,i.produto_id) ordem
  from custos c join public.itens_rateio i on i.empresa_id=p_empresa and i.regra_id=c.regra_id where c.tipo='compartilhado'
 )
 select c.id,'pagar',c.descricao,c.dia,c.produto_id,c.tipo,c.valor from custos c where c.tipo<>'compartilhado'
 union all select r.id,'pagar',r.descricao,r.dia,r.produto_id,'compartilhado',r.inteiro+case when r.ordem<=r.valor-r.soma then 1 else 0 end from rateados r
 union all select l.id,'receber',l.descricao,case when p_base='realizado' then l.recebido_em else l.vencimento end,r.produto_id,'receita',
  case when p_base='realizado' then l.valor_recebido_centavos else l.valor_centavos end::numeric
 from public.lancamentos_receber l left join public.receitas_produtos r on r.empresa_id=l.empresa_id and r.lancamento_id=l.id
 where l.empresa_id=p_empresa and l.status<>'cancelado' and p_base in('registrado','realizado') and (p_base='registrado' or l.status='recebido')
 and (case when p_base='realizado' then l.recebido_em else l.vencimento end) between p_inicio and p_fim
 and p_inicio>=date '2000-01-01' and p_fim<=date '2100-12-31' and p_fim-p_inicio between 0 and 365
 union all select a.id,'avulso',a.descricao,a.dia,a.produto_id,'direto',a.valor_centavos::numeric from public.custos_avulsos a
 where a.empresa_id=p_empresa and a.ativo and a.dia between p_inicio and p_fim and p_base in('registrado','realizado')
 and p_inicio>=date '2000-01-01' and p_fim<=date '2100-12-31' and p_fim-p_inicio between 0 and 365;
$$;
create function public.resumo_produtos(p_empresa uuid,p_inicio date,p_fim date,p_base text,p_gerais boolean default false,p_pagina integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
 with mov as materialized(select * from public.movimentos_produtos(p_empresa,p_inicio,p_fim,p_base)),
 totais as(select coalesce(sum(valor) filter(where tipo='receita'),0) receita,coalesce(sum(valor) filter(where tipo='geral'),0) geral,
  coalesce(sum(valor) filter(where tipo='receita' and produto_id is null),0) sem_produto from mov),
 receitas as(select produto_id,sum(valor) valor from mov where tipo='receita' group by produto_id),
 geral as(select r.produto_id,div(t.geral*r.valor,nullif(t.receita,0)) inteiro,t.geral,
  sum(div(t.geral*r.valor,nullif(t.receita,0))) over() soma,
  row_number() over(order by mod(t.geral*r.valor,nullif(t.receita,0)) desc,r.produto_id nulls last) ordem
  from receitas r cross join totais t where p_gerais and t.receita>0),
 alocados as(select produto_id,inteiro+case when ordem<=geral-soma then 1 else 0 end valor from geral),
 produtos as(select p.id,p.nome,p.ativo,coalesce(sum(m.valor) filter(where m.tipo='receita'),0) receita,
  coalesce(sum(m.valor) filter(where m.tipo='direto'),0) direto,coalesce(sum(m.valor) filter(where m.tipo='compartilhado'),0) compartilhado,
  coalesce((select a.valor from alocados a where a.produto_id=p.id),0) geral
  from public.produtos p left join mov m on m.produto_id=p.id where p.empresa_id=p_empresa group by p.id),
 pagina as(select * from produtos order by lower(nome),id limit 50 offset (greatest(1,least(coalesce(p_pagina,1),1000000))-1)*50)
 select case when exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=(select auth.uid()))
  and p_base in('registrado','realizado') and p_inicio>=date '2000-01-01' and p_fim<=date '2100-12-31' and p_fim-p_inicio between 0 and 365 then
 jsonb_build_object('total',(select count(*) from produtos),'receita',t.receita::text,'gerais',t.geral::text,'receita_sem_produto',t.sem_produto::text,
 'gerais_alocados',coalesce((select sum(valor) from alocados where produto_id is not null),0)::text,
 'gerais_nao_alocados',(t.geral-coalesce((select sum(valor) from alocados where produto_id is not null),0))::text,
 'produtos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'ativo',ativo,'receita',receita::text,'direto',direto::text,
 'compartilhado',compartilhado::text,'margem',(receita-direto-compartilhado)::text,'geral',geral::text,'resultado',(receita-direto-compartilhado-geral)::text)
 order by lower(nome),id) from pagina),'[]'::jsonb)) else null end from totais t;
$$;

create function private.operar_produtos(p_empresa uuid,p_versao integer,p_acao text,p_dados jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v integer; hist public.historico_produtos; ident uuid; item jsonb; rule public.regras_rateio;
 produto public.produtos; c public.cenarios_planejamento; mes date; oldmonth date; hash text;
begin
 if auth.uid() is null or not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=auth.uid() and papel in('proprietario','administrador','operador','contador_completo')) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_request is null or p_dados is null or jsonb_typeof(p_dados)<>'object' then return jsonb_build_object('codigo','dados_invalidos'); end if;
 insert into public.config_custeio(empresa_id) values(p_empresa) on conflict do nothing;
 select versao into v from public.config_custeio where empresa_id=p_empresa for update;
 if not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=auth.uid() and papel in('proprietario','administrador','operador','contador_completo')) then return jsonb_build_object('codigo','sem_acesso'); end if;
 hash:=md5(p_acao||p_dados::text);
 select * into hist from public.historico_produtos where empresa_id=p_empresa and request_id=p_request;
 if found then
  if hist.request_hash<>hash then return jsonb_build_object('codigo','pedido_conflitante'); end if;
  return jsonb_build_object('codigo','ok','id',hist.resultado_id,'reenvio',true);
 end if;
 if p_versao is null or p_versao<>v then return jsonb_build_object('codigo','desatualizado'); end if;
 ident:=nullif(p_dados->>'id','')::uuid;
 if p_acao='produto' then
  if ident is null then
   insert into public.produtos(empresa_id,nome,custo_unitario_centavos,custo_projeto_centavos,preco_centavos,volume,margem_bps)
   values(p_empresa,btrim(p_dados->>'nome'),(p_dados->>'custo_unitario_centavos')::bigint,(p_dados->>'custo_projeto_centavos')::bigint,(p_dados->>'preco_centavos')::bigint,(p_dados->>'volume')::integer,(p_dados->>'margem_bps')::integer) returning id into ident;
  else
   update public.produtos set nome=btrim(p_dados->>'nome'),custo_unitario_centavos=(p_dados->>'custo_unitario_centavos')::bigint,
    custo_projeto_centavos=(p_dados->>'custo_projeto_centavos')::bigint,preco_centavos=(p_dados->>'preco_centavos')::bigint,volume=(p_dados->>'volume')::integer,margem_bps=(p_dados->>'margem_bps')::integer
    where empresa_id=p_empresa and id=ident;
   if not found then return jsonb_build_object('codigo','indisponivel'); end if;
  end if;
 elsif p_acao='status_produto' then
  update public.produtos set ativo=(p_dados->>'ativo')::boolean where empresa_id=p_empresa and id=ident;
  if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 elsif p_acao='regra' then
  if jsonb_typeof(p_dados->'itens') is distinct from 'array' or jsonb_array_length(p_dados->'itens') not between 1 and 200 then return jsonb_build_object('codigo','rateio_invalido'); end if;
  if (select sum((x->>'peso_bps')::integer)<>10000 or count(*)<>count(distinct x->>'produto_id') or bool_or(coalesce((x->>'peso_bps')::integer,0) not between 1 and 10000) from jsonb_array_elements(p_dados->'itens') x)
   or exists(select 1 from jsonb_array_elements(p_dados->'itens') x where not exists(select 1 from public.produtos p where p.empresa_id=p_empresa and p.id=(x->>'produto_id')::uuid and p.ativo)) then return jsonb_build_object('codigo','rateio_invalido'); end if;
  if num_nonnulls(nullif(p_dados->>'categoria_id',''),nullif(p_dados->>'fornecedor_id',''))<>1 then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if nullif(p_dados->>'categoria_id','') is not null and not exists(select 1 from public.categorias where empresa_id=p_empresa and id=(p_dados->>'categoria_id')::uuid and tipo='despesa' and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if nullif(p_dados->>'fornecedor_id','') is not null and not exists(select 1 from public.fornecedores where empresa_id=p_empresa and id=(p_dados->>'fornecedor_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if ident is null then
   insert into public.regras_rateio(empresa_id,nome,categoria_id,fornecedor_id) values(p_empresa,btrim(p_dados->>'nome'),nullif(p_dados->>'categoria_id','')::uuid,nullif(p_dados->>'fornecedor_id','')::uuid) returning id into ident;
  else
   update public.regras_rateio set nome=btrim(p_dados->>'nome'),categoria_id=nullif(p_dados->>'categoria_id','')::uuid,fornecedor_id=nullif(p_dados->>'fornecedor_id','')::uuid where empresa_id=p_empresa and id=ident;
   if not found then return jsonb_build_object('codigo','indisponivel'); end if;
   delete from public.itens_rateio where empresa_id=p_empresa and regra_id=ident;
  end if;
  for item in select value from jsonb_array_elements(p_dados->'itens') loop
   insert into public.itens_rateio(empresa_id,regra_id,produto_id,peso_bps) values(p_empresa,ident,(item->>'produto_id')::uuid,(item->>'peso_bps')::integer);
  end loop;
 elsif p_acao='status_regra' then
  update public.regras_rateio set ativo=(p_dados->>'ativo')::boolean where empresa_id=p_empresa and id=ident;
  if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 elsif p_acao='classificar' then
  if not exists(select 1 from public.lancamentos_pagar where empresa_id=p_empresa and id=ident and status<>'cancelado') then return jsonb_build_object('codigo','indisponivel'); end if;
  if p_dados->>'tipo'='direto' and not exists(select 1 from public.produtos where empresa_id=p_empresa and id=(p_dados->>'produto_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if p_dados->>'tipo'='compartilhado' and not exists(select 1 from public.regras_rateio where empresa_id=p_empresa and id=(p_dados->>'regra_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if p_dados->>'tipo'='automatico' then delete from public.classificacoes_custos where empresa_id=p_empresa and lancamento_id=ident;
  else
   insert into public.classificacoes_custos(empresa_id,lancamento_id,tipo,produto_id,regra_id)
    values(p_empresa,ident,p_dados->>'tipo',case when p_dados->>'tipo'='direto' then (p_dados->>'produto_id')::uuid end,case when p_dados->>'tipo'='compartilhado' then (p_dados->>'regra_id')::uuid end)
    on conflict(lancamento_id) do update set tipo=excluded.tipo,produto_id=excluded.produto_id,regra_id=excluded.regra_id;
  end if;
 elsif p_acao='receita' then
  if not exists(select 1 from public.lancamentos_receber where empresa_id=p_empresa and id=ident and status<>'cancelado') then return jsonb_build_object('codigo','indisponivel'); end if;
  if nullif(p_dados->>'produto_id','') is null then delete from public.receitas_produtos where empresa_id=p_empresa and lancamento_id=ident;
  else
   if not exists(select 1 from public.produtos where empresa_id=p_empresa and id=(p_dados->>'produto_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
   insert into public.receitas_produtos(empresa_id,lancamento_id,produto_id) values(p_empresa,ident,(p_dados->>'produto_id')::uuid) on conflict(lancamento_id) do update set produto_id=excluded.produto_id;
  end if;
 elsif p_acao='avulso' then
  if not exists(select 1 from public.produtos where empresa_id=p_empresa and id=(p_dados->>'produto_id')::uuid and ativo) then return jsonb_build_object('codigo','referencia_invalida'); end if;
  if ident is null then
   insert into public.custos_avulsos(empresa_id,produto_id,descricao,dia,valor_centavos) values(p_empresa,(p_dados->>'produto_id')::uuid,btrim(p_dados->>'descricao'),(p_dados->>'dia')::date,(p_dados->>'valor_centavos')::bigint) returning id into ident;
  else
   update public.custos_avulsos set produto_id=(p_dados->>'produto_id')::uuid,descricao=btrim(p_dados->>'descricao'),dia=(p_dados->>'dia')::date,valor_centavos=(p_dados->>'valor_centavos')::bigint where empresa_id=p_empresa and id=ident;
   if not found then return jsonb_build_object('codigo','indisponivel'); end if;
  end if;
 elsif p_acao='status_avulso' then
  update public.custos_avulsos set ativo=(p_dados->>'ativo')::boolean where empresa_id=p_empresa and id=ident;
  if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 else return jsonb_build_object('codigo','acao_invalida'); end if;
 update public.config_custeio set versao=versao+1 where empresa_id=p_empresa;
 insert into public.historico_produtos(empresa_id,autor_id,evento,dados,request_id,request_hash,resultado_id) values(p_empresa,auth.uid(),p_acao,p_dados,p_request,hash,ident);
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'produtos',p_acao);
 return jsonb_build_object('codigo','ok','id',ident);
exception when invalid_text_representation or check_violation or not_null_violation or numeric_value_out_of_range or datetime_field_overflow then return jsonb_build_object('codigo','dados_invalidos');
 when unique_violation then return jsonb_build_object('codigo','ja_existe');
end $$;
create function public.operar_produtos(p_empresa uuid,p_versao integer,p_acao text,p_dados jsonb,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.operar_produtos(p_empresa,p_versao,p_acao,p_dados,p_request); $$;

-- A origem acompanha a cópia do cenário, permitindo atualizar a projeção sem duplicar.
alter table public.plano_linhas add column produto_id uuid,add column produto_parte text,
 add constraint plano_produto_fk foreign key(empresa_id,produto_id) references public.produtos(empresa_id,id),
 add constraint plano_produto_parte_check check((produto_id is null and produto_parte is null) or (produto_id is not null and produto_parte is not null and produto_parte in('receita','variavel','projeto')));
create unique index plano_produto_parte_idx on public.plano_linhas(cenario_id,produto_id,produto_parte) where produto_id is not null;
create index plano_produto_fk_idx on public.plano_linhas(empresa_id,produto_id);
create function private.copiar_origem_produto() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.copiada_de is not null and new.produto_id is null then
  select l.produto_id,l.produto_parte into new.produto_id,new.produto_parte from public.plano_linhas l where l.empresa_id=new.empresa_id and l.id=new.copiada_de;
 end if;
 return new;
end $$;
revoke all on function private.copiar_origem_produto() from public,anon,authenticated;
create trigger copiar_origem_produto before insert on public.plano_linhas for each row execute function private.copiar_origem_produto();

create function private.projetar_produto(p_empresa uuid,p_produto uuid,p_versao integer,p_cenario uuid,p_cenario_versao integer,p_mes date,p_receita uuid,p_despesa uuid,p_centro uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.cenarios_planejamento; p public.produtos; v integer; hist public.historico_produtos; dados jsonb; hash text;
begin
 if auth.uid() is null or not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=auth.uid() and papel in('proprietario','administrador','operador','contador_completo')) then return jsonb_build_object('codigo','sem_acesso'); end if;
 -- Ordem global: configuração de custeio -> cenário. Nenhuma operação inversa toma o primeiro lock.
 select versao into v from public.config_custeio where empresa_id=p_empresa for update;
 if not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=auth.uid() and papel in('proprietario','administrador','operador','contador_completo')) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_request is null then return jsonb_build_object('codigo','dados_invalidos'); end if;
 dados:=jsonb_build_object('produto',p_produto,'cenario',p_cenario,'mes',p_mes,'receita',p_receita,'despesa',p_despesa,'centro',p_centro);
 hash:=md5('projetar'||dados::text);
 select * into hist from public.historico_produtos where empresa_id=p_empresa and request_id=p_request;
 if found then
  if hist.request_hash<>hash then return jsonb_build_object('codigo','pedido_conflitante'); end if;
  return jsonb_build_object('codigo','ok','reenvio',true);
 end if;
 if p_versao is null or v is null or v<>p_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 select * into p from public.produtos where empresa_id=p_empresa and id=p_produto and ativo;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 select * into c from public.cenarios_planejamento where empresa_id=p_empresa and id=p_cenario for update;
 if not found or c.arquivado then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_cenario_versao is null or c.versao<>p_cenario_versao then return jsonb_build_object('codigo','desatualizado'); end if;
 if p_mes is null or extract(year from p_mes)<>c.ano or extract(day from p_mes)<>1 then return jsonb_build_object('codigo','dados_invalidos'); end if;
 if not exists(select 1 from public.categorias where empresa_id=p_empresa and id=p_receita and ativo and tipo='receita') or not exists(select 1 from public.categorias where empresa_id=p_empresa and id=p_despesa and ativo and tipo='despesa') or (p_centro is not null and not exists(select 1 from public.centros_custo where empresa_id=p_empresa and id=p_centro and ativo)) then return jsonb_build_object('codigo','referencia_invalida'); end if;
 if exists(select 1 from public.fechamentos_planejamento where cenario_id=c.id and reaberto_em is null and (mes=p_mes or mes in(select l.mes from public.plano_linhas l where l.cenario_id=c.id and l.produto_id=p.id))) then return jsonb_build_object('codigo','mes_fechado'); end if;
 if exists(select 1 from public.execucoes_plano e join public.plano_linhas l on l.id=e.linha_id where e.cenario_id=c.id and l.produto_id=p.id) then return jsonb_build_object('codigo','execucao_vinculada'); end if;
 delete from public.plano_linhas where empresa_id=p_empresa and cenario_id=c.id and produto_id=p.id;
 if p.preco_centavos>0 then insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade,produto_id,produto_parte) values(p_empresa,c.id,p_receita,p_centro,'receita',p_mes,left(p.nome||' · vendas',160),p.preco_centavos,p.volume,p.id,'receita'); end if;
 if p.custo_unitario_centavos>0 then insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade,produto_id,produto_parte) values(p_empresa,c.id,p_despesa,p_centro,'despesa',p_mes,left(p.nome||' · custo variável',160),p.custo_unitario_centavos,p.volume,p.id,'variavel'); end if;
 if p.custo_projeto_centavos>0 then insert into public.plano_linhas(empresa_id,cenario_id,categoria_id,centro_custo_id,tipo,mes,descricao,valor_unitario_centavos,quantidade,produto_id,produto_parte) values(p_empresa,c.id,p_despesa,p_centro,'despesa',p_mes,left(p.nome||' · custo do projeto',160),p.custo_projeto_centavos,1,p.id,'projeto'); end if;
 update public.cenarios_planejamento set versao=versao+1 where id=c.id;
 update public.config_custeio set versao=versao+1 where empresa_id=p_empresa;
 insert into public.historico_planejamento(empresa_id,cenario_id,autor_id,evento,dados) values(p_empresa,c.id,auth.uid(),'projetar_produto',dados||jsonb_build_object('preco_centavos',p.preco_centavos::text,'custo_unitario_centavos',p.custo_unitario_centavos::text,'custo_projeto_centavos',p.custo_projeto_centavos::text,'volume',p.volume));
 insert into public.historico_produtos(empresa_id,autor_id,evento,dados,request_id,request_hash,resultado_id) values(p_empresa,auth.uid(),'projetar',dados,p_request,hash,p.id);
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'produtos','projetar');
 return jsonb_build_object('codigo','ok');
end $$;
create function public.projetar_produto(p_empresa uuid,p_produto uuid,p_versao integer,p_cenario uuid,p_cenario_versao integer,p_mes date,p_receita uuid,p_despesa uuid,p_centro uuid,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.projetar_produto(p_empresa,p_produto,p_versao,p_cenario,p_cenario_versao,p_mes,p_receita,p_despesa,p_centro,p_request); $$;
revoke all on function public.fontes_custos_produtos(uuid,date,date,text),public.movimentos_produtos(uuid,date,date,text),public.resumo_produtos(uuid,date,date,text,boolean,integer),
 private.operar_produtos(uuid,integer,text,jsonb,uuid),public.operar_produtos(uuid,integer,text,jsonb,uuid),
 private.projetar_produto(uuid,uuid,integer,uuid,integer,date,uuid,uuid,uuid,uuid),public.projetar_produto(uuid,uuid,integer,uuid,integer,date,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.fontes_custos_produtos(uuid,date,date,text),public.movimentos_produtos(uuid,date,date,text),public.resumo_produtos(uuid,date,date,text,boolean,integer),
 private.operar_produtos(uuid,integer,text,jsonb,uuid),public.operar_produtos(uuid,integer,text,jsonb,uuid),
 private.projetar_produto(uuid,uuid,integer,uuid,integer,date,uuid,uuid,uuid,uuid),public.projetar_produto(uuid,uuid,integer,uuid,integer,date,uuid,uuid,uuid,uuid) to authenticated;
