import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import SessionDetail from '@/pages/SessionDetail'
import Layout from '@/components/Layout'

function AuthGuard() {
  const token = localStorage.getItem('accessToken')
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/session/:id" element={<SessionDetail />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
