-- カウンセリング住所のジオコーディング情報

alter table public.counseling_records add column if not exists geo_lat double precision;
alter table public.counseling_records add column if not exists geo_lng double precision;
alter table public.counseling_records add column if not exists geo_source text;          -- nominatim / google / manual
alter table public.counseling_records add column if not exists geo_attempted_at timestamptz;
alter table public.counseling_records add column if not exists geo_error text;

create index if not exists counseling_geo_idx on public.counseling_records(geo_lat, geo_lng) where geo_lat is not null;
