import { useCallback, useEffect, useState } from 'react'
import { createEntry, deleteEntry, fetchEntries, updateEntry } from './api'
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

  const edit = useCallback(async (id: string, patch: EntryPatch) => {
    const updated = await updateEntry(id, patch)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, loading, error, add, edit, remove, reload }
}
