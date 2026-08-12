-- ============================================================
-- 003: 카카오 OIDC의 nickname / picture 클레임을 프로필에 반영
--
-- 배경:
--   내장 kakao 프로바이더 대신 커스텀 OIDC(custom:kakao)로 로그인하도록 바꿨다.
--   account_email 스코프를 빼기 위해서다(개인 앱은 그 권한이 없어 KOE205로 막힌다).
--
--   그런데 카카오 OIDC의 ID 토큰이 싣는 클레임 이름이 다르다:
--     nickname  ← 이름
--     picture   ← 프로필 사진
--   기존 트리거는 name / full_name / preferred_username / avatar_url만 봤기 때문에
--   그대로 두면 모든 사용자가 '이름없음'으로 저장된다.
--
-- 이 마이그레이션은 트리거 함수만 교체한다. 기존 데이터는 건드리지 않는다.
-- ============================================================

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


-- 확인: 함수 본문에 nickname이 들어갔는지
select
  proname as function_name,
  (prosrc like '%nickname%') as handles_nickname,
  (prosrc like '%picture%')  as handles_picture
from pg_proc
where proname = 'handle_new_user';
