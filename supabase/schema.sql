-- ============================================================
-- share-calendar 스키마 + RLS
--
-- Supabase Dashboard > SQL Editor에 이 파일 전체를 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하다 (idempotent).
--
-- 프로젝트 생성 시 Security 설정 전제:
--   Enable Data API                 : 켬
--   Automatically expose new tables : 끔  ← 아래 GRANT가 이걸 보완한다
--   Enable automatic RLS            : 켬
-- ============================================================


-- ---------- 테이블 ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '이름없음',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 50),
  -- 12자리 hex. pgcrypto 없이 내장 gen_random_uuid()만으로 만든다.
  invite_code text not null unique
              default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  -- auth.users가 아니라 profiles를 참조한다.
  -- PostgREST는 외래키를 따라서만 조인하므로, 작성자 이름을 함께 가져오려면
  -- 이 관계가 profiles를 직접 가리켜야 한다. (profiles.id가 auth.users를
  -- 참조하므로 사용자 삭제 시 연쇄 삭제는 그대로 동작한다.)
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  memo          text check (length(memo) <= 2000),
  -- 일정 종류 key ('birthday', 'memorial' …). 이모지·라벨 매핑은 앱(src/lib/icons.ts)에 있다.
  icon          text check (icon is null or length(icon) <= 32),
  date_type     text not null default 'solar' check (date_type in ('solar', 'lunar')),
  repeat        text not null default 'none'
                check (repeat in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  -- n일/주/개월/년마다의 n
  repeat_interval int not null default 1 check (repeat_interval between 1 and 99),
  event_date    date not null,
  -- 시각 (시간대 없음). null이면 종일 일정.
  event_time    time,
  lunar_month   int  check (lunar_month between 1 and 12),
  lunar_day     int  check (lunar_day   between 1 and 30),
  is_leap_month boolean not null default false,
  -- 첨부 사진의 Storage 경로 (버킷 entry-images). 아래 Storage 절 참고.
  image_paths   text[] not null default '{}' check (cardinality(image_paths) <= 5),
  created_at    timestamptz not null default now(),
  -- 음력 항목은 음력 월/일이 반드시 있어야 한다
  constraint lunar_fields_present check (
    date_type <> 'lunar' or (lunar_month is not null and lunar_day is not null)
  )
);

create index if not exists entries_group_idx      on public.entries (group_id);
create index if not exists group_members_user_idx on public.group_members (user_id);


-- ---------- 헬퍼 함수 ----------
-- SECURITY DEFINER로 RLS를 우회한다. 이게 없으면 group_members 정책이
-- 자기 자신을 조회하며 무한 재귀에 빠진다 (Supabase의 대표적인 함정).

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on me.group_id = other.group_id
    where me.user_id = auth.uid() and other.user_id = uid
  );
$$;


-- ---------- 트리거 ----------

-- 카카오 로그인으로 신규 가입하면 프로필을 자동 생성한다 (클라이언트 코드 불필요)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'nickname',           -- 카카오 OIDC
      new.raw_user_meta_data ->> 'preferred_username',
      '이름없음'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'             -- 카카오 OIDC
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 그룹을 만들면 만든 사람을 owner 멤버로 자동 추가한다
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_creator_as_owner();


-- ---------- 초대 코드로 그룹 가입 ----------
-- 코드를 아는 사람만 가입할 수 있어야 하는데, groups를 직접 조회하게 두면
-- 비멤버가 그룹 목록을 훑을 수 있다. 그래서 함수 하나로만 열어준다.

create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception '잘못된 초대 코드입니다';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return gid;
end;
$$;


-- ---------- RLS ----------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.entries       enable row level security;

-- profiles: 나 자신 + 같은 그룹에 속한 사람만 조회 가능
drop policy if exists "read own and groupmate profiles" on public.profiles;
create policy "read own and groupmate profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: 멤버만 조회, 로그인 사용자는 생성 가능, owner만 수정/삭제
--
-- created_by 조건이 함께 있어야 하는 이유:
-- add_creator_as_owner는 AFTER INSERT 트리거라 문이 끝날 때 실행되는데,
-- .insert().select()가 쓰는 RETURNING은 그 전에 평가된다. 즉 그룹을 만든
-- 직후에는 아직 멤버가 아니어서, is_group_member만으로는 자기가 방금 만든
-- 그룹을 되돌려받지 못하고 403이 난다.
drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id) or created_by = auth.uid());

drop policy if exists "authenticated create groups" on public.groups;
create policy "authenticated create groups" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

-- WITH CHECK가 없으면 owner가 created_by를 남의 id로 바꿔 그룹을 통째로 넘길 수 있다.
-- USING은 "어떤 행을 고칠 수 있나"만 보고 "고친 결과가 유효한가"는 안 보기 때문이다.
-- created_by = auth.uid()는 곧 "고친 뒤에도 내가 만든 그룹"이라는 뜻이다
-- (그룹을 만든 사람이 트리거로 owner가 되므로 owner와 created_by는 늘 같은 사람이다).
drop policy if exists "owner updates group" on public.groups;
create policy "owner updates group" on public.groups
  for update to authenticated
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ))
  with check (created_by = auth.uid());

drop policy if exists "owner deletes group" on public.groups;
create policy "owner deletes group" on public.groups
  for delete to authenticated
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ));

-- group_members: 같은 그룹 멤버끼리만 서로 보인다
drop policy if exists "members read memberships" on public.group_members;
create policy "members read memberships" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "leave group" on public.group_members;
create policy "leave group" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid());

-- entries: 그룹 멤버는 모두 읽고 쓸 수 있지만, 고치고 지우는 건 작성자만
drop policy if exists "members read entries" on public.entries;
create policy "members read entries" on public.entries
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "members insert entries" on public.entries;
create policy "members insert entries" on public.entries
  for insert to authenticated
  with check (public.is_group_member(group_id) and author_id = auth.uid());

drop policy if exists "author updates entries" on public.entries;
create policy "author updates entries" on public.entries
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "author deletes entries" on public.entries;
create policy "author deletes entries" on public.entries
  for delete to authenticated
  using (author_id = auth.uid());


-- ---------- Data API 권한 (GRANT) ----------
-- 프로젝트 생성 시 "Automatically expose new tables"를 껐다면 이 GRANT가 없으면
-- SQL 실행은 성공해도 앱에서 "permission denied for table ..."이 난다.
-- 켜둔 상태라면 이미 부여된 권한이라 다시 실행해도 무해하다.
--
-- 여기서 주는 건 "이 테이블을 Data API로 만질 수 있다"까지고,
-- 어떤 행을 볼 수 있는지는 위의 RLS 정책이 결정한다. 두 층은 별개다.
-- anon에는 아무 테이블 권한도 주지 않는다 — 로그인 없이 접근할 이유가 없다.

grant usage on schema public to anon, authenticated;

grant select, update                  on public.profiles      to authenticated;
grant select, insert, update, delete  on public.groups        to authenticated;
grant select, delete                  on public.group_members to authenticated;
grant select, insert, update, delete  on public.entries       to authenticated;

-- group_members INSERT 권한은 일부러 주지 않는다.
-- 가입은 join_group_by_code(SECURITY DEFINER)와 그룹 생성 트리거로만 이뤄져야
-- 초대 코드를 모르는 사람이 임의의 그룹에 자기를 밀어넣을 수 없다.

grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.is_group_member(uuid)    to authenticated;
grant execute on function public.shares_group_with(uuid)  to authenticated;


-- ---------- Storage: 일정 첨부 사진 ----------
-- 비공개 버킷. 경로 규칙 {group_id}/{올린 사람 user_id}/{랜덤}.jpg —
-- 앞의 두 칸으로 권한을 가른다. 자세한 이유는 migrations/006-entry-images.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-images', 'entry-images', false, 5 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do nothing;

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
