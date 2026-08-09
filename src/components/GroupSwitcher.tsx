import { Link } from 'react-router-dom'
import type { Group } from '../lib/types'

type Props = {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function GroupSwitcher({ groups, selectedId, onSelect }: Props) {
  return (
    <div className="group-switcher">
      <select
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="그룹 선택"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <Link to="/groups" className="pill">그룹</Link>
    </div>
  )
}
