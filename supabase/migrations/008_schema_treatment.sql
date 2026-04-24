-- ================================================================
-- 008: 施術レポート + 肌分析
-- ================================================================

create table if not exists treatment_reports (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  customer_name_snapshot text,          -- 顧客削除後も残す
  visit_date date not null,
  store_id text references stores(id),
  menu_items jsonb,                     -- [{key, label}, ...]
  option_items jsonb,
  report_type text check (report_type in ('skin','face','both')),
  skin_scores jsonb,                    -- { moisture: 5, pores: 3, ... }
  face_scores jsonb,
  feedback_text text,
  care_text text,
  ai_generated boolean default false,
  ai_prompt_note text,
  photo_before_path text,               -- Storage path: vivie-customer/treatment/{customer_id}/{visit_date}/before.jpg
  photo_after_path text,
  coupon_selected text,
  coupon_option text,
  next_reservation_date date,
  recorder text,
  sent_to_line_at timestamptz,
  line_flex_message jsonb,              -- 送信した Flex Message スナップショット
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists treatment_reports_customer_idx on treatment_reports(customer_id);
create index if not exists treatment_reports_visit_idx on treatment_reports(visit_date desc);
create index if not exists treatment_reports_store_idx on treatment_reports(store_id);

drop trigger if exists treatment_reports_updated_at on treatment_reports;
create trigger treatment_reports_updated_at before update on treatment_reports
  for each row execute function set_updated_at();

create table if not exists skin_analyses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  store_id text references stores(id),
  total_score int,
  grade text,                           -- 'A'|'B'|'C'|'D'
  metrics jsonb,                        -- { moisture: {score: 75, level: 'good'}, ... }
  image_path text,                      -- Storage
  previous_analysis_id uuid references skin_analyses(id) on delete set null,
  recorder text,
  analyzed_at timestamptz default now()
);

create index if not exists skin_analyses_customer_idx on skin_analyses(customer_id);
create index if not exists skin_analyses_analyzed_idx on skin_analyses(analyzed_at desc);
