-- 物販 / 消耗品の在庫管理
-- products: 商品マスタ + 現在庫
-- stock_movements: 入出庫履歴 (トリガーで products.current_stock を自動更新)

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  sku text,
  unit_price integer not null default 0,   -- 販売単価
  cost_price integer not null default 0,    -- 仕入単価
  current_stock integer not null default 0,
  low_stock_threshold integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_active_idx on public.products(is_active, name);

create trigger set_updated_at before update on public.products
  for each row execute function public.tg_set_updated_at();

alter table public.products enable row level security;
create policy "auth all products" on public.products
  for all to authenticated using (true) with check (true);

do $$ begin
  create type public.stock_movement_kind as enum ('in', 'out', 'adjust');
exception when duplicate_object then null; end $$;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind public.stock_movement_kind not null,
  quantity integer not null,
  reason text,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx
  on public.stock_movements(product_id, created_at desc);

alter table public.stock_movements enable row level security;
create policy "auth all stock_movements" on public.stock_movements
  for all to authenticated using (true) with check (true);

-- 入出庫に応じて在庫を更新する
-- in: 加算 / out: 減算 / adjust: 棚卸の実数に上書き
create or replace function public.tg_apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if new.kind = 'in' then
    update public.products set current_stock = current_stock + new.quantity
      where id = new.product_id;
  elsif new.kind = 'out' then
    update public.products set current_stock = current_stock - new.quantity
      where id = new.product_id;
  elsif new.kind = 'adjust' then
    update public.products set current_stock = new.quantity
      where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_stock_movement_trg on public.stock_movements;
create trigger apply_stock_movement_trg
  after insert on public.stock_movements
  for each row execute function public.tg_apply_stock_movement();
