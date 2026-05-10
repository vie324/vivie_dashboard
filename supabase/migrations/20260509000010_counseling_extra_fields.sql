-- counseling_records にマーケ・契約分析用カラムを追加
-- 過去のスプレッドシート (担当 / 来店経由 / クロージング状態 / 契約コース 等) を取り込めるように

alter table public.counseling_records add column if not exists assigned_staff_id uuid references public.staff(id) on delete set null;
alter table public.counseling_records add column if not exists assigned_staff_name text; -- staff 突き合わせできない時の元データ
alter table public.counseling_records add column if not exists acquisition_channel text;  -- minimo / HPB / threads / Mavie紹介 / くまポン / Jicoo 等
alter table public.counseling_records add column if not exists closing_status text;       -- closing / next_reservation / none / other
alter table public.counseling_records add column if not exists closing_status_raw text;   -- 元の文字列 (検討したい / 安いから来た 等)
alter table public.counseling_records add column if not exists next_reservation_date date;
alter table public.counseling_records add column if not exists no_contract_reason text;
alter table public.counseling_records add column if not exists contract_reason text;
alter table public.counseling_records add column if not exists contract_plan text;        -- 【月X回】XXXプラン
alter table public.counseling_records add column if not exists imported boolean not null default false;

create index if not exists counseling_channel_idx on public.counseling_records(acquisition_channel);
create index if not exists counseling_assigned_idx on public.counseling_records(assigned_staff_id);
create index if not exists counseling_closing_idx on public.counseling_records(closing_status);
create index if not exists counseling_contracted_idx on public.counseling_records(contract_plan);

-- 契約済かどうかを判定するヘルパー (contract_plan が NULL でなければ契約済)
create or replace view public.counseling_marketing_summary as
select
  acquisition_channel,
  count(*) as total,
  count(*) filter (where contract_plan is not null) as contracted,
  case
    when count(*) > 0 then round(
      count(*) filter (where contract_plan is not null)::numeric / count(*)::numeric * 100,
      1
    )
    else 0
  end as contract_rate
from public.counseling_records
where acquisition_channel is not null
group by acquisition_channel
order by total desc;

grant select on public.counseling_marketing_summary to authenticated;

create or replace view public.counseling_staff_summary as
select
  s.display_name as staff_name,
  cr.assigned_staff_name as raw_name,
  count(*) as total,
  count(*) filter (where cr.contract_plan is not null) as contracted,
  case
    when count(*) > 0 then round(
      count(*) filter (where cr.contract_plan is not null)::numeric / count(*)::numeric * 100,
      1
    )
    else 0
  end as contract_rate
from public.counseling_records cr
left join public.staff s on s.id = cr.assigned_staff_id
where cr.assigned_staff_id is not null or cr.assigned_staff_name is not null
group by s.display_name, cr.assigned_staff_name
order by total desc;

grant select on public.counseling_staff_summary to authenticated;
