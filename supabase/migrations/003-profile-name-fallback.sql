-- ============================================================
-- 003: 프로필 이름/사진 폴백 보강 (선택 적용)
--
-- 프로바이더마다 사용자 정보를 담는 키 이름이 다르다.
-- 내장 kakao 프로바이더는 name / avatar_url 로 넣지만,
-- OIDC 계열은 nickname / picture 로 넣는다.
-- 폴백에 둘 다 넣어두면 어느 쪽으로 로그인하든 이름이 제대로 저장된다.
--
-- 지금은 내장 kakao를 쓰므로 필수는 아니다. 다만 적용해두면
-- 나중에 프로바이더를 바꿔도 사용자가 '이름없음'으로 저장되지 않는다.
--
-- 트리거 함수만 교체한다. 기존 데이터는 건드리지 않는다.
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
