-- RLS ポリシーの無限再帰を解消
-- is_admin() / is_admin_or_manager() を SECURITY DEFINER に変更し、
-- 関数内のクエリが呼び出し元の RLS ポリシーを引き起こさないようにする

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'admin' from public.staff where id = auth.uid()), false);
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role in ('admin', 'manager') from public.staff where id = auth.uid()),
    false);
$$;

create or replace function public.current_staff()
returns public.staff
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.staff where id = auth.uid() limit 1;
$$;

-- 関数の実行権限を anon / authenticated に明示的に付与
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_admin_or_manager() to anon, authenticated;
grant execute on function public.current_staff() to anon, authenticated;
