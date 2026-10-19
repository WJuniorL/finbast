-- DRE gerencial: vencimento/original ou liquidação/efetivo. Sem inferir competência contábil.
create table public.classificacoes_dre (
 categoria_id uuid primary key, empresa_id uuid not null references public.empresas(id) on delete cascade,
 grupo text check(grupo in('receita','deducoes','custos','operacionais','financeiro','tributos')),
 versao integer not null default 1 check(versao>0),
 foreign key(empresa_id,categoria_id) references public.categorias(empresa_id,id)
);
create index classificacoes_dre_empresa_idx on public.classificacoes_dre(empresa_id,categoria_id);
create table public.historico_dre (
 id uuid primary key, empresa_id uuid not null references public.empresas(id) on delete cascade,
 categoria_id uuid not null, grupo text, autor_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 foreign key(empresa_id,categoria_id) references public.categorias(empresa_id,id)
);
create index historico_dre_categoria_idx on public.historico_dre(empresa_id,categoria_id);
create index historico_dre_autor_idx on public.historico_dre(autor_id);
create index historico_dre_data_idx on public.historico_dre(empresa_id,criado_em desc);
create table public.exportacoes_relatorios (
 id uuid primary key, empresa_id uuid not null references public.empresas(id) on delete cascade,
 autor_id uuid not null references auth.users(id), formato text not null check(formato in('csv','xlsx')),
 filtros jsonb not null check(jsonb_typeof(filtros)='object'), criado_em timestamptz not null default now()
);
create index exportacoes_relatorios_empresa_idx on public.exportacoes_relatorios(empresa_id,criado_em desc);
create index exportacoes_relatorios_autor_idx on public.exportacoes_relatorios(autor_id);
do $$ declare t text; begin
 foreach t in array array['classificacoes_dre','historico_dre','exportacoes_relatorios'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy membro_consulta on public.%I for select to authenticated using(empresa_id in(select empresa_id from public.usuarios_empresas where usuario_id=(select auth.uid())))',t);
 end loop;
end $$;

create function public.grupo_categoria_dre(p_empresa uuid,p_categoria uuid) returns text
language sql stable security invoker set search_path='' as $$
 with recursive pais as (
  select id,pai_id,tipo,0 nivel,array[id] caminho from public.categorias where empresa_id=p_empresa and id=p_categoria
  union all select c.id,c.pai_id,c.tipo,p.nivel+1,p.caminho||c.id from pais p join public.categorias c on c.id=p.pai_id and c.empresa_id=p_empresa where not c.id=any(p.caminho)
 ) select coalesce((select d.grupo from pais p join public.classificacoes_dre d on d.categoria_id=p.id and d.empresa_id=p_empresa where d.grupo is not null and ((p.tipo='receita' and d.grupo in('receita','financeiro')) or (p.tipo='despesa' and d.grupo<>'receita')) order by p.nivel limit 1),
 (select case when tipo='receita' then 'receita' else 'operacionais' end from pais where nivel=0));
$$;
create function private.configurar_dre(p_empresa uuid,p_categoria uuid,p_versao integer,p_grupo text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tipo text; atual public.classificacoes_dre; historico public.historico_dre;
begin
 if auth.uid() is null or not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_request is null then return jsonb_build_object('codigo','dados_invalidos'); end if;
 select c.tipo into tipo from public.categorias c where c.empresa_id=p_empresa and c.id=p_categoria;
 if not found then return jsonb_build_object('codigo','indisponivel'); end if;
 if p_grupo is not null and ((tipo='receita' and p_grupo not in('receita','financeiro')) or (tipo='despesa' and p_grupo not in('deducoes','custos','operacionais','financeiro','tributos'))) then return jsonb_build_object('codigo','grupo_invalido'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_empresa::text||':'||p_categoria::text,1));
 if not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 select * into historico from public.historico_dre where id=p_request;
 if found then
  if historico.empresa_id=p_empresa and historico.categoria_id=p_categoria and historico.grupo is not distinct from p_grupo and historico.autor_id=auth.uid() then return jsonb_build_object('codigo','ok','reenvio',true); end if;
  return jsonb_build_object('codigo','pedido_conflitante');
 end if;
 select * into atual from public.classificacoes_dre where empresa_id=p_empresa and categoria_id=p_categoria for update;
 if p_versao is null or p_versao<>coalesce(atual.versao,0) then return jsonb_build_object('codigo','desatualizado'); end if;
 insert into public.classificacoes_dre(empresa_id,categoria_id,grupo) values(p_empresa,p_categoria,p_grupo)
 on conflict(categoria_id) do update set grupo=excluded.grupo,versao=public.classificacoes_dre.versao+1;
 insert into public.historico_dre(id,empresa_id,categoria_id,grupo,autor_id) values(p_request,p_empresa,p_categoria,p_grupo,auth.uid());
 insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'relatorios','classificar_dre');
 return jsonb_build_object('codigo','ok');
exception when unique_violation then return jsonb_build_object('codigo','pedido_conflitante');
end $$;
create function public.configurar_dre(p_empresa uuid,p_categoria uuid,p_versao integer,p_grupo text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.configurar_dre(p_empresa,p_categoria,p_versao,p_grupo,p_request); $$;

-- A origem do rateio é o mesmo valor líquido já usado em Produtos. Os encargos são
-- repartidos sobre essas parcelas, e o principal absorve os resíduos: ambos os totais fecham.
create function public.itens_relatorio(p_empresa uuid,p_inicio date,p_fim date,p_base text)
returns table(id uuid,fonte text,produto_id uuid,natureza text,componente text,grupo text,categoria_id uuid,centro_custo_id uuid,fornecedor_id uuid,cliente_id uuid,
 descricao text,dia date,valor numeric,tipo_custo text,categoria text,centro text,fornecedor text,produto text,documento text,status text,
 principal_origem text,juros_origem text,multa_origem text,desconto_origem text,total_origem text)
language sql stable security invoker set search_path='' as $$
 with mov as materialized(select * from public.movimentos_produtos(p_empresa,p_inicio,p_fim,p_base)), bases as materialized(
  select m.id,m.fonte,m.produto_id,case when m.tipo='receita' then 'receita' else 'despesa' end natureza,
   m.descricao,m.dia,m.valor alocado,m.tipo tipo_custo,coalesce(p.categoria_id,r.categoria_id) categoria_id,
   coalesce(p.centro_custo_id,r.centro_custo_id) centro_custo_id,p.fornecedor_id,r.cliente_id,coalesce(p.documento,r.documento) documento,coalesce(p.status,r.status,'analitico') status,
   coalesce(p.valor_centavos,r.valor_centavos,m.valor) principal,
   case when p_base='realizado' then coalesce(p.juros_centavos,r.juros_centavos,0) else 0 end::numeric juros,
   case when p_base='realizado' then coalesce(p.multa_centavos,r.multa_centavos,0) else 0 end::numeric multa,
   case when p_base='realizado' then coalesce(p.desconto_centavos,r.desconto_centavos,0) else 0 end::numeric desconto,
   (case when p_base='realizado' then coalesce(p.valor_pago_centavos,r.valor_recebido_centavos,m.valor) else coalesce(p.valor_centavos,r.valor_centavos,m.valor) end)::numeric total
  from mov m left join public.lancamentos_pagar p on m.fonte='pagar' and p.empresa_id=p_empresa and p.id=m.id
   left join public.lancamentos_receber r on m.fonte='receber' and r.empresa_id=p_empresa and r.id=m.id
 ), descontos_base as (
  select b.*,div(b.desconto*b.alocado,b.total) inteiro,
   sum(div(b.desconto*b.alocado,b.total)) over(partition by b.id,b.fonte) soma,
   row_number() over(partition by b.id,b.fonte order by mod(b.desconto*b.alocado,b.total) desc,b.produto_id nulls last) ordem from bases b
 ), descontos as (
  select d.*,inteiro+case when ordem<=desconto-soma then 1 else 0 end dc from descontos_base d
 ), juros_base as (
  select d.*,div(juros*(alocado+dc),total+desconto) ji,
   sum(div(juros*(alocado+dc),total+desconto)) over(partition by id,fonte) js,
   row_number() over(partition by id,fonte order by mod(juros*(alocado+dc),total+desconto) desc,produto_id nulls last) jo from descontos d
 ), juros as (
  select j.*,ji+case when jo<=j.juros-js then 1 else 0 end jc from juros_base j
 ), multas_base as (
  select j.*,div(multa*(alocado+dc-jc),total+desconto-j.juros) mi,
   sum(div(multa*(alocado+dc-jc),total+desconto-j.juros)) over(partition by id,fonte) ms,
   row_number() over(partition by id,fonte order by mod(multa*(alocado+dc-jc),total+desconto-j.juros) desc,produto_id nulls last) mo from juros j
 ), calculados as (
  select m.*,mi+case when mo<=multa-ms then 1 else 0 end mc from multas_base m
 ), componentes as (
  select b.id,b.fonte,b.produto_id,c.componente,c.valor from calculados b
  cross join lateral(values('principal',b.alocado+b.dc-b.jc-b.mc),('juros',b.jc),('multa',b.mc),('desconto',-b.dc)) c(componente,valor)
 ) select b.id,b.fonte,b.produto_id,b.natureza,c.componente,
  case when c.componente<>'principal' then 'financeiro' when b.fonte='avulso' then 'custos' else public.grupo_categoria_dre(p_empresa,b.categoria_id) end,
  b.categoria_id,b.centro_custo_id,b.fornecedor_id,b.cliente_id,b.descricao,b.dia,
  case when b.natureza='despesa' then -c.valor else c.valor end,b.tipo_custo,coalesce(cat.nome,'Custo avulso'),coalesce(cc.nome,'Sem centro'),coalesce(f.nome,'Sem fornecedor'),coalesce(prod.nome,'Sem produto'),b.documento,b.status,
  b.principal::text,b.juros::text,b.multa::text,b.desconto::text,b.total::text
 from bases b join componentes c on c.id=b.id and c.fonte=b.fonte and c.produto_id is not distinct from b.produto_id
 left join public.categorias cat on cat.empresa_id=p_empresa and cat.id=b.categoria_id
 left join public.centros_custo cc on cc.empresa_id=p_empresa and cc.id=b.centro_custo_id
 left join public.fornecedores f on f.empresa_id=p_empresa and f.id=b.fornecedor_id
 left join public.produtos prod on prod.empresa_id=p_empresa and prod.id=b.produto_id where c.valor<>0;
$$;

create function public.gerar_relatorio(p_empresa uuid,p_filtros jsonb,p_pagina integer default 1,p_origens integer default 1,p_exportar boolean default false,p_bruto boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare inicio date; fim date; f_base text; vista text; cat uuid; f_centro text; f_produto text; f_fornecedor text; f_grupo text; f_componente text; cenario uuid; sub boolean; v_resultado jsonb;
begin
 if not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=(select auth.uid())) then return null; end if;
 if p_filtros is null or jsonb_typeof(p_filtros)<>'object' then return null; end if;
 inicio:=(p_filtros->>'inicio')::date;fim:=(p_filtros->>'fim')::date;f_base:=p_filtros->>'base';vista:=p_filtros->>'vista';cat:=nullif(p_filtros->>'categoria','')::uuid;
 f_centro:=nullif(p_filtros->>'centro','');f_produto:=nullif(p_filtros->>'produto','');f_fornecedor:=nullif(p_filtros->>'fornecedor','');f_grupo:=nullif(p_filtros->>'grupo','');f_componente:=nullif(p_filtros->>'componente','');cenario:=nullif(p_filtros->>'cenario','')::uuid;sub:=coalesce((p_filtros->>'subcategorias')::boolean,true);
 if inicio is null or fim is null or inicio<date '2000-01-01' or fim>date '2100-12-31' or fim-inicio not between 0 and 365 or f_base is null or f_base not in('registrado','realizado') or vista is null or vista not in('dre','categoria','centro','fornecedor','produto','encargos','comparativo') or p_pagina is null or p_pagina not between 1 and 1000000 or p_origens is null or p_origens not between 1 and 1000000 then return null; end if;
 if cat is not null and not exists(select 1 from public.categorias where empresa_id=p_empresa and id=cat) then return null; end if;
 if f_centro is not null and f_centro<>'sem' and not exists(select 1 from public.centros_custo where empresa_id=p_empresa and id=f_centro::uuid) then return null; end if;
 if f_produto is not null and f_produto<>'sem' and not exists(select 1 from public.produtos where empresa_id=p_empresa and id=f_produto::uuid) then return null; end if;
 if f_fornecedor is not null and f_fornecedor<>'sem' and not exists(select 1 from public.fornecedores where empresa_id=p_empresa and id=f_fornecedor::uuid) then return null; end if;
 if f_grupo is not null and f_grupo not in('receita','deducoes','custos','operacionais','financeiro','tributos') or f_componente is not null and f_componente not in('principal','juros','multa','desconto') then return null; end if;
 if vista='encargos' and f_base<>'realizado' then return null; end if;
 if vista='comparativo' then
  if cenario is null or f_produto is not null or f_fornecedor is not null or f_grupo is not null or f_componente is not null or p_bruto or inicio<>date_trunc('month',inicio)::date or fim<>(date_trunc('month',fim)+interval '1 month - 1 day')::date then return null; end if;
  if not exists(select 1 from public.cenarios_planejamento c where c.empresa_id=p_empresa and c.id=cenario and extract(year from inicio)=c.ano and extract(year from fim)=c.ano) then return null; end if;
  with recursive categorias as(select id from public.categorias where empresa_id=p_empresa and id=cat union select c.id from public.categorias c join categorias x on c.pai_id=x.id where c.empresa_id=p_empresa and sub), dados as materialized(
   select g.tipo,g.categoria_id,g.centro_custo_id,g.mes,g.base,g.plano,g.realizado,g.fixos,c.nome categoria,coalesce(cc.nome,'Sem centro') centro,
    exists(select 1 from public.fechamentos_planejamento f where f.cenario_id=cenario and f.mes=g.mes and f.reaberto_em is null) fechado
   from public.grade_planejamento(cenario) g join public.categorias c on c.empresa_id=p_empresa and c.id=g.categoria_id
   left join public.centros_custo cc on cc.empresa_id=p_empresa and cc.id=g.centro_custo_id
   where g.mes between inicio and fim and (cat is null or g.categoria_id in(select id from categorias))
   and (f_centro is null or f_centro='sem' and g.centro_custo_id is null or f_centro<>'sem' and g.centro_custo_id::text=f_centro)
  ), linhas as(select dados.*,((dados.base::numeric+dados.plano::numeric))::text planejado,(dados.realizado::numeric-dados.base::numeric-dados.plano::numeric)::text desvio from dados), pagina as(
   select * from linhas order by mes,tipo,categoria,categoria_id,centro_custo_id nulls first limit case when p_exportar then null else 50 end offset case when p_exportar then 0 else (p_pagina-1)*50 end
  ) select jsonb_build_object('vista',vista,'total_grupos',(select count(*) from linhas),'total_itens',0,'grupos',coalesce((select jsonb_agg(to_jsonb(p) order by mes,tipo,categoria,categoria_id,centro_custo_id nulls first) from pagina p),'[]'::jsonb),'itens','[]'::jsonb,'dre','[]'::jsonb) into v_resultado;
  return v_resultado;
 end if;
 with recursive categorias as(select id from public.categorias where empresa_id=p_empresa and id=cat union select c.id from public.categorias c join categorias x on c.pai_id=x.id where c.empresa_id=p_empresa and sub),
 itens as materialized(
  select i.* from public.itens_relatorio(p_empresa,inicio,fim,f_base) i
  where (vista='produto' or i.fonte<>'avulso') and (vista<>'fornecedor' or i.natureza='despesa') and (vista<>'encargos' or i.componente<>'principal')
   and (cat is null or i.categoria_id in(select id from categorias))
   and (f_centro is null or f_centro='sem' and i.centro_custo_id is null or f_centro<>'sem' and i.centro_custo_id::text=f_centro)
   and (f_produto is null or f_produto='sem' and i.produto_id is null or f_produto<>'sem' and i.produto_id::text=f_produto)
   and (f_fornecedor is null or i.natureza='despesa' and (f_fornecedor='sem' and i.fornecedor_id is null or f_fornecedor<>'sem' and i.fornecedor_id::text=f_fornecedor))
   and (f_grupo is null or i.grupo=f_grupo) and (f_componente is null or i.componente=f_componente)
 ), nomeados as(select i.*,
  case vista when 'centro' then coalesce(i.centro_custo_id::text,'sem') when 'fornecedor' then coalesce(i.fornecedor_id::text,'sem') when 'produto' then coalesce(i.produto_id::text,'sem') else coalesce(i.categoria_id::text,'sem') end chave,
  case vista when 'centro' then i.centro when 'fornecedor' then i.fornecedor when 'produto' then i.produto else i.categoria end nome from itens i
 ), grupos as(select chave,nome,
  coalesce(sum(valor) filter(where natureza='receita'),0) receita,-coalesce(sum(valor) filter(where natureza='despesa'),0) despesa,sum(valor) resultado,
  -coalesce(sum(valor) filter(where natureza='despesa' and tipo_custo='direto'),0) diretos,-coalesce(sum(valor) filter(where natureza='despesa' and tipo_custo='compartilhado'),0) compartilhados,-coalesce(sum(valor) filter(where natureza='despesa' and tipo_custo='geral'),0) gerais
  from nomeados group by chave,nome
 ), pagina_grupos as(select * from grupos order by lower(nome),chave limit case when p_exportar then null else 50 end offset case when p_exportar then 0 else (p_pagina-1)*50 end),
 somas as(select coalesce(sum(valor) filter(where grupo='receita'),0) receita,coalesce(sum(valor) filter(where grupo='deducoes'),0) deducoes,coalesce(sum(valor) filter(where grupo='custos'),0) custos,coalesce(sum(valor) filter(where grupo='operacionais'),0) operacionais,coalesce(sum(valor) filter(where grupo='financeiro'),0) financeiro,coalesce(sum(valor) filter(where grupo='tributos'),0) tributos from itens),
 dre as(select v.* from somas s cross join lateral(values
 (1,'receita','Receita bruta',s.receita),(2,'deducoes','Deduções da receita',s.deducoes),(3,'liquida','Receita líquida',s.receita+s.deducoes),
 (4,'custos','Custos',s.custos),(5,'bruto','Lucro bruto',s.receita+s.deducoes+s.custos),(6,'operacionais','Despesas operacionais',s.operacionais),
 (7,'operacional','Resultado operacional',s.receita+s.deducoes+s.custos+s.operacionais),(8,'financeiro','Resultado financeiro',s.financeiro),
 (9,'antes_tributos','Resultado antes dos tributos',s.receita+s.deducoes+s.custos+s.operacionais+s.financeiro),(10,'tributos','Tributos sobre o resultado',s.tributos),
 (11,'resultado','Resultado gerencial',s.receita+s.deducoes+s.custos+s.operacionais+s.financeiro+s.tributos)) v(ordem,chave,nome,valor)),
 brutos as(select i.id,i.fonte,i.natureza,max(i.descricao) descricao,max(i.dia) dia,max(i.categoria) categoria,max(i.centro) centro,max(i.fornecedor) fornecedor,
  string_agg(distinct i.produto,' / ' order by i.produto) produto,max(i.documento) documento,max(i.status) status,max(i.principal_origem) principal_origem,max(i.juros_origem) juros_origem,max(i.multa_origem) multa_origem,max(i.desconto_origem) desconto_origem,max(i.total_origem) total_origem,sum(i.valor) valor
  from itens i group by i.id,i.fonte,i.natureza), pagina_itens as(
  select to_jsonb(i)-'valor'||jsonb_build_object('valor',i.valor::text) dados,i.dia,i.fonte,i.id,i.produto_id,i.componente from itens i where not p_bruto
  union all select to_jsonb(b)-'valor'||jsonb_build_object('valor',b.valor::text),b.dia,b.fonte,b.id,null::uuid,'' from brutos b where p_bruto
 ), detalhes as(select * from pagina_itens order by dia,fonte,id,produto_id nulls first,componente limit case when p_exportar then null else 50 end offset case when p_exportar then 0 else (p_origens-1)*50 end)
 select jsonb_build_object('vista',vista,'total_grupos',(select count(*) from grupos),'total_itens',(select count(*) from pagina_itens),
 'receita',coalesce((select sum(valor) from itens where natureza='receita'),0)::text,'despesa',(-coalesce((select sum(valor) from itens where natureza='despesa'),0))::text,'resultado',coalesce((select sum(valor) from itens),0)::text,
 'dre',(select jsonb_agg(jsonb_build_object('chave',chave,'nome',nome,'valor',valor::text) order by ordem) from dre),
 'grupos',coalesce((select jsonb_agg(jsonb_build_object('chave',chave,'nome',nome,'receita',receita::text,'despesa',despesa::text,'resultado',resultado::text,'diretos',diretos::text,'compartilhados',compartilhados::text,'gerais',gerais::text,'margem',(receita-diretos-compartilhados)::text) order by lower(nome),chave) from pagina_grupos),'[]'::jsonb),
 'itens',coalesce((select jsonb_agg(dados order by dia,fonte,id,produto_id nulls first,componente) from detalhes),'[]'::jsonb)) into v_resultado;
 return v_resultado;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return null;
end $$;

-- Medição sem cota/cobrança. Exportação bruta não chama esta função.
create function private.registrar_exportacao_relatorio(p_empresa uuid,p_request uuid,p_formato text,p_filtros jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.exportacoes_relatorios; inserted uuid;
begin
 if auth.uid() is null or not private.tem_papel_empresa(p_empresa,array['proprietario','administrador','operador','contador_completo','leitura','contador_leitura']) then return jsonb_build_object('codigo','sem_acesso'); end if;
 if p_request is null or p_formato is null or p_formato not in('csv','xlsx') or p_filtros is null or jsonb_typeof(p_filtros)<>'object' then return jsonb_build_object('codigo','dados_invalidos'); end if;
 insert into public.exportacoes_relatorios(id,empresa_id,autor_id,formato,filtros) values(p_request,p_empresa,auth.uid(),p_formato,p_filtros) on conflict(id) do nothing returning id into inserted;
 if inserted is null then
  select * into saved from public.exportacoes_relatorios where id=p_request;
  if saved.empresa_id<>p_empresa or saved.autor_id<>auth.uid() or saved.formato<>p_formato or saved.filtros<>p_filtros then return jsonb_build_object('codigo','pedido_conflitante'); end if;
 else
  insert into public.eventos_uso(empresa_id,usuario_id,modulo,evento) values(p_empresa,auth.uid(),'relatorios','exportar_formatado');
 end if;
 return jsonb_build_object('codigo','ok');
end $$;
create function public.registrar_exportacao_relatorio(p_empresa uuid,p_request uuid,p_formato text,p_filtros jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.registrar_exportacao_relatorio(p_empresa,p_request,p_formato,p_filtros); $$;
revoke all on function public.grupo_categoria_dre(uuid,uuid),public.itens_relatorio(uuid,date,date,text),public.gerar_relatorio(uuid,jsonb,integer,integer,boolean,boolean),
 private.configurar_dre(uuid,uuid,integer,text,uuid),public.configurar_dre(uuid,uuid,integer,text,uuid),
 private.registrar_exportacao_relatorio(uuid,uuid,text,jsonb),public.registrar_exportacao_relatorio(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.grupo_categoria_dre(uuid,uuid),public.itens_relatorio(uuid,date,date,text),public.gerar_relatorio(uuid,jsonb,integer,integer,boolean,boolean),
 private.configurar_dre(uuid,uuid,integer,text,uuid),public.configurar_dre(uuid,uuid,integer,text,uuid),
 private.registrar_exportacao_relatorio(uuid,uuid,text,jsonb),public.registrar_exportacao_relatorio(uuid,uuid,text,jsonb) to authenticated;
