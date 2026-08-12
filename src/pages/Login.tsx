import { signInWithKakao } from '../lib/useAuth'

export default function Login() {
  return (
    <main className="login">
      <span className="eyebrow rise">가족·친구와 함께</span>
      <h1 className="rise rise-1">우리 달력</h1>
      <p className="login__sub rise rise-2">
        음력 생신도, 제사도 매년 알아서 자리를 찾아갑니다.
      </p>

      <button
        type="button"
        className="kakao-btn rise rise-3"
        onClick={() => void signInWithKakao()}
      >
        카카오로 시작하기
        <span className="cta__icon" aria-hidden="true">↗</span>
      </button>
    </main>
  )
}
