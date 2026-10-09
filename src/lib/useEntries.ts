import { useCallback, useEffect, useState } from 'react'
import { createEntry, deleteEntry, fetchEntries, removeEntryImages, updateEntry } from './api'
import type { EntryPatch, NewEntry } from './api'
import { errorMessage } from './errors'
import type { EntryWithAuthor } from './types'

export function useEntries(groupId: string | null) {
  const [entries, setEntries] = useState<EntryWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!groupId) {
      setEntries([])
      return
    }
    setLoading(true)
    try {
      setEntries(await fetchEntries(groupId))
      setError(null)
    } catch (e) {
      setError(errorMessage(e, '일정을 불러오지 못했어요'))
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(async (entry: NewEntry) => {
    const created = await createEntry(entry)
    setEntries((prev) => [...prev, created])
  }, [])

  // 사진 파일 정리는 일정 저장이 끝난 뒤의 덤이다. 실패해도 화면엔 알리지 않는다 —
  // 일정은 이미 저장됐고, 남은 파일은 아무 일정도 가리키지 않아 보이지 않는다.
  // ponytail: 그룹 삭제(cascade)로 사라진 일정의 사진은 Storage에 남는다. 용량이 문제 되면 정리 함수를 둘 것.
  const edit = useCallback(async (id: string, patch: EntryPatch) => {
    const before = entries.find((e) => e.id === id)?.image_paths ?? []
    const updated = await updateEntry(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    const kept = new Set(updated.image_paths ?? [])
    void removeEntryImages(before.filter((p) => !kept.has(p))).catch(() => {})
  }, [entries])

  const remove = useCallback(async (id: string) => {
    const paths = entries.find((e) => e.id === id)?.image_paths ?? []
    await deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    void removeEntryImages(paths).catch(() => {})
  }, [entries])

  return { entries, loading, error, add, edit, remove, reload }
}
