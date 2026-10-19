-- Indicadores da empresa, consultados no mesmo snapshot e sob as RLS das origens.
create function public.resumo_dashboard(p_empresa uuid,p_mes date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare fim date; hoje date:=(current_timestamp at time zone 'America/Bahia')::date; fluxo jsonb; resultado jsonb;
begin
 if not exists(select 1 from public.usuarios_empresas where empresa_id=p_empresa and usuario_id=(select auth.uid())) then return null; end if;
 if p_mes is null or p_mes<date '2000-01-01' or p_mes>date '2100-12-01' or extract(day from p_mes)<>1 then
  raise exception 'Informe o primeiro dia de um mês entre 2000 e 2100.' using errcode='22023';
 end if;
 fim:=(p_mes+interval '1 month'-interval '1 day')::date;
 fluxo:=public.fluxo_caixa(p_empresa,p_mes,fim,null,false,1);
 with pagar as materialized (
  select l.*,c.nome as categoria from public.lancamentos_pagar l join public.categorias c on c.empresa_id=l.empresa_id and c.id=l.categoria_id
  where l.empresa_id=p_empresa and l.status in('aberto','pago')
 ), receber as materialized (
  select * from public.lancamentos_receber where empresa_id=p_empresa and status='aberto'
 ), fixos as (
  select categoria_id,categoria,sum(valor_centavos::numeric) as valor from pagar
  where custo_fixo and vencimento between p_mes and fim group by categoria_id,categoria
 ), meses as (
  select (p_mes+n*interval '1 month')::date as mes from generate_series(1,3) n
 ), projecao as (
  select m.mes,coalesce(sum(l.valor_centavos::numeric),0) as valor from meses m
  left join pagar l on l.custo_fixo and l.status='aberto' and l.vencimento>=m.mes and l.vencimento<(m.mes+interval '1 month')::date group by m.mes
 ), pendentes as materialized (
  select m.* from public.lancamentos_importados m where m.empresa_id=p_empresa and m.data_movimento<=fim
   and not exists(select 1 from public.conciliacoes c where c.empresa_id=p_empresa and c.movimento_id=m.id and c.desfeita_em is null)
 ), contas as (
  select b.id,b.nome,b.ativo,(b.saldo_inicial_centavos::numeric+coalesce(sum(m.valor_centavos::numeric),0)) as saldo
  from public.contas_bancarias b left join public.lancamentos_importados m on m.empresa_id=b.empresa_id and m.conta_id=b.id and m.data_movimento<=fim
  where b.empresa_id=p_empresa and b.data_saldo_inicial<=fim group by b.id
 )
 select jsonb_build_object('mes',p_mes,'fim',fim,'hoje',hoje,'fluxo',fluxo,
  'pagar_aberto',coalesce((select sum(valor_centavos::numeric) from pagar where status='aberto' and vencimento between p_mes and fim),0)::text,
  'receber_aberto',coalesce((select sum(valor_centavos::numeric) from receber where vencimento between p_mes and fim),0)::text,
  'pagar_vencido',coalesce((select sum(valor_centavos::numeric) from pagar where status='aberto' and vencimento<hoje),0)::text,
  'receber_vencido',coalesce((select sum(valor_centavos::numeric) from receber where vencimento<hoje),0)::text,
  'pagar_vencidos',(select count(*) from pagar where status='aberto' and vencimento<hoje),
  'receber_vencidos',(select count(*) from receber where vencimento<hoje),
  'pagar_quantidade',(select count(*) from pagar where status='aberto' and vencimento between p_mes and fim),
  'receber_quantidade',(select count(*) from receber where vencimento between p_mes and fim),
  'titulos',coalesce((select jsonb_agg(to_jsonb(t) order by t.vencimento,t.tipo,t.id) from (
   select * from (
    select id,descricao,vencimento,valor_centavos::text as valor,'pagar'::text as tipo from pagar where status='aberto' and vencimento between p_mes and fim
    union all select id,descricao,vencimento,valor_centavos::text,'receber' from receber where vencimento between p_mes and fim
   ) l order by vencimento,tipo,id limit 10
  ) t),'[]'::jsonb),
  'custos_fixos',coalesce((select sum(valor) from fixos),0)::text,'categorias_fixos',(select count(*) from fixos),
  'fixos',coalesce((select jsonb_agg(jsonb_build_object('categoria_id',categoria_id,'categoria',categoria,'valor',valor::text) order by valor desc,categoria_id) from (
   select * from fixos order by valor desc,categoria_id limit 10
  ) f),'[]'::jsonb),
  'projecao_fixos',(select jsonb_agg(jsonb_build_object('mes',mes,'valor',valor::text) order by mes) from projecao),
  'pendentes',(select count(*) from pendentes),
  'movimentos_pendentes',coalesce((select jsonb_agg(jsonb_build_object('id',id,'conta_id',conta_id,'descricao',descricao,'data',data_movimento,'valor',valor_centavos::text) order by data_movimento desc,id) from (
   select * from pendentes order by data_movimento desc,id limit 5
  ) m),'[]'::jsonb),
  'quantidade_contas',(select count(*) from contas),
  'contas',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nome',nome,'ativo',ativo,'saldo',saldo::text) order by nome,id) from (
   select * from contas order by nome,id limit 10
  ) b),'[]'::jsonb)) into resultado;
 return resultado;
end; $$;
revoke all on function public.resumo_dashboard(uuid,date) from public,anon;
grant execute on function public.resumo_dashboard(uuid,date) to authenticated;
