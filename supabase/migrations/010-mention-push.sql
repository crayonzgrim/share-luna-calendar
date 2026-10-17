-- ============================================================
-- 010: 일정에서 @로 부른 사람에게 푸시 알림
--
-- push_tokens: 기기의 Expo 푸시 토큰. 행이 있으면 "알림 받음", 없으면 "안 받음"이다.
--   앱 설정의 알림 토글을 끄면 행을 지운다 — 받을지 말지는 받는 사람이 정하고, 서버는 행만 본다.
--   profiles에 칼럼으로 두지 않는 이유: profiles는 같은 그룹 사람에게 보이는데, 토큰을 알면
--   누구든 그 기기로 푸시를 보낼 수 있다. 그래서 나만 보는 테이블로 뗀다.
--
-- notify_mentions: 일정을 저장한 앱이 부른 사람들의 id를 넘기면 Expo 푸시 서버로 보낸다.
--   pg_net으로 DB에서 바로 쏜다 — Edge Function을 배포할 필요가 없다.
--   받는 사람은 그 그룹 멤버 중 토큰이 있는 사람으로 거른다(조작된 id는 버려진다).
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ponytail: 한 사람당 기기 하나 — 마지막에 켠 기기로 간다. 여러 기기가 필요하면 (user_id, token)을 키로
create table if not exists public.push_tokens (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "own push token" on public.push_tokens;
create policy "own push token" on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;


create or replace function public.notify_mentions(gid uuid, users uuid[], title text, day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msgs jsonb;
begin
  if not public.is_group_member(gid) then
    raise exception '그룹 멤버만 알릴 수 있어요';
  end if;

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    -- 예: "2026. 10. 17 엄마님이 일정에 태그됐어요" / 본문은 일정 제목
    'title', to_char(day, 'YYYY. FMMM. FMDD') || ' ' || p.name || '님이 일정에 태그됐어요',
    'body', title,
    'sound', 'default',
    'channelId', 'default',
    'data', jsonb_build_object('date', day)
  ))
  into msgs
  from public.push_tokens t
  join public.group_members m on m.user_id = t.user_id and m.group_id = gid
  join public.profiles p on p.id = t.user_id
  where t.user_id = any(users) and t.user_id <> auth.uid();

  if msgs is null then
    return;
  end if;

  -- 비동기다. 응답(잘못된 토큰 등)은 net._http_response에 쌓이고 여기선 보지 않는다
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := msgs,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function public.notify_mentions(uuid, uuid[], text, date) from public, anon;
grant execute on function public.notify_mentions(uuid, uuid[], text, date) to authenticated;

notify pgrst, 'reload schema';


-- 확인: 테이블 1행, 함수 1행
select tablename from pg_tables where tablename = 'push_tokens';
select proname, prosecdef from pg_proc where proname = 'notify_mentions';
