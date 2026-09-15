-- ============================================================
-- 005: 그룹 수정 정책에 WITH CHECK 추가 (소유권 이전 차단)
--
-- 기존 정책에는 USING만 있었다.
--
--   create policy "owner updates group" on public.groups
--     for update to authenticated
--     using (exists (... role = 'owner'));
--
-- USING은 "어떤 행을 고칠 수 있나"만 본다. "고친 결과가 유효한가"는 안 본다.
-- 그래서 owner가 created_by를 남의 id로 바꿔 그룹을 통째로 넘길 수 있었다.
-- 넘겨받은 쪽은 group_members에 owner로 들어가 있지도 않아 아무도 그 그룹을
-- 수정하지 못하는 상태가 되기도 한다.
--
-- 앱은 이름만 보내므로 화면에서 벌어질 일은 아니고, Data API를 직접 부르는
-- 경우를 막는다.
--
-- WITH CHECK를 created_by = auth.uid()로 두는 이유:
-- 그룹을 만든 사람이 add_creator_as_owner 트리거로 owner가 되므로
-- owner와 created_by는 항상 같은 사람이다. 따라서 이 조건은
-- "고친 뒤에도 created_by가 나 자신"이라는 뜻이고, 곧 소유권이 안 움직인다는 뜻이다.
--
-- 여러 번 실행해도 안전하다 (정책을 통째로 다시 만든다).
-- ============================================================

drop policy if exists "owner updates group" on public.groups;
create policy "owner updates group" on public.groups
  for update to authenticated
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ))
  with check (created_by = auth.uid());


-- 확인: WITH CHECK가 붙었는지 (with_check가 null이 아니어야 한다)
select
  policyname,
  cmd,
  qual        as using_expr,
  with_check  as with_check_expr
from pg_policies
where schemaname = 'public'
  and tablename  = 'groups'
  and policyname = 'owner updates group';
