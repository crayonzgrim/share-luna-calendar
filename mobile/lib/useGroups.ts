import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchMyGroups } from '../../src/lib/api'
import { errorMessage } from '../../src/lib/errors'
import type { Group } from '../../src/lib/types'

/** 웹과 같은 키. 저장소만 localStorage → AsyncStorage로 갈린다. */
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
      // AsyncStorage는 비동기라 setState 업데이터 안에서 읽을 수 없다. 미리 꺼내둔다.
      const remembered = await AsyncStorage.getItem(LAST_GROUP_KEY)
      setGroups(list)
      setError(null)
      setSelectedId((current) => {
        if (current && list.some((g) => g.id === current)) return current
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
    void AsyncStorage.setItem(LAST_GROUP_KEY, id)
  }, [])

  return { groups, selectedId, select, loading, error, reload }
}
