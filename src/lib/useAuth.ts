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

export function signInWithKakao() {
  // 초대 링크(/join/abc123)로 들어온 사람이 로그인 후 원래 경로로 돌아와야
  // 그룹 가입이 이어진다. origin만 주면 초대 코드가 날아간다.
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
