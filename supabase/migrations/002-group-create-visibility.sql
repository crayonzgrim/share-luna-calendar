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


-- ---------- 1) 원인 확인 (실제 반영 없이 롤백) ----------
-- 아래 NOTICE 두 줄을 확인한다.
--   A 성공 + B 실패  → RETURNING이 원인 (예상대로)
--   A/B 모두 실패    → 다른 원인. 메시지를 그대로 공유할 것

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

  -- 해당 사용자로 로그인한 것처럼 흉내낸다
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text,
    true
  );

  begin
    insert into public.groups (name, created_by) values ('진단A', uid);
    raise notice 'A) RETURNING 없는 INSERT : 성공';
  exception when others then
    raise notice 'A) RETURNING 없는 INSERT : 실패 — %', sqlerrm;
  end;

  begin
    insert into public.groups (name, created_by) values ('진단B', uid) returning id into gid;
    raise notice 'B) RETURNING 있는 INSERT : 성공';
  exception when others then
    raise notice 'B) RETURNING 있는 INSERT : 실패 — %', sqlerrm;
  end;
end $$;

-- 진단용 행은 남기지 않는다
delete from public.groups where name in ('진단A', '진단B');


-- ---------- 2) 수정 ----------

drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());


-- ---------- 3) 확인 ----------
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'groups' and cmd = 'SELECT';
