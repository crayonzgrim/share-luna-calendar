-- ============================================================
-- 004: 일정에 종류(아이콘) 추가
--
-- 생일 / 제사 / 결혼기념일처럼 자주 쓰는 종류를 이모지로 구분한다.
-- DB에는 key만 저장하고(예: 'birthday') 이모지와 한글 라벨은 앱이 매핑한다.
--   - 이모지를 바꿔도 기존 일정이 함께 바뀐다
--   - 화면 낭독기에 읽어줄 한글 라벨을 따로 둘 수 있다
--
-- 허용값을 CHECK로 묶지 않는 이유: 종류를 하나 늘릴 때마다 마이그레이션을
-- 돌려야 한다. 쓰는 쪽은 앱뿐이고, 모르는 key가 들어와도 아이콘 없이
-- 표시되도록 되어 있어 잘못된 값이 화면을 깨뜨리지 않는다.
-- ============================================================

alter table public.entries
  add column if not exists icon text check (icon is null or length(icon) <= 32);


-- 확인: 컬럼이 생겼는지
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'entries' and column_name = 'icon';
