import { useState, useEffect, useCallback, useRef } from 'react'
import { userService, authService } from '@/lib/attendanceService'
import { ApiError } from '@/lib/utils'
import { IUser } from '@/types/user'
import SearchInput from '@/components/SearchInput'
import RegistrationForm, { RegistrationFormHandle } from '@/components/RegistrationForm'
import { UserPlus, Users, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

export default function Members() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<IUser[]>([])
  const [searching, setSearching] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const formRef = useRef<RegistrationFormHandle>(null)

  const searchMembers = useCallback(async (query: string) => {
    if (query.trim() !== '') {
      setSearching(true)
      try {
        const matches = await userService.searchUsers(query)
        setResults(matches)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    } else {
      setResults([])
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => searchMembers(search), 500)
    return () => clearTimeout(timeout)
  }, [search, searchMembers])

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
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
      await authService.register(payload)
      toast.success('Member registered successfully')
      form.reset()
      formRef.current?.reset()
      if (search.trim()) searchMembers(search)
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search and register church members</p>
        </div>
        <button
          onClick={() => {
            if (showForm) setFieldErrors({})
            setShowForm(!showForm)
          }}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors w-full sm:w-auto"
        >
          {showForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">New Member Registration</h3>
          </div>
          <RegistrationForm
            ref={formRef}
            onSubmit={handleRegister}
            isSubmitting={registering}
            submitLabel="Register Member"
            fieldErrors={fieldErrors}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search members by name..."
          />
        </div>

        <div className="min-h-[200px]">
          {searching ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {results.map((user) => {
                const userId = user.id || user._id || ''
                const isExpanded = expandedUser === userId
                return (
                  <div key={userId}>
                    <button
                      type="button"
                      onClick={() => setExpandedUser(isExpanded ? null : userId)}
                      className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{user.churchStatus}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50">
                        <div><span className="font-medium">Email:</span> {user.email}</div>
                        <div><span className="font-medium">Phone:</span> {user.phoneNumber}</div>
                        <div><span className="font-medium">Gender:</span> {user.gender}</div>
                        <div><span className="font-medium">Address:</span> {user.address}</div>
                        {user.department && <div><span className="font-medium">Department:</span> {user.department}</div>}
                        {user.faculty && <div><span className="font-medium">Faculty:</span> {user.faculty}</div>}
                        {user.level && <div><span className="font-medium">Level:</span> {user.level}</div>}
                        {user.membershipType && <div><span className="font-medium">Membership:</span> {user.membershipType}</div>}
                        {user.workerType && <div><span className="font-medium">Worker Type:</span> {user.workerType}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : !search.trim() ? (
            <div className="text-center py-12">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Search for members by name</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">No members found for "{search}"</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 text-sm text-emerald-600 hover:underline font-medium"
              >
                Register new member
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
