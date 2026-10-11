-- ============================================================
-- 007: 일정에 시간 추가
--
-- 비워두면(null) 종일 일정이다. 시간만 저장하고 날짜는 기존 event_date를 그대로 쓴다 —
-- 반복 일정(매년·매월)도 같은 시각에 찍히면 되므로 timestamp로 합치지 않는다.
-- 시간대 없는 time이다. 가족 달력이라 모두 한국 시각을 쓴다는 전제.
--
-- 여러 번 실행해도 안전하다.
-- ============================================================

alter table public.entries
  add column if not exists event_time time;


-- 확인: 컬럼이 생겼는지
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'entries' and column_name = 'event_time';
