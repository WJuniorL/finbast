-- Serializa a criação/reativação de subcategorias com alterações da principal.
-- O trigger VOLATILE consulta o estado confirmado após esperar pelo lock.
create or replace function private.validar_categoria()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare pai public.categorias;
begin
  if new.pai_id is not null then
    select * into pai from public.categorias
      where empresa_id = new.empresa_id and id = new.pai_id for update;
    if not found or pai.pai_id is not null or pai.tipo <> new.tipo or (new.ativo and not pai.ativo) then
      raise check_violation using message = 'Categoria pai incompatível.';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (new.pai_id is not null or new.tipo <> old.tipo) and exists (
      select 1 from public.categorias where empresa_id = new.empresa_id and pai_id = new.id
    ) then raise check_violation using message = 'Categoria com subcategorias não pode mudar de tipo ou nível.'; end if;
    if not new.ativo and exists (
      select 1 from public.categorias where empresa_id = new.empresa_id and pai_id = new.id and ativo
    ) then raise check_violation using message = 'Arquive primeiro as subcategorias ativas.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_categoria() from public, anon, authenticated;
