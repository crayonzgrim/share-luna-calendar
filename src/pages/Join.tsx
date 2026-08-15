import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { joinGroupByCode } from '../lib/api'
import { errorMessage } from '../lib/errors'

export default function Join() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    joinGroupByCode(code)
      .then(() => navigate('/', { replace: true }))
      .catch((e: unknown) => setError(errorMessage(e, '가입에 실패했어요')))
  }, [code, navigate])

  if (error) {
    return (
      <div className="center-msg">
        <p className="error">{error}</p>
        <button type="button" onClick={() => navigate('/')}>달력으로</button>
      </div>
    )
  }
  return <div className="center-msg">그룹에 들어가는 중…</div>
}
