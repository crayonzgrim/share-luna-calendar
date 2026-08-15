import { useState } from 'react'
import { WEEKDAY_LABELS } from '../lib/calendar'
import { ENTRY_ICONS, findIcon } from '../lib/icons'
import { nextOccurrence, parseISODate } from '../lib/recurrence'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  entries: EntryWithAuthor[]
  onJump: (d: Date) => void
}

/** 종류 없는 항목을 거를 때 쓰는 값. 실제 key와 겹치지 않게 둔다. */
const NONE = ' none'

export default function EntryList({ entries, onJump }: Props) {
  const [filter, setFilter] = useState<string | null>(null)

  const today = new Date()

  const rows = entries
    .map((entry) => ({ entry, next: nextOccurrence(entry, today) }))
    .sort(byNextThenTitle)

  // 실제로 있는 종류만 칩으로 — 눌러도 빈 목록인 칩은 만들지 않는다
  const present = new Set(entries.map((e) => e.icon ?? NONE))
  const chips = [
    ...ENTRY_ICONS.filter((i) => present.has(i.key)),
    ...(present.has(NONE) ? [{ key: NONE, emoji: '', label: '종류 없음' }] : []),
  ]

  const shown = filter ? rows.filter((r) => (r.entry.icon ?? NONE) === filter) : rows

  return (
    <section className="month-list rise rise-4">
      <header className="month-list__head">
        <h3>
          전체 일정
          {entries.length > 0 && <span className="count">{entries.length}</span>}
        </h3>

        {chips.length > 1 && (
          <div className="filters" role="group" aria-label="종류로 거르기">
            <button
              type="button"
              className={filter === null ? 'filter on' : 'filter'}
              aria-pressed={filter === null}
              onClick={() => setFilter(null)}
            >
              전체
            </button>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={filter === c.key ? 'filter on' : 'filter'}
                aria-pressed={filter === c.key}
                onClick={() => setFilter(filter === c.key ? null : c.key)}
              >
                {c.emoji && <span aria-hidden="true">{c.emoji}</span>}
                {c.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {shown.length === 0 ? (
        <p className="month-list__empty">
          {entries.length === 0 ? '아직 저장한 일정이 없어요' : '이 종류의 일정이 없어요'}
        </p>
      ) : (
        <ul className="month-list__items">
          {shown.map(({ entry, next }) => {
            const ico = findIcon(entry.icon)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="list-row"
                  disabled={!next}
                  onClick={() => next && onJump(next)}
                  title={next ? '달력에서 보기' : '앞으로 예정된 날짜가 없어요'}
                >
                  <span className="list-when">
                    <span className="list-rule">{scheduleLabel(entry)}</span>
                    <span className="list-next">
                      {next ? formatNext(next, today) : '지난 일정'}
                    </span>
                  </span>

                  <span className="list-body">
                    <span className="list-title">
                      {ico && <span aria-hidden="true">{ico.emoji} </span>}
                      {entry.title}
                    </span>
                    {entry.memo && <span className="list-memo">{entry.memo}</span>}
                  </span>

                  <span className="list-author">{entry.author?.name ?? ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** 예정일이 가까운 순. 예정 없는(지난) 일정은 맨 뒤로. */
function byNextThenTitle(
  a: { entry: EntryWithAuthor; next: Date | null },
  b: { entry: EntryWithAuthor; next: Date | null },
): number {
  if (a.next && b.next) return a.next.getTime() - b.next.getTime()
  if (a.next) return -1
  if (b.next) return 1
  return a.entry.title.localeCompare(b.entry.title, 'ko')
}

/** 반복 일정은 날짜 하나로 못 적는다. 규칙 자체를 문장으로 보여준다. */
function scheduleLabel(e: EntryWithAuthor): string {
  const base = parseISODate(e.event_date)

  if (e.date_type === 'lunar' && e.repeat === 'yearly' && e.lunar_month && e.lunar_day) {
    return `매년 음력 ${e.lunar_month}.${e.lunar_day}`
  }
  if (e.repeat === 'yearly') return `매년 ${base.getMonth() + 1}.${base.getDate()}`
  if (e.repeat === 'monthly') return `매월 ${base.getDate()}일`
  return `${base.getFullYear()}.${base.getMonth() + 1}.${base.getDate()}`
}

function formatNext(next: Date, today: Date): string {
  const days = Math.round(
    (new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  )
  const weekday = WEEKDAY_LABELS[next.getDay()]
  const date = `${next.getMonth() + 1}월 ${next.getDate()}일(${weekday})`

  if (days === 0) return `오늘 · ${date}`
  if (days === 1) return `내일 · ${date}`
  return `${days}일 뒤 · ${date}`
}
