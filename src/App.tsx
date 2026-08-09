import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Login from './pages/Login.tsx'
import Join from './pages/Join.tsx'
import CalendarPage from './pages/CalendarPage.tsx'
import Groups from './pages/Groups.tsx'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="center-msg">불러오는 중…</div>

  // 비로그인 상태에서는 어떤 경로로 들어와도 로그인 화면을 보여준다.
  // 로그인 후 같은 경로로 돌아오므로(useAuth의 redirectTo) 초대 링크가 이어진다.
  if (!user) return <Login />

  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
