-- ============================================================
-- 002: 그룹 생성 시 403 수정
--
-- 증상: POST /rest/v1/groups → 403 Forbidden
--
-- 원인:
--   groups의 조회 정책이 is_group_member(id) 하나뿐이었다.
--   그룹을 만들면 add_creator_as_owner 트리거가 생성자를 멤버로 넣지만,
--   AFTER INSERT 트리거는 문(statement)이 끝날 때 실행되는 반면
--   RETURNING은 그 전에 평가된다. supabase-js의 .insert().select()는
--   RETURNING을 쓰므로, 되돌려받는 시점엔 아직 멤버가 아니라 조회가 막힌다.
--
-- 수정:
--   생성자는 멤버십과 무관하게 자기가 만든 그룹을 볼 수 있게 한다.
--   RETURNING 문제를 해결할 뿐 아니라, owner가 실수로 멤버십을 잃어도
--   자기 그룹에 접근할 수 있어야 한다는 점에서도 옳다.
-- ============================================================


-- ---------- 1) 수정 ----------
-- 역할을 바꾸기 전에 먼저 처리한다. 정책 변경은 테이블 소유자만 할 수 있다.

drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());


-- ---------- 2) 실제로 고쳐졌는지 확인 ----------
-- 트랜잭션 안에서 사용자를 흉내내 그룹 생성을 시도하고, 통째로 롤백한다.
-- 롤백하면 진단용 행도, 역할 변경도 모두 원상복구된다.

begin;

do $$
declare
  uid uuid;
  gid uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise notice '사용자가 없습니다. 먼저 계정을 만드세요.';
    return;
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );

  begin
    insert into public.groups (name, created_by) values ('진단', uid) returning id into gid;
    raise notice '결과: 그룹 생성 성공 — 수정이 적용되었습니다';
  exception when others then
    raise notice '결과: 그룹 생성 실패 — % (%)', sqlerrm, sqlstate;
  end;
end $$;

rollback;


-- ---------- 3) 정책 확인 ----------
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'groups' and cmd = 'SELECT';
