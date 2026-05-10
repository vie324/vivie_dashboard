-- カウンセリングフォーム設定 (注意事項テキストなど、ダッシュボードから編集可能)

create table if not exists public.counseling_settings (
  id text primary key default 'default',  -- 単一行 (default のみ)
  disclaimer text,
  updated_by uuid references public.staff(id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.counseling_settings
  for each row execute function public.tg_set_updated_at();

alter table public.counseling_settings enable row level security;

-- 公開フォーム (匿名アクセス) からも注意事項を読み出せるよう、SELECT は誰でも許可
create policy "all read counseling_settings" on public.counseling_settings
  for select using (true);

-- 編集は認証済みユーザーのみ (admin/manager 権限チェックは UI 側)
create policy "auth write counseling_settings" on public.counseling_settings
  for all to authenticated using (true) with check (true);

-- デフォルトの注意事項を seed
insert into public.counseling_settings (id, disclaimer) values (
  'default',
  E'「注意事項及び免責事項同意書」の内容をご理解頂き、同意ご署名頂ける場合のみ施術を行います。\n\n◎当サロンで行われる施術は、美容を目的とし、治療を目的としたものではございません。\n\n◎レモンボトルを施術する際、パイナップルアレルギーと大豆アレルギーをお持ちの方は施術できません。\n\n◎ソフトな手技ではございますがお客様によって施術中、痛みを感じる場合がございます。\n\n◎気分や身体的な違和感があった場合はすぐに施術者に申し出てください。\n\n◎施術中、疑問や不安、要望が生じた場合はすぐに施術者に申し出てください。\n\n◎施術上リスクを高めるとされる整形手術、ボトックス注射、ヒアルロン注射、それらに準ずる一切の事項 は必ず事前に施術者に報告をしてください。報告がなく、施術後にそれが原因で事故が起きても当サロンは一切責任を負いません。'
)
on conflict (id) do nothing;
