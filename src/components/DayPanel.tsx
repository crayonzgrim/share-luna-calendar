import { useState } from 'react'
import { isSameDay } from '../lib/calendar'
import { ENTRY_ICONS, findIcon } from '../lib/icons'
import { lunarToSolarClamped, solarToLunar } from '../lib/lunar'
import { occurrencesInMonth, toISODate } from '../lib/recurrence'
import type { DateType, RepeatRule } from '../lib/recurrence'
import type { EntryPatch, NewEntry } from '../lib/api'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  date: Date
  groupId: string | null
  userId: string
  entries: EntryWithAuthor[]
  onAdd: (e: NewEntry) => Promise<void>
  onEdit: (id: string, patch: EntryPatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DayPanel({
  date, groupId, userId, entries, onAdd, onEdit, onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [dateType, setDateType] = useState<DateType>('solar')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)

  // 이 날에 실제로 표시되는 항목들 (반복 전개 결과 포함)
  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1).some((d) => isSameDay(d, date)),
  )

  function reset() {
    setEditingId(null)
    setTitle('')
    setMemo('')
    setIcon(null)
    setRepeat('none')
    setDateType('solar')
    setError(null)
  }

  function startEdit(e: EntryWithAuthor) {
    setEditingId(e.id)
    setTitle(e.title)
    setMemo(e.memo ?? '')
    setIcon(e.icon)
    setRepeat(e.repeat)
    setDateType(e.date_type)
    setError(null)
  }

  // 음력은 매월 반복을 지원하지 않으므로 선택지를 되돌린다
  function changeDateType(next: DateType) {
    setDateType(next)
    if (next === 'lunar' && repeat === 'monthly') setRepeat('yearly')
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!groupId || !title.trim() || saving) return

    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        // 날짜 관련 필드는 건드리지 않는다. 반복 일정의 기준일이 조용히 옮겨가면
        // 다른 달에 찍히던 날짜까지 바뀌어 사용자가 예상하지 못한 결과가 된다.
        await onEdit(editingId, {
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          repeat,
        })
      } else {
        const isLunar = dateType === 'lunar'
        if (isLunar && !lunar) {
          setError('이 날짜는 음력으로 바꿀 수 없어요 (지원 범위 밖)')
          return
        }
        await onAdd({
          group_id: groupId,
          author_id: userId,
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          date_type: dateType,
          repeat,
          event_date: toISODate(date),
          lunar_month: lunar && isLunar ? lunar.month : null,
          lunar_day: lunar && isLunar ? lunar.day : null,
          is_leap_month: lunar && isLunar ? lunar.isLeap : false,
        })
      }
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="shell rise rise-3">
      <section className="core day-panel">
        <header className="day-panel__head">
          <span className="day-panel__date">
            {date.getMonth() + 1}월 {date.getDate()}일
          </span>
          {lunar && <span className="lunar-label">음력 {lunar.month}.{lunar.day}</span>}
        </header>

        <ul className="entry-list">
          {dayEntries.length === 0 && <li className="empty">아직 계획이 없어요</li>}
          {dayEntries.map((e, i) => {
            const ico = findIcon(e.icon)
            return (
              <li
                key={e.id}
                className={editingId === e.id ? 'editing' : undefined}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div>
                  {ico && <span className="entry-emoji" title={ico.label}>{ico.emoji}</span>}
                  <span className="entry-title">{e.title}</span>
                  {e.date_type === 'lunar' && <span className="badge badge--lunar">음력</span>}
                  {e.repeat !== 'none' && (
                    <span className="badge">{e.repeat === 'yearly' ? '매년' : '매월'}</span>
                  )}
                  {e.memo && <p className="memo">{e.memo}</p>}
                  <small className="author">{e.author?.name ?? '알 수 없음'}</small>
                </div>

                {e.author_id === userId && (
                  <span className="row-actions">
                    <button
                      type="button"
                      className="row-btn"
                      onClick={() => (editingId === e.id ? reset() : startEdit(e))}
                    >
                      {editingId === e.id ? '취소' : '수정'}
                    </button>
                    <button
                      type="button"
                      className="row-btn danger"
                      onClick={() => void onDelete(e.id)}
                    >
                      삭제
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <form className="entry-form" onSubmit={(ev) => void submit(ev)}>
          {editingId && <p className="form-mode">수정 중 — 날짜는 그대로 두고 내용만 바꿉니다</p>}

          <input
            value={title}
            onChange={(ev) => setTitle(ev.target.value)}
            placeholder="무엇을 할 예정인가요?"
            maxLength={200}
            required
          />
          <textarea
            value={memo}
            onChange={(ev) => setMemo(ev.target.value)}
            placeholder="메모 (선택)"
            rows={2}
            maxLength={2000}
          />

          <div className="icon-picker" role="group" aria-label="일정 종류">
            {ENTRY_ICONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={icon === opt.key ? 'icon-opt on' : 'icon-opt'}
                aria-pressed={icon === opt.key}
                aria-label={opt.label}
                title={opt.label}
                // 같은 걸 다시 누르면 해제된다
                onClick={() => setIcon(icon === opt.key ? null : opt.key)}
              >
                <span aria-hidden="true">{opt.emoji}</span>
                <span className="icon-opt__label" aria-hidden="true">{opt.short}</span>
              </button>
            ))}
          </div>

          <div className="form-row">
            <div className="segment">
              <label>
                <input
                  type="radio"
                  name="date-type"
                  checked={dateType === 'solar'}
                  disabled={!!editingId}
                  onChange={() => changeDateType('solar')}
                />
                양력
              </label>
              <label>
                <input
                  type="radio"
                  name="date-type"
                  checked={dateType === 'lunar'}
                  disabled={!!editingId}
                  onChange={() => changeDateType('lunar')}
                />
                음력
              </label>
            </div>

            <select
              value={repeat}
              onChange={(ev) => setRepeat(ev.target.value as RepeatRule)}
              aria-label="반복"
            >
              <option value="none">반복 없음</option>
              <option value="yearly">매년</option>
              {dateType === 'solar' && <option value="monthly">매월</option>}
            </select>
          </div>

          {!editingId && dateType === 'lunar' && repeat === 'yearly' && lunar && (
            <p className="hint">
              매년 음력 {lunar.month}월 {lunar.day}일에 표시돼요.
              {' '}내년엔 {nextYearLabel(lunar.month, lunar.day, date.getFullYear() + 1)}.
            </p>
          )}

          {error && <p className="error">{error}</p>}

          <div className="form-actions">
            {editingId && (
              <button type="button" className="ghost-btn" onClick={reset}>취소</button>
            )}
            <button type="submit" disabled={saving || !title.trim()}>
              {saving ? '저장 중…' : editingId ? '저장' : '추가'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function nextYearLabel(month: number, day: number, year: number): string {
  const d = lunarToSolarClamped(year, month, day)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산할 수 없어요'
}
