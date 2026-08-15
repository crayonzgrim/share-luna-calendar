/**
 * 알 수 없는 예외에서 사람이 읽을 메시지를 뽑는다.
 *
 * supabase-js가 던지는 PostgrestError는 Error 인스턴스가 아니라
 * { message, details, hint, code } 형태의 평범한 객체다.
 * `e instanceof Error`로만 검사하면 DB가 알려준 진짜 원인
 * (컬럼 없음, 정책 위반 등)이 통째로 버려진다.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message

  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.hint].filter((v): v is string => typeof v === 'string' && !!v)
    if (parts.length) {
      const code = typeof o.code === 'string' && o.code ? ` (${o.code})` : ''
      return parts.join(' — ') + code
    }
  }

  if (typeof e === 'string' && e) return e
  return fallback
}
