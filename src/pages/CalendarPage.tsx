import { useState } from 'react'
import { Link } from 'react-router-dom'
import GroupSwitcher from '../components/GroupSwitcher.tsx'
import MonthGrid from '../components/MonthGrid.tsx'
import DayPanel from '../components/DayPanel.tsx'
import { shiftMonth } from '../lib/calendar'
import { signOut, useAuth } from '../lib/useAuth'
import { useEntries } from '../lib/useEntries'
import { useGroups } from '../lib/useGroups'

export default function CalendarPage() {
  const { user } = useAuth()
  const { groups, selectedId, select, loading: groupsLoading, error: groupsError } = useGroups(!!user)
  const { entries, add, remove, error: entriesError } = useEntries(selectedId)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selected, setSelected] = useState(today)

  function move(delta: number) {
    const [y, m] = shiftMonth(year, month, delta)
    setYear(y)
    setMonth(m)
  }

  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setSelected(now)
  }

  if (groupsLoading) return <div className="center-msg">불러오는 중…</div>

  if (groups.length === 0) {
    return (
      <div className="center-msg">
        <p>아직 속한 그룹이 없어요.</p>
        <Link to="/groups" className="link-btn">그룹 만들기</Link>
        {groupsError && <p className="error">{groupsError}</p>}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <GroupSwitcher groups={groups} selectedId={selectedId} onSelect={select} />
        <button type="button" className="link-btn" onClick={() => void signOut()}>로그아웃</button>
      </header>

      <nav className="month-nav">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <h2>{year}.{String(month).padStart(2, '0')}</h2>
        <button type="button" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button type="button" className="today-btn" onClick={goToday}>오늘</button>
      </nav>

      {(groupsError ?? entriesError) && <p className="error">{groupsError ?? entriesError}</p>}

      <div className="calendar-layout">
        <MonthGrid
          year={year}
          month={month}
          entries={entries}
          selected={selected}
          onSelect={setSelected}
        />

        <DayPanel
          date={selected}
          groupId={selectedId}
          userId={user?.id ?? ''}
          entries={entries}
          onAdd={add}
          onDelete={remove}
        />
      </div>
    </div>
  )
}
