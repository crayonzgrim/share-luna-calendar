-- ============================================================
-- 006: 일정에 사진 첨부 (최대 5장)
--
-- 파일은 Storage의 비공개 버킷 entry-images에, 일정에는 그 경로만 저장한다.
--   경로 규칙: {group_id}/{올린 사람 user_id}/{랜덤}.jpg
-- 앞의 두 칸으로 권한을 가른다 — 그룹 멤버만 보고 올리고, 지우는 건 올린 사람만.
-- 일정을 쓴 사람이 사진도 올리므로 "올린 사람 = 작성자"다.
--
-- 공개 버킷이 아닌 이유: 가족 사진이다. 주소만 알면 누구나 보는 건 곤란하다.
-- 앱은 1시간짜리 서명 URL을 받아 보여준다.
--
-- 앱이 긴 변 1280px JPEG로 줄여서 올리므로 장당 수백 KB다.
-- 무료 Storage 1GB 기준으로 대략 수천 장까지 버틴다.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

alter table public.entries
  add column if not exists image_paths text[] not null default '{}'
    check (cardinality(image_paths) <= 5);


-- ---------- 버킷 ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-images', 'entry-images', false, 5 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do nothing;


-- ---------- Storage RLS ----------
-- storage.foldername('a/b/c.jpg') = {a, b}. [1]이 그룹, [2]가 올린 사람.

drop policy if exists "members read entry images" on storage.objects;
create policy "members read entry images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'entry-images'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "members upload own entry images" on storage.objects;
create policy "members upload own entry images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'entry-images'
    and public.is_group_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "uploader deletes entry images" on storage.objects;
create policy "uploader deletes entry images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'entry-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );


-- 확인: 컬럼 1행, 버킷 1행, 정책 3행이 나와야 한다
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'entries' and column_name = 'image_paths';

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'entry-images';

select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%entry images%';
