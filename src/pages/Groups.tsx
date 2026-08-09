import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createGroup, fetchGroupMembers } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { useGroups } from '../lib/useGroups'
import type { Profile } from '../lib/types'

export default function Groups() {
  const { user } = useAuth()
  const { groups, reload } = useGroups(!!user)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<Record<string, Profile[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    for (const g of groups) {
      fetchGroupMembers(g.id)
        .then((list) => setMembers((prev) => ({ ...prev, [g.id]: list })))
        .catch(() => {})
    }
  }, [groups])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    try {
      await createGroup(name.trim(), user.id)
      setName('')
      setError(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '그룹을 만들지 못했어요')
    }
  }

  async function copyInvite(code: string) {
    const url = `${window.location.origin}/join/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // 클립보드 권한이 없으면(HTTP 등) 직접 복사할 수 있게 보여준다
      setError(url)
    }
  }

  return (
    <div className="app">
      <header className="topbar rise">
        <Link to="/" className="pill">← 달력</Link>
      </header>

      <div className="page-head rise rise-1">
        <span className="eyebrow">그룹</span>
        <h2>함께 보는 사람들</h2>
      </div>

      <p className="section-label">내 그룹</p>
      <ul className="group-list">
        {groups.length === 0 && (
          <li className="shell rise rise-2">
            <div className="core empty-card">아직 그룹이 없어요</div>
          </li>
        )}
        {groups.map((g, i) => (
          <li key={g.id} className="shell rise rise-2" style={{ animationDelay: `${0.13 + i * 0.06}s` }}>
            <div className="core group-card">
              <div className="group-card__name">{g.name}</div>
              <p className="members">
                {(members[g.id] ?? []).map((m) => m.name).join(', ') || '멤버 불러오는 중…'}
              </p>
              <button
                type="button"
                className={copied === g.invite_code ? 'copy-btn done' : 'copy-btn'}
                onClick={() => void copyInvite(g.invite_code)}
              >
                {copied === g.invite_code ? '복사됨' : '초대 링크 복사'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="section-label">새 그룹 만들기</p>
      <div className="shell rise rise-3">
        <div className="core group-card">
          <form className="entry-form" onSubmit={(e) => void submit(e)}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리 가족"
              maxLength={50}
              required
            />
            <button type="submit" disabled={!name.trim()}>만들기</button>
          </form>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
