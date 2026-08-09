import { useState } from 'react'
import { signInWithEmail, signInWithKakao, signUpWithEmail } from '../lib/useAuth'

export default function Login() {
  return (
    <main className="login">
      <h1>우리 달력</h1>
      <p>가족·친구와 함께 쓰는 달력이에요.</p>
      <button type="button" className="kakao-btn" onClick={() => void signInWithKakao()}>
        카카오로 시작하기
      </button>

      <DevEmailLogin />
    </main>
  )
}

/**
 * 개발용 임시 로그인.
 * 카카오 비즈 앱 전환이 승인되면 이 컴포넌트와 useAuth의 이메일 함수를 통째로 지운다.
 */
function DevEmailLogin() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name.trim() || email.split('@')[0])
        // 이메일 확인이 켜져 있으면 세션 없이 끝난다 — 그 경우를 알려준다
        setNotice('가입 요청됨. 화면이 안 바뀌면 이메일 확인이 필요한 설정입니다.')
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="dev-login">
      <summary>개발용 임시 로그인</summary>

      <form className="entry-form" onSubmit={(e) => void submit(e)}>
        {mode === 'signup' && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (달력에 표시됩니다)"
            maxLength={20}
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={6}
          required
        />

        <button type="submit" disabled={busy}>
          {busy ? '처리 중…' : mode === 'signup' ? '가입하기' : '로그인'}
        </button>
      </form>

      <button
        type="button"
        className="link-btn"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setNotice(null)
        }}
      >
        {mode === 'signin' ? '계정이 없어요 — 가입하기' : '이미 계정이 있어요 — 로그인'}
      </button>

      {error && <p className="error">{error}</p>}
      {notice && <p className="hint">{notice}</p>}
    </details>
  )
}
