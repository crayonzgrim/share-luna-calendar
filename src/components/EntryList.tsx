import { useState } from 'react'
import { WEEKDAY_LABELS } from '../lib/calendar'
import { ENTRY_ICONS, findIcon } from '../lib/icons'
import { solarToLunar } from '../lib/lunar'
import { occurrencesInYear, parseISODate } from '../lib/recurrence'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  entries: EntryWithAuthor[]
  onJump: (d: Date) => void
}

/** 종류 없는 항목을 거를 때 쓰는 값. 실제 key와 겹치지 않게 둔다. */
const NONE = ' none'

type Row = { entry: EntryWithAuthor; date: Date | null }

export default function EntryList({ entries, onJump }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [filter, setFilter] = useState<string | null>(null)

  const rows: Row[] = entries
    .map((entry) => {
      const dates = occurrencesInYear(entry, year)
      // 매월 반복을 12줄로 늘어놓으면 목록이 묻힌다. 첫 날짜만 대표로 쓴다.
      return { entry, date: dates[0] ?? null }
    })
    .filter((r) => r.date !== null || r.entry.repeat !== 'none')
    .sort(byDate)

  // 실제로 있는 종류만 칩으로 — 눌러도 빈 목록인 칩은 만들지 않는다
  const present = new Set(rows.map((r) => r.entry.icon ?? NONE))
  const chips = [
    ...ENTRY_ICONS.filter((i) => present.has(i.key)),
    ...(present.has(NONE) ? [{ key: NONE, emoji: '', label: '종류 없음' }] : []),
  ]

  const shown = filter ? rows.filter((r) => (r.entry.icon ?? NONE) === filter) : rows
  const thisYear = new Date().getFullYear()

  return (
    <section className="month-list rise rise-4">
      <header className="month-list__head">
        <div className="year-nav">
          <button type="button" className="nav-btn" onClick={() => setYear(year - 1)} aria-label="이전 해">‹</button>
          <span className="year-nav__label">
            {year}년 일정
            {rows.length > 0 && <span className="count">{rows.length}</span>}
          </span>
          <button type="button" className="nav-btn" onClick={() => setYear(year + 1)} aria-label="다음 해">›</button>
          {year !== thisYear && (
            <button type="button" className="link-btn" onClick={() => setYear(thisYear)}>올해로</button>
          )}
        </div>

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
          {rows.length === 0 ? `${year}년에는 일정이 없어요` : '이 종류의 일정이 없어요'}
        </p>
      ) : (
        <ul className="month-list__items">
          {shown.map(({ entry, date }) => {
            const ico = findIcon(entry.icon)
            const lunar = date ? solarToLunar(date) : null
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="list-row"
                  disabled={!date}
                  onClick={() => date && onJump(date)}
                  title={date ? '달력에서 보기' : undefined}
                >
                  <span className="list-when">
                    <span className="list-rule">
                      {date
                        ? `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`
                        // 음력 변환은 2050년까지만 가능하다
                        : '날짜 계산 범위 밖'}
                    </span>
                    <span className="list-next">
                      {entry.repeat === 'monthly'
                        ? `매월 ${parseISODate(entry.event_date).getDate()}일`
                        : lunar
                          ? `음력 ${lunar.month}.${lunar.day}${entry.repeat === 'yearly' ? ' · 매년' : ''}`
                          : ''}
                    </span>
                  </span>

                  <span className="list-body">
                    <span className="list-title">
                      {ico && <span aria-hidden="true">{ico.emoji} </span>}
                      {entry.title}
                    </span>
                    {entry.date_type === 'lunar' && <span className="badge badge--lunar">음력</span>}
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

/** 그 해 날짜순. 날짜가 없는(매월) 항목은 맨 뒤. */
function byDate(a: Row, b: Row): number {
  if (a.date && b.date) return a.date.getTime() - b.date.getTime()
  if (a.date) return -1
  if (b.date) return 1
  return a.entry.title.localeCompare(b.entry.title, 'ko')
}
