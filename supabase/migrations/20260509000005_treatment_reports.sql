-- 施術レポート + 肌分析 (旧 SPA の Treatment Report / Skin Analyzer 相当)
-- 1 来店ごとの施術記録に肌・顔のスコアと写真を紐付ける

create table public.treatment_reports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  treatment_date date not null,
  -- メニュー / 内容
  menu text,
  duration_minutes integer,
  amount integer,
  -- 肌スコア (1-5, jsonb)
  skin_scores jsonb not null default '{}'::jsonb,
  -- 顔スコア (1-5, jsonb)
  face_scores jsonb not null default '{}'::jsonb,
  -- 体スコア (1-5, jsonb)
  body_scores jsonb not null default '{}'::jsonb,
  -- 写真 (Supabase Storage の path)
  before_photo_path text,
  after_photo_path text,
  -- 所感
  observations text,
  next_recommendation text,
  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index treatment_reports_member_idx on public.treatment_reports(member_id, treatment_date desc);
create index treatment_reports_store_idx on public.treatment_reports(store_id, treatment_date desc);
create index treatment_reports_date_idx on public.treatment_reports(treatment_date desc);

create trigger set_updated_at before update on public.treatment_reports
  for each row execute function public.tg_set_updated_at();

alter table public.treatment_reports enable row level security;
create policy "auth all treatment_reports" on public.treatment_reports
  for all to authenticated using (true) with check (true);

-- 写真用 Storage バケット (private, 認証ユーザーのみアクセス)
insert into storage.buckets (id, name, public)
values ('treatment-photos', 'treatment-photos', false)
on conflict (id) do nothing;

-- バケットへのアクセス権 (認証ユーザーは全 SELECT/INSERT/UPDATE/DELETE)
create policy "auth read photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'treatment-photos');

create policy "auth upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'treatment-photos');

create policy "auth update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'treatment-photos')
  with check (bucket_id = 'treatment-photos');

create policy "auth delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'treatment-photos');
