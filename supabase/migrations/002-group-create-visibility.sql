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
--
-- 주의: Supabase SQL Editor는 스크립트 전체를 한 트랜잭션으로 실행한다.
--       중간에 rollback을 넣으면 앞선 DDL까지 되돌아가므로 넣지 않는다.
-- ============================================================

drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());


-- 확인: qual에 created_by = auth.uid() 가 포함되어야 한다
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'groups' and cmd = 'SELECT';
