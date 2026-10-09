import { useState } from 'react'
import { MAX_ENTRY_IMAGES, removeEntryImages, uploadEntryImage } from '../lib/api'
import { isSameDay } from '../lib/calendar'
import { errorMessage } from '../lib/errors'
import { ENTRY_ICONS, findIcon } from '../lib/icons'
import { lunarToSolarClamped, solarToLunar } from '../lib/lunar'
import { occurrencesInMonth, toISODate } from '../lib/recurrence'
import type { DateType, RepeatRule } from '../lib/recurrence'
import type { EntryPatch, NewEntry } from '../lib/api'
import type { EntryWithAuthor } from '../lib/types'
import { useImageUrls } from '../lib/useImageUrls'

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
  // 이미 올라간 사진(경로)과 이번에 고른 사진(줄인 JPEG + 미리보기 주소)을 따로 든다.
  // 고른 사진은 저장을 누를 때 올린다 — 취소하면 Storage에 쓰레기가 남지 않는다.
  // ponytail: 미리보기 object URL은 revoke하지 않는다. 장당 수백 KB이고 새로고침하면 사라진다.
  const [keptPaths, setKeptPaths] = useState<string[]>([])
  const [newImages, setNewImages] = useState<{ blob: Blob; url: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)

  // 이 날에 실제로 표시되는 항목들 (반복 전개 결과 포함)
  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1).some((d) => isSameDay(d, date)),
  )
  const urls = useImageUrls(dayEntries.flatMap((e) => e.image_paths ?? []))
  const imageCount = keptPaths.length + newImages.length

  function reset() {
    setEditingId(null)
    setTitle('')
    setMemo('')
    setIcon(null)
    setRepeat('none')
    setDateType('solar')
    setKeptPaths([])
    setNewImages([])
    setError(null)
  }

  function startEdit(e: EntryWithAuthor) {
    setEditingId(e.id)
    setTitle(e.title)
    setMemo(e.memo ?? '')
    setIcon(e.icon)
    setRepeat(e.repeat)
    setDateType(e.date_type)
    setKeptPaths(e.image_paths ?? [])
    setNewImages([])
    setError(null)
  }

  async function pickImages(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, MAX_ENTRY_IMAGES - imageCount)
    try {
      const blobs = await Promise.all(picked.map(shrink))
      setNewImages((prev) => [...prev, ...blobs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))])
    } catch (err) {
      setError(errorMessage(err, '사진을 불러오지 못했어요'))
    }
  }

  function removeImage(i: number) {
    if (i < keptPaths.length) setKeptPaths((prev) => prev.filter((_, j) => j !== i))
    else setNewImages((prev) => prev.filter((_, j) => j !== i - keptPaths.length))
  }

  // 음력은 매월 반복을 지원하지 않으므로 선택지를 되돌린다
  function changeDateType(next: DateType) {
    setDateType(next)
    if (next === 'lunar' && repeat === 'monthly') setRepeat('yearly')
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!groupId || !title.trim() || saving) return

    const isLunar = dateType === 'lunar'
    if (!editingId && isLunar && !lunar) {
      setError('이 날짜는 음력으로 바꿀 수 없어요 (지원 범위 밖)')
      return
    }

    setSaving(true)
    setError(null)
    const uploaded: string[] = []
    try {
      // 하나씩 올린다 — 중간에 실패해도 어디까지 올라갔는지 알아야 치울 수 있다
      for (const img of newImages) {
        uploaded.push(await uploadEntryImage(groupId, userId, img.blob))
      }
      const image_paths = [...keptPaths, ...uploaded]

      if (editingId) {
        // 날짜 관련 필드는 건드리지 않는다. 반복 일정의 기준일이 조용히 옮겨가면
        // 다른 달에 찍히던 날짜까지 바뀌어 사용자가 예상하지 못한 결과가 된다.
        await onEdit(editingId, {
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          repeat,
          image_paths,
        })
      } else {
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
          image_paths,
        })
      }
      reset()
    } catch (err) {
      // 일정이 저장되지 않았으니 방금 올린 사진은 아무도 안 가리킨다
      void removeEntryImages(uploaded).catch(() => {})
      setError(errorMessage(err, '저장하지 못했어요'))
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
                  {!!e.image_paths?.length && (
                    <div className="thumbs">
                      {e.image_paths.map((p, j) => (
                        // 크게 보기는 새 탭에 맡긴다 — 브라우저가 확대·저장을 다 해준다
                        <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="thumb">
                          {urls[p] && <img src={urls[p]} alt={`사진 ${j + 1}`} />}
                        </a>
                      ))}
                    </div>
                  )}
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

          {imageCount > 0 && (
            <div className="thumbs">
              {[...keptPaths.map((p) => urls[p]), ...newImages.map((n) => n.url)].map((url, i) => (
                <span key={`${i}-${url}`} className="thumb">
                  {url && <img src={url} alt={`사진 ${i + 1}`} />}
                  <button
                    type="button"
                    className="thumb__remove"
                    aria-label={`사진 ${i + 1} 빼기`}
                    onClick={() => removeImage(i)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {imageCount < MAX_ENTRY_IMAGES && (
            <label className="ghost-btn photo-btn">
              + 사진 ({imageCount}/{MAX_ENTRY_IMAGES})
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(ev) => {
                  void pickImages(ev.target.files)
                  ev.target.value = '' // 같은 파일을 다시 골라도 onChange가 오게
                }}
              />
            </label>
          )}

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

// 폰 사진은 한 장에 수 MB다. 긴 변 1280px JPEG로 줄이면 수백 KB — 무료 Storage 1GB를 오래 쓴다.
// 버킷이 image/jpeg만 받으므로 PNG·WebP도 여기서 JPEG가 된다.
const MAX_SIDE = 1280

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 줄이지 못했어요'))), 'image/jpeg', 0.8),
  )
}

function nextYearLabel(month: number, day: number, year: number): string {
  const d = lunarToSolarClamped(year, month, day)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산할 수 없어요'
}
