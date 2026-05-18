import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminUsers, updateUserRole, editAdminUser, getUserRegistrations, cancelRegistration } from '../api/admin'
import { getSchools } from '../api/schools'
import { useToast } from '../components/Toast'
import UserTicketsModal from '../components/UserTicketsModal'

const ROLES = [
  { value: 'ATTENDEE',    label: '일반' },
  { value: 'CERTIFIED',   label: '인증주최자' },
  { value: 'SCHOOL_ADMIN',label: '학교관리자' },
  { value: 'OPERATOR',    label: '운영자' },
]

const ROLE_BADGE = {
  ATTENDEE:    'bg-gray-100 text-gray-600',
  CERTIFIED:   'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN:'bg-purple-100 text-purple-700',
  OPERATOR:    'bg-orange-100 text-orange-700',
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function RoleChangeModal({ user, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [role, setRole] = useState(user.role)
  const [memo, setMemo] = useState(user.roleMemo || '')
  const [orgType, setOrgType] = useState(user.organizationType || '')

  const mutation = useMutation({
    mutationFn: () => updateUserRole(user.id, role, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast('역할이 변경되었습니다.', 'success')
      onClose()
    },
    onError: (err) => toast(err.response?.data?.message || '변경에 실패했습니다.', 'error'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-bold text-gray-900">역할 변경</h3>
          <p className="text-sm text-gray-400 mt-0.5">{user.name} · {user.email}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">역할 선택</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {role !== 'ATTENDEE' && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">
              메모 <span className="text-gray-400 font-normal">(선택 · 감사 로그에 기록)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder={role === 'SCHOOL_ADMIN' ? '예) 총학생회, 컴공과 동아리연합, 과학생회 등' : '예) 동아리 연합 주최자 인증, 학생회 임원 확인 등'}
              maxLength={100}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-300"
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 btn-secondary text-sm py-2.5 rounded-xl">취소</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (role === user.role && memo === (user.roleMemo || ''))}
            className="flex-1 btn-primary text-sm py-2.5 rounded-xl disabled:opacity-50"
          >
            {mutation.isPending ? '변경 중...' : '변경'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RoleSelect({ user }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-600 transition"
      >
        변경
      </button>
      {open && <RoleChangeModal user={user} onClose={() => setOpen(false)} />}
    </>
  )
}

function EditUserModal({ user, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    studentId: user.studentId ?? '',
  })

  const mutation = useMutation({
    mutationFn: (data) => editAdminUser(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast('수정되었습니다.', 'success')
      onClose()
    },
    onError: (err) => toast(err.response?.data?.message || '수정에 실패했습니다.', 'error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      name: form.name,
      email: form.email,
      emailVerified: form.emailVerified,
      studentId: form.studentId,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{user.name} 정보 수정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{user.role}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 flex flex-col gap-4">
          <div>
            <label className="label">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(v => ({ ...v, email: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">학번</label>
            <input
              type="text"
              value={form.studentId}
              onChange={e => setForm(v => ({ ...v, studentId: e.target.value }))}
              placeholder="없으면 비워두세요"
              className="input"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">이메일 인증 상태</label>
            <button
              type="button"
              onClick={() => setForm(v => ({ ...v, emailVerified: !v.emailVerified }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.emailVerified ? 'bg-primary-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.emailVerified ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            현재: {form.emailVerified ? <span className="text-green-600 font-medium">인증됨</span> : <span className="text-gray-500">미인증</span>}
          </p>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">취소</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 py-2.5">
              {mutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const toast = useToast()
  const [schoolId, setSchoolId] = useState('')
  const [role, setRole] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [ticketUser, setTicketUser] = useState(null)
  const [editUser, setEditUser] = useState(null)

  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: getSchools })
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', schoolId, role, search],
    queryFn: () => getAdminUsers({
      ...(schoolId ? { schoolId } : {}),
      ...(role ? { role } : {}),
      ...(search ? { search } : {}),
    }),
  })

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleReset = () => {
    setSchoolId('')
    setRole('')
    setSearch('')
    setSearchInput('')
  }

  const hasFilter = schoolId || role || search

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 py-10">
      <Link
        to="/admin"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        운영자 대시보드
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">유저 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">전체 사용자 조회 및 역할 변경</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={schoolId}
          onChange={e => setSchoolId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">전체 학교</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">전체 역할</option>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일"
            className="input py-2 text-sm w-48"
          />
          <button type="submit" className="btn-primary py-2 text-sm">검색</button>
        </form>

        {hasFilter && (
          <button onClick={handleReset} className="btn-secondary py-2 text-sm">초기화</button>
        )}

        <span className="text-sm text-gray-400 ml-auto">{users.length}명</span>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {hasFilter ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">이름</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">이메일</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">학교</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">학번</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">이메일인증</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">역할</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">가입일</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium text-gray-900">{user.name}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{user.email}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{user.school?.name ?? '-'}</td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{user.studentId || '-'}</td>
                  <td className="px-5 py-4">
                    {user.emailVerified
                      ? <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">인증됨</span>
                      : <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">미인증</span>
                    }
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role]}`}>
                          {ROLES.find(r => r.value === user.role)?.label ?? user.role}
                        </span>
                        <RoleSelect user={user} />
                      </div>
                      {user.roleMemo && (
                        <span className="text-xs text-gray-400 truncate max-w-[160px]" title={user.roleMemo}>
                          {user.roleMemo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{fmtDate(user.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditUser(user)}
                        className="text-xs text-gray-500 hover:text-gray-700 hover:underline font-medium"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => setTicketUser(user)}
                        className="text-xs text-primary-600 hover:underline font-medium"
                      >
                        티켓
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {ticketUser && (
      <UserTicketsModal
        user={ticketUser}
        fetchFn={getUserRegistrations}
        cancelFn={cancelRegistration}
        onClose={() => setTicketUser(null)}
      />
    )}
    {editUser && (
      <EditUserModal user={editUser} onClose={() => setEditUser(null)} />
    )}
    </>
  )
}
