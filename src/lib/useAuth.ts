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

// ponytail: 아래 이메일 로그인은 개발용 임시 경로다.
// Supabase가 카카오에 account_email 스코프를 강제로 요청하는데 개인 앱에는 그 권한이
// 없어 KOE205로 막힌다(supabase/supabase#36878). 카카오 비즈 앱 전환이 승인되면
// 이 두 함수와 Login.tsx의 폼을 지우면 된다.

export async function signUpWithEmail(email: string, password: string, name: string) {
  // name은 raw_user_meta_data로 들어가고 handle_new_user 트리거가 profiles에 옮겨 담는다
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}
