import { useState } from 'react'
import { Link } from 'react-router-dom'
import GroupSwitcher from '../components/GroupSwitcher.tsx'
import MonthGrid from '../components/MonthGrid.tsx'
import MonthList from '../components/MonthList.tsx'
import DayPanel from '../components/DayPanel.tsx'
import { shiftMonth } from '../lib/calendar'
import { signOut, useAuth } from '../lib/useAuth'
import { useEntries } from '../lib/useEntries'
import { useGroups } from '../lib/useGroups'

export default function CalendarPage() {
  const { user } = useAuth()
  const { groups, selectedId, select, loading: groupsLoading, error: groupsError } = useGroups(!!user)
  const { entries, add, edit, remove, error: entriesError } = useEntries(selectedId)

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
        <span className="eyebrow">시작하기</span>
        <p>아직 속한 그룹이 없어요.<br />달력을 함께 볼 그룹을 만들어 보세요.</p>
        <Link to="/groups" className="cta">
          그룹 만들기
          <span className="cta__icon" aria-hidden="true">↗</span>
        </Link>
        {groupsError && <p className="error">{groupsError}</p>}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar rise">
        <GroupSwitcher groups={groups} selectedId={selectedId} onSelect={select} />
        <button type="button" className="pill" onClick={() => void signOut()}>
          로그아웃
        </button>
      </header>

      <nav className="month-nav rise rise-1">
        <span className="month-nav__label">
          <span className="month-nav__year">{year}</span>
          <span className="month-nav__month">{month}</span>
          <span className="month-nav__suffix">월</span>
        </span>
        <button type="button" className="nav-btn" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <button type="button" className="nav-btn" onClick={goToday} aria-label="오늘로">·</button>
        <button type="button" className="nav-btn" onClick={() => move(1)} aria-label="다음 달">›</button>
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
          onEdit={edit}
          onDelete={remove}
        />
      </div>

      <MonthList
        year={year}
        month={month}
        entries={entries}
        selected={selected}
        onSelect={setSelected}
      />
    </div>
  )
}
