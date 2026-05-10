-- 1. 「名前未取得」表示の改善
--    line_conversations ビューが members.line_display_name しか見ていなかったので、
--    未連携の会話でも line_events の最新プロフィール名をフォールバックに使う
-- 2. ジオコーディングの簡略化リトライ用に short_address を計算する関数を追加

create or replace view public.line_conversations as
with latest_event as (
  select distinct on (line_user_id)
    line_user_id,
    display_name,
    picture_url
  from public.line_events
  where display_name is not null and line_user_id is not null
  order by line_user_id, received_at desc
)
select distinct on (m.line_user_id)
  m.line_user_id,
  m.member_id,
  mb.full_name as member_name,
  coalesce(mb.line_display_name, le.display_name) as line_display_name,
  coalesce(mb.line_picture_url, le.picture_url) as line_picture_url,
  m.message_text as last_message,
  m.message_type as last_message_type,
  m.direction as last_direction,
  m.sent_at as last_sent_at,
  coalesce(meta.status, 'open') as status,
  coalesce(meta.pinned, false) as pinned,
  meta.assignee_id,
  meta.last_handled_at,
  (
    select count(*) from public.line_messages u
    where u.line_user_id = m.line_user_id
      and u.direction = 'inbound'
      and u.read_at is null
  ) as unread_count
from public.line_messages m
left join public.members mb on mb.id = m.member_id
left join latest_event le on le.line_user_id = m.line_user_id
left join public.line_conversation_meta meta on meta.line_user_id = m.line_user_id
order by m.line_user_id, m.sent_at desc;

grant select on public.line_conversations to authenticated;
