import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Users, Calendar } from 'lucide-react'

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const isSubPage = location.pathname.startsWith('/session/') || location.pathname === '/members'
  const isMembers = location.pathname === '/members'

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center px-4 sm:px-6">
      <div className="flex items-center gap-3 flex-1">
        {isSubPage ? (
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">V</span>
            </div>
          </div>
        )}
        <h1 className="text-lg font-semibold text-gray-900 truncate">
          {isMembers ? 'Members' : location.pathname.startsWith('/session/') ? 'Session Details' : 'Vision Attendance'}
        </h1>
      </div>

      <div className="flex items-center gap-1">
        {!isMembers && (
          <button
            onClick={() => navigate('/members')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Members"
          >
            <Users className="w-5 h-5" />
          </button>
        )}
        {isMembers && (
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Sessions"
          >
            <Calendar className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
