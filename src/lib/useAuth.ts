import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, user: session?.user ?? null, loading }
}

/**
 * redirectTo가 origin이 아니라 현재 경로인 이유:
 * 초대 링크(/join/abc123)로 들어온 사람이 로그인 후 그 경로로 돌아와야 그룹 가입이 이어진다.
 */
export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
