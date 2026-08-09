-- ============================================================
-- 001: 사용자 참조를 auth.users → public.profiles 로 변경
--
-- 이유:
--   PostgREST는 외래키를 따라서만 테이블을 조인한다.
--   entries.author_id 와 profiles.id 가 둘 다 auth.users를 가리키는 것만으로는
--   "일정 + 작성자 이름"을 한 번에 가져올 수 없다 (두 테이블 사이에 직접
--   외래키가 없기 때문). 참조 대상을 profiles로 바꿔야 조인이 성립한다.
--
--   profiles.id 가 여전히 auth.users를 참조하므로,
--   사용자 삭제 → profiles 삭제 → groups/entries 삭제 연쇄는 그대로 유지된다.
--
-- 이 파일은 schema.sql을 이미 실행한 프로젝트에만 필요하다.
-- 새로 만드는 프로젝트는 schema.sql에 이미 반영되어 있다.
-- ============================================================

alter table public.entries drop constraint if exists entries_author_id_fkey;
alter table public.entries
  add constraint entries_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.group_members drop constraint if exists group_members_user_id_fkey;
alter table public.group_members
  add constraint group_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups
  add constraint groups_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;


-- 확인: 세 제약이 모두 profiles를 가리켜야 한다
select
  con.conname            as constraint_name,
  src.relname            as from_table,
  tgt.relname            as references_table
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_class tgt on tgt.oid = con.confrelid
where con.contype = 'f'
  and src.relname in ('entries', 'group_members', 'groups')
order by src.relname;
