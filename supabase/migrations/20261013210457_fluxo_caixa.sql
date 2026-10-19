-- Um único snapshot; mesmas RLS das origens; nenhuma escrita.
create function public.fluxo_caixa(p_empresa uuid,p_inicio date,p_fim date,p_conta uuid default null,p_sem_conta boolean default false,p_pagina integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
 if not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=(select auth.uid())) then return null; end if;
 if p_inicio is null or p_fim is null or p_inicio<date '2000-01-01' or p_fim>date '2100-12-31' or p_fim<p_inicio or p_fim-p_inicio>365
   or p_sem_conta is null or (p_sem_conta and p_conta is not null) or p_pagina is null or p_pagina not between 1 and 1000000 then
  raise exception 'Filtros inválidos: use um período de até 366 dias.' using errcode='22023';
 end if;
 if p_conta is not null and not exists(select 1 from public.contas_bancarias where empresa_id=p_empresa and id=p_conta) then return null; end if;
 with movimentos as materialized (
  select b.id,b.data_saldo_inicial as data,b.nome as descricao,b.saldo_inicial_centavos::numeric as valor,'abertura'::text as origem,'realizado'::text as tipo,b.id as conta_id
  from public.contas_bancarias b where b.empresa_id=p_empresa and not p_sem_conta and (p_conta is null or b.id=p_conta) and b.data_saldo_inicial<=p_fim
  union all
  select m.id,m.data_movimento,m.descricao,m.valor_centavos::numeric,'extrato','realizado',m.conta_id
  from public.lancamentos_importados m where m.empresa_id=p_empresa and not p_sem_conta and (p_conta is null or m.conta_id=p_conta) and m.data_movimento<=p_fim
  union all
  select l.id,case when l.status='pago' then l.pago_em else l.vencimento end,l.descricao,
   -case when l.status='pago' then l.valor_pago_centavos else l.valor_centavos end::numeric,'pagar',case when l.status='pago' then 'realizado' else 'previsto' end,null::uuid
  from public.lancamentos_pagar l where l.empresa_id=p_empresa and p_conta is null and l.status in('aberto','pago')
   and (case when l.status='pago' then l.pago_em else l.vencimento end)<=p_fim
   and not exists(select 1 from public.conciliacoes c where c.empresa_id=p_empresa and c.pagar_id=l.id and c.desfeita_em is null)
  union all
  select l.id,case when l.status='recebido' then l.recebido_em else l.vencimento end,l.descricao,
   case when l.status='recebido' then l.valor_recebido_centavos else l.valor_centavos end::numeric,'receber',case when l.status='recebido' then 'realizado' else 'previsto' end,null::uuid
  from public.lancamentos_receber l where l.empresa_id=p_empresa and p_conta is null and l.status in('aberto','recebido')
   and (case when l.status='recebido' then l.recebido_em else l.vencimento end)<=p_fim
   and not exists(select 1 from public.conciliacoes c where c.empresa_id=p_empresa and c.receber_id=l.id and c.desfeita_em is null)
 ), anteriores as (
  select coalesce(sum(valor) filter(where tipo='realizado'),0) as saldo_inicial,
   coalesce(sum(valor) filter(where tipo='previsto' and valor>0),0) as vencidos_entradas,
   coalesce(-sum(valor) filter(where tipo='previsto' and valor<0),0) as vencidos_saidas from movimentos where data<p_inicio
 ), dias as (select p_inicio+n as data from generate_series(0,p_fim-p_inicio) n), totais_dia as (
  select d.data,coalesce(sum(m.valor) filter(where m.origem='abertura'),0) as abertura,
   coalesce(sum(m.valor) filter(where m.tipo='realizado' and m.origem<>'abertura' and m.valor>0),0) as entradas,
   coalesce(-sum(m.valor) filter(where m.tipo='realizado' and m.origem<>'abertura' and m.valor<0),0) as saidas,
   coalesce(sum(m.valor) filter(where m.tipo='previsto' and m.valor>0),0) as previstas_entradas,
   coalesce(-sum(m.valor) filter(where m.tipo='previsto' and m.valor<0),0) as previstas_saidas
  from dias d left join movimentos m on m.data=d.data group by d.data
 ), saldos as (
  select d.*,a.saldo_inicial+sum(abertura+entradas-saidas) over(order by data) as saldo_realizado,
   a.saldo_inicial+a.vencidos_entradas-a.vencidos_saidas+sum(abertura+entradas-saidas+previstas_entradas-previstas_saidas) over(order by data) as saldo_projetado
  from totais_dia d cross join anteriores a
 ), detalhe as materialized (select * from movimentos where data>=p_inicio or tipo='previsto'), quantidade as (select count(*) as total from detalhe), paginacao as (
  select total,least(p_pagina,greatest(1,ceil(total/50.0)::integer)) as pagina from quantidade
 ), pagina as (select * from detalhe order by data,origem,id limit 50 offset (select (pagina-1)*50 from paginacao))
 select jsonb_build_object('saldo_inicial',a.saldo_inicial::text,'vencidos_entradas',a.vencidos_entradas::text,'vencidos_saidas',a.vencidos_saidas::text,'total',p.total,'pagina',p.pagina,
  'dias',(select jsonb_agg(jsonb_build_object('data',data,'abertura',abertura::text,'entradas',entradas::text,'saidas',saidas::text,'previstas_entradas',previstas_entradas::text,'previstas_saidas',previstas_saidas::text,'saldo_realizado',saldo_realizado::text,'saldo_projetado',saldo_projetado::text) order by data) from saldos),
  'movimentos',coalesce((select jsonb_agg(jsonb_build_object('id',id,'data',data,'descricao',descricao,'valor',valor::text,'origem',origem,'tipo',tipo,'conta_id',conta_id) order by data,origem,id) from pagina),'[]'::jsonb)) into resultado
 from anteriores a cross join paginacao p;
 return resultado;
end; $$;
revoke all on function public.fluxo_caixa(uuid,date,date,uuid,boolean,integer) from public,anon;
grant execute on function public.fluxo_caixa(uuid,date,date,uuid,boolean,integer) to authenticated;
