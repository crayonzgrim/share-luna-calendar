import { useEffect, useState } from 'react'
import { signImageUrls } from './api'

/**
 * Storage 경로 → 서명 URL. 웹과 앱이 같이 쓴다.
 * 아직 못 받았거나 실패한 경로는 맵에 없다 — 그 칸은 빈 채로 둔다.
 * ponytail: 날짜를 바꿀 때마다 새로 서명한다. 느려지면 만료 시각과 함께 모듈 캐시를 둘 것.
 */
export function useImageUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = paths.join('|')

  useEffect(() => {
    if (!key) return
    let alive = true
    signImageUrls(key.split('|')).then(
      (signed) => alive && setUrls((prev) => ({ ...prev, ...signed })),
      () => {},
    )
    return () => {
      alive = false
    }
  }, [key])

  return urls
}
