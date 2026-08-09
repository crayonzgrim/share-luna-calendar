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
      <header className="topbar">
        <Link to="/" className="link-btn">← 달력으로</Link>
      </header>

      <h2>내 그룹</h2>
      <ul className="group-list">
        {groups.length === 0 && <li className="empty">아직 그룹이 없어요.</li>}
        {groups.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong>
            <p className="members">
              {(members[g.id] ?? []).map((m) => m.name).join(', ') || '멤버 불러오는 중…'}
            </p>
            <button type="button" onClick={() => void copyInvite(g.invite_code)}>
              {copied === g.invite_code ? '복사됨!' : '초대 링크 복사'}
            </button>
          </li>
        ))}
      </ul>

      <h2>새 그룹 만들기</h2>
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

      {error && <p className="error">{error}</p>}
    </div>
  )
}
