-- ============================================================
-- 009: 계정 삭제 (Google Play 필수)
--
-- 앱에서 delete_my_account(heirs)를 부르면 지금 로그인한 사람의 계정을 실제로 지운다.
-- heirs는 {"그룹 id": "다음 그룹장 user id"} — 삭제 화면에서 그룹마다 고른 사람.
-- 플래그만 세우는 soft delete가 아닌 이유:
--   - 스토어 정책이 "계정과 관련 데이터 삭제"를 요구한다
--   - 같은 카카오 계정으로 다시 들어오면 같은 auth 사용자로 이어져, 지운 줄 안 데이터가 되살아난다
--
-- 순서가 중요하다. groups.created_by는 profiles를 ON DELETE CASCADE로 물고 있어서
-- 그냥 지우면 내가 만든 그룹이 다른 가족의 일정·사진과 함께 통째로 사라진다. 그래서 먼저
--   1) 내가 만든 그룹 중 다른 멤버가 있는 곳은 고른 사람(없으면 가장 먼저 들어온 멤버)에게 그룹장을 넘기고
--   2) 나 혼자인 그룹만 지운 뒤
--   3) auth.users에서 나를 지운다 → profiles → group_members·내가 쓴 entries가 연쇄로 지워진다
--
-- Storage의 사진 파일은 SQL로 지우지 않는다(Supabase가 권하지 않는다). 앱이 이 함수를 부르기 전에
-- 내가 올린 파일을 Storage API로 먼저 지운다.
--
-- security definer로 postgres 권한을 빌려 auth.users를 지운다. 대상은 auth.uid() 하나로 고정이라
-- 남의 계정은 건드릴 수 없다.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

-- 인자 없던 이전 판이 남아 있으면 지운다 (이름이 같아도 인자가 다르면 별개 함수가 된다)
drop function if exists public.delete_my_account();

create or replace function public.delete_my_account(heirs jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g record;
  heir uuid;
begin
  if me is null then
    raise exception '로그인이 필요합니다';
  end if;

  for g in select id from public.groups where created_by = me loop
    -- 앱에서 고른 다음 그룹장. 그 그룹의 멤버가 아니면(조작된 값) 무시하고 가장 먼저 들어온 멤버로
    select user_id into heir
    from public.group_members
    where group_id = g.id and user_id <> me
    order by (user_id::text = heirs ->> g.id::text) desc, joined_at
    limit 1;

    if heir is null then
      delete from public.groups where id = g.id;
    else
      update public.group_members set role = 'owner' where group_id = g.id and user_id = heir;
      update public.groups set created_by = heir where id = g.id;
    end if;
  end loop;

  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account(jsonb) from public, anon;
grant execute on function public.delete_my_account(jsonb) to authenticated;

notify pgrst, 'reload schema';


-- 확인: 함수 1행
select proname, prosecdef
from pg_proc
where proname = 'delete_my_account';
