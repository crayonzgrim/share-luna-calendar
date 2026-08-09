import { signInWithKakao } from '../lib/useAuth'

export default function Login() {
  return (
    <main className="login">
      <h1>우리 달력</h1>
      <p>가족·친구와 함께 쓰는 달력이에요.</p>
      <button type="button" className="kakao-btn" onClick={() => void signInWithKakao()}>
        카카오로 시작하기
      </button>
    </main>
  )
}
