import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createGroup, fetchGroupMembers, updateGroupName } from '../lib/api'
import { errorMessage } from '../lib/errors'
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
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

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
      setError(errorMessage(err, '그룹을 만들지 못했어요'))
    }
  }

  function startRename(id: string, current: string) {
    setRenamingId(id)
    setDraft(current)
    setError(null)
  }

  async function submitRename(e: React.FormEvent, id: string) {
    e.preventDefault()
    if (!draft.trim()) return
    try {
      await updateGroupName(id, draft.trim())
      setRenamingId(null)
      setError(null)
      await reload()
    } catch (err) {
      setError(errorMessage(err, '이름을 바꾸지 못했어요'))
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
              {/* 이름 변경은 owner만. 그룹을 만든 사람이 트리거로 owner가 되므로
                  created_by로 판별한다 — 멤버 역할을 따로 조회할 필요가 없다.
                  실제 차단은 RLS의 "owner updates group" 정책이 한다. */}
              {renamingId === g.id ? (
                <form className="entry-form" onSubmit={(e) => void submitRename(e, g.id)}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={50}
                    autoFocus
                    required
                  />
                  <div className="form-actions">
                    <button type="button" className="ghost-btn" onClick={() => setRenamingId(null)}>
                      취소
                    </button>
                    <button type="submit" disabled={!draft.trim()}>저장</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="group-card__name">{g.name}</div>
                  <p className="members">
                    {(members[g.id] ?? []).map((m) => m.name).join(', ') || '멤버 불러오는 중…'}
                  </p>
                  <div className="card-actions">
                    <button
                      type="button"
                      className={copied === g.invite_code ? 'copy-btn done' : 'copy-btn'}
                      onClick={() => void copyInvite(g.invite_code)}
                    >
                      {copied === g.invite_code ? '복사됨' : '초대 링크 복사'}
                    </button>
                    {g.created_by === user?.id && (
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => startRename(g.id, g.name)}
                      >
                        이름 수정
                      </button>
                    )}
                  </div>
                </>
              )}
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
