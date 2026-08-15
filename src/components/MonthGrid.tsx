import { buildMonthGrid, isSameDay, WEEKDAY_LABELS } from '../lib/calendar'
import { findIcon } from '../lib/icons'
import { solarToLunar } from '../lib/lunar'
import { expandMonth } from '../lib/recurrence'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  year: number
  month: number
  entries: EntryWithAuthor[]
  selected: Date
  onSelect: (d: Date) => void
}

export default function MonthGrid({ year, month, entries, selected, onSelect }: Props) {
  const cells = buildMonthGrid(year, month)
  const today = new Date()

  // 이 달에 표시할 항목을 날짜별로 모아둔다.
  // 아래 목록(MonthList)과 같은 전개 결과를 쓰도록 expandMonth를 공유한다.
  const byDate = new Map<string, EntryWithAuthor[]>()
  for (const { date, entry } of expandMonth(entries, year, month)) {
    const key = date.toDateString()
    const list = byDate.get(key)
    if (list) list.push(entry)
    else byDate.set(key, [entry])
  }

  return (
    <div className="shell rise rise-2">
      <div className="core">
        <div className="month-grid">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="weekday">{label}</div>
          ))}

          {cells.map((date) => {
            const inMonth = date.getMonth() === month - 1
            const lunar = solarToLunar(date)
            const dayEntries = byDate.get(date.toDateString()) ?? []
            const classes = [
              'cell',
              inMonth ? '' : 'outside',
              isSameDay(date, today) ? 'today' : '',
              isSameDay(date, selected) ? 'selected' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                type="button"
                key={date.toDateString()}
                className={classes}
                onClick={() => onSelect(date)}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일, 일정 ${dayEntries.length}건`}
              >
                <span className="day-nums">
                  <span className="solar-day">{date.getDate()}</span>
                  {lunar && <span className="lunar-day">{lunar.month}.{lunar.day}</span>}
                </span>

                <span className="cell-entries">
                  {dayEntries.slice(0, 3).map((e) => {
                    const ico = findIcon(e.icon)
                    return (
                      <span
                        key={e.id}
                        className={ico ? 'entry-chip has-emoji' : 'entry-chip'}
                        title={ico ? `${ico.label} · ${e.title}` : e.title}
                      >
                        {ico && <span className="chip-emoji" aria-hidden="true">{ico.emoji}</span>}
                        <span className="chip-text">{e.title}</span>
                      </span>
                    )
                  })}
                  {dayEntries.length > 3 && (
                    <span className="entry-more">+{dayEntries.length - 3}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
