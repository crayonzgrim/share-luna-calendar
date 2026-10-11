-- ============================================================
-- 008: 반복을 "n일/주/개월/년마다"로 넓힌다
--
-- repeat에 daily·weekly를 더하고, 간격 n은 repeat_interval에 둔다.
-- 기존 일정은 repeat_interval = 1이 되어 지금처럼 매월·매년으로 보인다.
--
-- repeat의 CHECK는 테이블을 만들 때 칼럼에 붙인 것이라 이름이 entries_repeat_check다.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

alter table public.entries
  drop constraint if exists entries_repeat_check;
alter table public.entries
  add constraint entries_repeat_check
  check (repeat in ('none', 'daily', 'weekly', 'monthly', 'yearly'));

alter table public.entries
  add column if not exists repeat_interval int not null default 1
  check (repeat_interval between 1 and 99);

-- API가 새 칼럼을 바로 알아보게 한다 (안 하면 "schema cache" 에러가 잠깐 날 수 있다)
notify pgrst, 'reload schema';


-- 확인: 칼럼 1행, 제약 1행
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'entries' and column_name = 'repeat_interval';

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'entries_repeat_check';
