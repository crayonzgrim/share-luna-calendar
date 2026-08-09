import { useState } from 'react'
import { isSameDay } from '../lib/calendar'
import { lunarToSolarClamped, solarToLunar } from '../lib/lunar'
import { occurrencesInMonth, toISODate } from '../lib/recurrence'
import type { DateType, RepeatRule } from '../lib/recurrence'
import type { NewEntry } from '../lib/api'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  date: Date
  groupId: string | null
  userId: string
  entries: EntryWithAuthor[]
  onAdd: (e: NewEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DayPanel({ date, groupId, userId, entries, onAdd, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [dateType, setDateType] = useState<DateType>('solar')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)

  // 이 날에 실제로 표시되는 항목들 (반복 전개 결과 포함)
  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1).some((d) => isSameDay(d, date)),
  )

  // 음력은 매월 반복을 지원하지 않으므로 선택지를 되돌린다
  function changeDateType(next: DateType) {
    setDateType(next)
    if (next === 'lunar' && repeat === 'monthly') setRepeat('yearly')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId || !title.trim() || saving) return

    const isLunar = dateType === 'lunar'
    if (isLunar && !lunar) {
      setError('이 날짜는 음력으로 바꿀 수 없어요 (지원 범위 밖)')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onAdd({
        group_id: groupId,
        author_id: userId,
        title: title.trim(),
        memo: memo.trim() || null,
        date_type: dateType,
        repeat,
        event_date: toISODate(date),
        lunar_month: lunar && isLunar ? lunar.month : null,
        lunar_day: lunar && isLunar ? lunar.day : null,
        is_leap_month: lunar && isLunar ? lunar.isLeap : false,
      })
      setTitle('')
      setMemo('')
      setRepeat('none')
      setDateType('solar')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="day-panel">
      <h3>
        {date.getMonth() + 1}월 {date.getDate()}일
        {lunar && <span className="lunar-label">음력 {lunar.month}.{lunar.day}</span>}
      </h3>

      <ul className="entry-list">
        {dayEntries.length === 0 && <li className="empty">아직 계획이 없어요.</li>}
        {dayEntries.map((e) => (
          <li key={e.id}>
            <div>
              <strong>{e.title}</strong>
              {e.date_type === 'lunar' && <span className="badge">음력</span>}
              {e.repeat !== 'none' && (
                <span className="badge">{e.repeat === 'yearly' ? '매년' : '매월'}</span>
              )}
              {e.memo && <p className="memo">{e.memo}</p>}
              <small className="author">{e.author?.name ?? '알 수 없음'}</small>
            </div>
            {e.author_id === userId && (
              <button type="button" className="del-btn" onClick={() => void onDelete(e.id)}>
                삭제
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="entry-form" onSubmit={(e) => void submit(e)}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇을 할 예정인가요?"
          maxLength={200}
          required
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          maxLength={2000}
        />

        <div className="form-row">
          <label>
            <input
              type="radio"
              name="date-type"
              checked={dateType === 'solar'}
              onChange={() => changeDateType('solar')}
            />
            양력
          </label>
          <label>
            <input
              type="radio"
              name="date-type"
              checked={dateType === 'lunar'}
              onChange={() => changeDateType('lunar')}
            />
            음력
          </label>

          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatRule)}
            aria-label="반복"
          >
            <option value="none">반복 없음</option>
            <option value="yearly">매년</option>
            {dateType === 'solar' && <option value="monthly">매월</option>}
          </select>
        </div>

        {dateType === 'lunar' && repeat === 'yearly' && lunar && (
          <p className="hint">
            매년 음력 {lunar.month}월 {lunar.day}일에 표시돼요
            {' '}(내년엔 {nextYearLabel(lunar.month, lunar.day, date.getFullYear() + 1)}).
          </p>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving || !title.trim()}>
          {saving ? '저장 중…' : '추가'}
        </button>
      </form>
    </section>
  )
}

function nextYearLabel(month: number, day: number, year: number): string {
  const d = lunarToSolarClamped(year, month, day)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산 불가'
}
