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
 * 내장 'kakao' 프로바이더가 아니라 커스텀 OIDC로 등록한 'custom:kakao'를 쓴다.
 *
 * 내장 프로바이더는 account_email 스코프를 코드에 박아두고 요청하는데,
 * 카카오는 그 권한을 비즈 앱에만 준다. 개인 앱은 KOE205로 거부당하고,
 * 클라이언트에서 넘기는 scopes는 교체가 아니라 추가라 뺄 방법이 없다.
 * 커스텀 OIDC는 스코프를 프로바이더 등록 시점에 우리가 정하므로
 * account_email 없이 nickname/picture만 요청할 수 있다.
 *
 * 스코프는 Supabase 프로바이더 설정에 있으므로 여기서 넘기지 않는다.
 * redirectTo가 현재 경로인 이유: 초대 링크(/join/abc123)로 들어온 사람이
 * 로그인 후 그 경로로 돌아와야 그룹 가입이 이어진다.
 */
export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'custom:kakao',
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
