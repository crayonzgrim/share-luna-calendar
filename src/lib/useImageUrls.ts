import { useEffect, useState } from 'react'
import { signImageUrls } from './api'

// 경로 → { 서명 URL, 만료 시각 }. 화면을 오갈 때마다 새로 서명하면 URL의 토큰이 바뀌어
// 이미지 캐시가 매번 "처음 보는 사진"으로 알고 다시 받는다. 같은 URL을 재사용해야 캐시가 산다.
const cache = new Map<string, { url: string; exp: number }>()
// 서명은 1시간짜리. 만료 직전 URL을 건네면 보는 도중 끊기니 10분 남으면 새로 받는다.
const MARGIN = 10 * 60 * 1000
const SIGN_TTL = 60 * 60 * 1000

function cached(paths: string[]): Record<string, string> {
  const now = Date.now()
  const out: Record<string, string> = {}
  for (const p of paths) {
    const hit = cache.get(p)
    if (hit && hit.exp - now > MARGIN) out[p] = hit.url
  }
  return out
}

/**
 * Storage 경로 → 서명 URL. 웹과 앱이 같이 쓴다.
 * 아직 못 받았거나 실패한 경로는 맵에 없다 — 그 칸은 빈 채로 둔다.
 * 캐시에 있는 건 첫 렌더부터 바로 돌려준다 — 서명 요청을 기다리는 한 박자가 없어진다.
 */
export function useImageUrls(paths: string[]): Record<string, string> {
  const key = paths.join('|')
  const [fetched, setFetched] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!key) return
    const missing = key.split('|').filter((p) => !(p in cached([p])))
    if (missing.length === 0) return
    let alive = true
    const exp = Date.now() + SIGN_TTL
    signImageUrls(missing).then(
      (signed) => {
        for (const [p, url] of Object.entries(signed)) cache.set(p, { url, exp })
        if (alive) setFetched((prev) => ({ ...prev, ...signed }))
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [key])

  return { ...fetched, ...cached(paths) }
}
