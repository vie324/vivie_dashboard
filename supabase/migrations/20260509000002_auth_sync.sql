-- 補助マイグレーション
-- 1) auth.users 作成時に staff レコードを自動作成
-- 2) staff トークン未発行を補完

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff (id, email, display_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',
             split_part(new.email, '@', 1)),
    'staff',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 既存ユーザーがいれば staff レコードを補完
insert into public.staff (id, email, display_name, role, is_active)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
       'staff',
       true
from auth.users u
where not exists (select 1 from public.staff s where s.id = u.id)
  and u.email is not null;

-- daily_report_token が空のスタッフに発行
update public.staff
set daily_report_token = replace(gen_random_uuid()::text, '-', '')
where daily_report_token is null;
