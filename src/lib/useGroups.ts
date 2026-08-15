import { useCallback, useEffect, useState } from 'react'
import { fetchMyGroups } from './api'
import { errorMessage } from './errors'
import type { Group } from './types'

const LAST_GROUP_KEY = 'share-calendar:last-group'

export function useGroups(enabled: boolean) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchMyGroups()
      setGroups(list)
      setError(null)
      setSelectedId((current) => {
        if (current && list.some((g) => g.id === current)) return current
        const remembered = localStorage.getItem(LAST_GROUP_KEY)
        if (remembered && list.some((g) => g.id === remembered)) return remembered
        return list[0]?.id ?? null
      })
    } catch (e) {
      setError(errorMessage(e, '그룹을 불러오지 못했어요'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    localStorage.setItem(LAST_GROUP_KEY, id)
  }, [])

  return { groups, selectedId, select, loading, error, reload }
}
