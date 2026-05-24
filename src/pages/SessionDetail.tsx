import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  attendanceService,
  userService,
  authService,
} from '@/lib/attendanceService'
import { ApiError } from '@/lib/utils'
import { IAttendanceSession, IAttendance } from '@/types/attendance'
import { IUser } from '@/types/user'
import SearchInput from '@/components/SearchInput'
import RegistrationForm, { RegistrationFormHandle } from '@/components/RegistrationForm'
import { format } from 'date-fns'
import {
  UserPlus,
  Users,
  Calendar,
  Clock,
  Loader2,
  X,
} from 'lucide-react'

type AttendeeTab = 'all' | 'members' | 'first_timers' | 'workers'

function AttendeeList({ attendees, onShowAdd }: { attendees: IAttendance[]; onShowAdd: () => void }) {
  const [tab, setTab] = useState<AttendeeTab>('all')

  const filtered = useMemo(() => {
    if (tab === 'members') return attendees.filter(a => a.user?.churchStatus === 'MEMBER' && a.user?.membershipType !== 'WORKER')
    if (tab === 'first_timers') return attendees.filter(a => a.user?.churchStatus === 'FIRST_TIMER' || a.user?.churchStatus === 'VISITOR')
    if (tab === 'workers') return attendees.filter(a => a.user?.membershipType === 'WORKER')
    return attendees
  }, [attendees, tab])

  const counts = useMemo(() => ({
    all: attendees.length,
    members: attendees.filter(a => a.user?.churchStatus === 'MEMBER' && a.user?.membershipType !== 'WORKER').length,
    first_timers: attendees.filter(a => a.user?.churchStatus === 'FIRST_TIMER' || a.user?.churchStatus === 'VISITOR').length,
    workers: attendees.filter(a => a.user?.membershipType === 'WORKER').length,
  }), [attendees])

  const tabs: { key: AttendeeTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'members', label: 'Members' },
    { key: 'first_timers', label: 'First Timers' },
    { key: 'workers', label: 'Workers' },
  ]

  return (
    <div className="w-full lg:flex-1">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {t.label} ({counts[t.key]})
            </button>
          ))}
        </div>
        {attendees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No attendees yet</p>
            <button onClick={onShowAdd} className="mt-2 text-sm text-emerald-600 hover:underline font-medium">
              Mark attendance
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No {tab.replace('_', ' ')} in this session</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((attendee: IAttendance) => (
              <div key={attendee.id} className="px-4 sm:px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {attendee.user?.firstName} {attendee.user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {attendee.user?.department || 'No department'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(attendee.markedAt), 'hh:mm a')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SessionDetail() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<IAttendanceSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [searchResult, setSearchResult] = useState<IUser[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const formRef = useRef<RegistrationFormHandle>(null)

  const fetchSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const result = await attendanceService.getSessionById(sessionId)
      setSession(result)
    } catch {
      // handled by toast
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const searchMembers = useCallback(async (query: string) => {
    if (query.trim() !== '') {
      setSearchLoading(true)
      try {
        const matches = await userService.searchUsers(query)
        setSearchResult(matches)
        setShowRegistrationForm(matches.length === 0)
      } catch {
        setSearchResult([])
        setShowRegistrationForm(true)
      } finally {
        setSearchLoading(false)
      }
    } else {
      setSearchResult([])
      setShowRegistrationForm(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => searchMembers(memberSearch), 500)
    return () => clearTimeout(timeout)
  }, [memberSearch, searchMembers])

  const handleSingleMark = async (userId: string) => {
    if (!sessionId) return
    try {
      await attendanceService.markAttendance({ userId, sessionId })
      setMemberSearch('')
      setSearchResult([])
      setShowRegistrationForm(false)
      fetchSession()
    } catch {
      // handled by toast
    }
  }

  const handleRegisterUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    setRegistering(true)
    setFieldErrors({})
    try {
      const formData = new FormData(form)
      const payload: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {}
      formData.forEach((value, key) => {
        payload[key] = value
      })
      payload.departmentIds = formData.getAll('departmentIds')
      const res = await authService.register(payload)
      if (res?.user?.id) {
        form.reset()
        formRef.current?.reset()
        await handleSingleMark(res.user.id)
      }
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Session not found</p>
        <button
          onClick={() => navigate('/')}
          className="mt-3 text-sm text-emerald-600 hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  const date = session.startedAt ? new Date(session.startedAt) : null
  const attendees = session.attendees || []
  const markedUserIds = new Set(attendees.map((a) => a.userId))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Session Info */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {session.serviceName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-1">
            {date && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {format(date, 'EEE, dd MMM yyyy')}
              </span>
            )}
            {date && (
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                {format(date, 'hh:mm a')}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <Users className="w-3.5 h-3.5" />
              {attendees.length} attendees
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddPanel(!showAddPanel)}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          Mark Attendance
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Add Attendance Panel */}
        {showAddPanel && (
          <div className="w-full lg:flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col max-h-[60vh] lg:max-h-[calc(100vh-200px)]">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Add Members</h3>
              <button
                onClick={() => {
                  setShowAddPanel(false)
                  setMemberSearch('')
                  setSearchResult([])
                  setShowRegistrationForm(false)
                  setFieldErrors({})
                }}
                className="p-1 rounded hover:bg-gray-200 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-gray-100">
              <SearchInput
                value={memberSearch}
                onChange={setMemberSearch}
                placeholder="Search members..."
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : searchResult.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {searchResult.map((user) => {
                    const userId = user.id || user._id || ''
                    const alreadyMarked = markedUserIds.has(userId)
                    return (
                      <li key={userId}>
                        <button
                          type="button"
                          onClick={() => !alreadyMarked && handleSingleMark(userId)}
                          disabled={alreadyMarked}
                          className={`w-full px-4 py-3 min-h-[44px] flex justify-between items-center text-left transition-colors ${
                            alreadyMarked
                              ? 'opacity-50 cursor-not-allowed bg-gray-50'
                              : 'hover:bg-gray-50 active:bg-gray-100 cursor-pointer'
                          }`}
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {alreadyMarked ? 'Already marked' : user.churchStatus}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : !memberSearch.trim() ? (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-400">
                    Type to search members
                  </p>
                </div>
              ) : showRegistrationForm ? (
                <RegistrationForm
                  ref={formRef}
                  onSubmit={handleRegisterUser}
                  isSubmitting={registering}
                  fieldErrors={fieldErrors}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* Attendee List */}
        <AttendeeList attendees={attendees} onShowAdd={() => setShowAddPanel(true)} />
      </div>
    </div>
  )
}
