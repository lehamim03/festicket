import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMySchoolUsers, updateMySchoolUserRole, getSchoolUserRegistrations, updateSchoolContact, getSchoolAuditLogs } from '../api/schoolAdmin'
import UserAvatar from '../components/UserAvatar'
import { getSchoolCertRequests, approveCertRequest, rejectCertRequest } from '../api/certRequests'
import { getMyEvents, publishEvent, deleteEvent } from '../api/events'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import UserTicketsModal from '../components/UserTicketsModal'

// ── 상수 ─────────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'ATTENDEE', label: '일반' },
  { value: 'CERTIFIED', label: '인증주최자' },
]

const ROLE_BADGE = {
  ATTENDEE: 'bg-gray-100 text-gray-500',
  CERTIFIED: 'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN: 'bg-purple-100 text-purple-700',
  OPERATOR: 'bg-orange-100 text-orange-700',
}
const ROLE_LABEL = {
  ATTENDEE: '일반', CERTIFIED: '인증주최자', SCHOOL_ADMIN: '학교관리자', OPERATOR: '운영자',
}

const STATUS_CONFIG = {
  DRAFT:     { label: '초안',   color: 'bg-amber-100 text-amber-700' },
  PUBLISHED: { label: '공개중', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-500' },
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// ── 역할 변경 모달 ────────────────────────────────────────────────────────────

function RoleChangeModal({ user, onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [role, setRole] = useState(user.role)
  const [memo, setMemo] = useState(user.roleMemo || '')

  const mutation = useMutation({
    mutationFn: () => updateMySchoolUserRole(user.id, role, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-school-users'] })
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
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        {role !== 'ATTENDEE' && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">
              메모 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="예) 동아리 연합 주최자 인증, 학생회 임원 확인 등"
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

function RoleChangeButton({ user }) {
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

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function SchoolAdminDashboard() {
  const { user: me } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('users')
  const [auditFilter, setAuditFilter] = useState('ALL')
  const [contactInput, setContactInput] = useState('')
  const [contactEditing, setContactEditing] = useState(false)
  const [certActions, setCertActions] = useState({}) // { [id]: { type: 'approve'|'reject', value: '' } }
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [ticketUser, setTicketUser] = useState(null)
  const [eventTab, setEventTab] = useState('all')
  const [eventSearch, setEventSearch] = useState('')

  // 사용자 조회
  const { data, isLoading: usersLoading } = useQuery({
    queryKey: ['my-school-users', search],
    queryFn: () => getMySchoolUsers(search),
  })
  const school = data?.school
  const users = data?.users ?? []

  const contactMutation = useMutation({
    mutationFn: (val) => updateSchoolContact(val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-school-users'] })
      toast('연락처가 저장되었습니다.', 'success')
      setContactEditing(false)
    },
    onError: (err) => toast(err.response?.data?.message || '저장에 실패했습니다.', 'error'),
  })

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['school-audit-logs'],
    queryFn: getSchoolAuditLogs,
    enabled: tab === 'audit',
    staleTime: 30000,
  })

  // 행사 조회 (getMyEvents → SCHOOL_ADMIN이면 학교 전체 행사 반환)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['my-events'],
    queryFn: getMyEvents,
    enabled: tab === 'events',
  })

  const publishMutation = useMutation({
    mutationFn: publishEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '공개 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '삭제 실패'),
  })

  const { data: certRequests = [], isLoading: certLoading } = useQuery({
    queryKey: ['school-cert-requests'],
    queryFn: getSchoolCertRequests,
    staleTime: 30000,
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, memo }) => approveCertRequest(id, memo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-cert-requests'] })
      toast('승인되었습니다.', 'success')
    },
    onError: (err) => toast(err.response?.data?.message || '승인에 실패했습니다.', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectCertRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-cert-requests'] })
      toast('거절되었습니다.', 'success')
    },
    onError: (err) => toast(err.response?.data?.message || '거절에 실패했습니다.', 'error'),
  })

  const filteredEvents = useMemo(() => {
    let list = eventTab === 'all' ? events : events.filter(e => e.status === eventTab)
    if (eventSearch.trim()) {
      const q = eventSearch.trim().toLowerCase()
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.host?.name?.toLowerCase().includes(q))
    }
    return list
  }, [events, eventTab, eventSearch])

  const attendeeCount = users.filter(u => u.role === 'ATTENDEE').length
  const certifiedCount = users.filter(u => u.role === 'CERTIFIED').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{school?.name ?? '내 학교'} 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">{me?.name} · 학교 총 관리자</p>
        </div>
        <Link to="/school-admin/notices" className="btn-primary text-sm px-4 py-2 rounded-xl">
          공지 관리
        </Link>
      </div>

      {/* 학교 관리자 연락처 설정 */}
      <div className="card px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-0.5">학교 관리자 연락처</p>
          {contactEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={contactInput}
                onChange={e => setContactInput(e.target.value)}
                placeholder="https://open.kakao.com/... 또는 링크 입력"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-300"
                autoFocus
              />
              <button
                onClick={() => contactMutation.mutate(contactInput)}
                disabled={contactMutation.isPending}
                className="text-xs font-semibold px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
              >저장</button>
              <button
                onClick={() => { setContactEditing(false); setContactInput(school?.adminContact || '') }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
              >취소</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {school?.adminContact ? (
                <a href={school.adminContact} target="_blank" rel="noreferrer"
                  className="text-sm text-primary-600 hover:underline truncate max-w-xs">
                  {school.adminContact}
                </a>
              ) : (
                <span className="text-sm text-gray-300">연락처 링크를 등록해주세요</span>
              )}
              <button
                onClick={() => { setContactInput(school?.adminContact || ''); setContactEditing(true) }}
                className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
              >수정</button>
            </div>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{users.length}</p>
          <p className="text-xs text-gray-400 mt-1">전체 사용자</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{certifiedCount}</p>
          <p className="text-xs text-gray-400 mt-1">인증주최자</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{events.filter(e => e.status === 'PUBLISHED').length}</p>
          <p className="text-xs text-gray-400 mt-1">공개 행사</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 border-b border-gray-100 pb-0">
        {[
          { value: 'users',  label: '사용자 관리' },
          { value: 'events', label: '행사 관리' },
          { value: 'cert',   label: '인증 신청', badge: certRequests.length },
          { value: 'audit',  label: '활동 로그' },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 사용자 관리 탭 ── */}
      {tab === 'users' && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">소속 사용자 목록</p>
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput) }} className="flex gap-2">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="input py-2 text-sm w-56"
              />
              <button type="submit" className="btn-primary py-2 text-sm">검색</button>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput('') }} className="btn-secondary py-2 text-sm">초기화</button>
              )}
            </form>
          </div>

          <div className="card overflow-hidden">
            {usersLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                {search ? '검색 결과가 없습니다.' : '소속 사용자가 없습니다.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">이름</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">이메일</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">학번</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">이메일인증</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">역할</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4 font-medium text-gray-900">{u.name}</td>
                      <td className="px-5 py-4 text-gray-500">{u.email}</td>
                      <td className="px-5 py-4 text-gray-400">{u.studentId || '-'}</td>
                      <td className="px-5 py-4">
                        {u.emailVerified
                          ? <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">인증됨</span>
                          : <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">미인증</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                              {ROLE_LABEL[u.role] ?? u.role}
                            </span>
                            {['ATTENDEE', 'CERTIFIED'].includes(u.role) && <RoleChangeButton user={u} />}
                          </div>
                          {u.roleMemo && (
                            <span className="text-xs text-gray-400 truncate max-w-[180px]" title={u.roleMemo}>
                              {u.roleMemo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setTicketUser(u)}
                          className="text-xs text-primary-600 hover:underline font-medium"
                        >
                          티켓
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── 행사 관리 탭 ── */}
      {tab === 'events' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            {/* 상태 필터 */}
            <div className="flex gap-1.5">
              {[
                { value: 'all', label: '전체' },
                { value: 'PUBLISHED', label: '공개중' },
                { value: 'DRAFT', label: '초안' },
                { value: 'CANCELLED', label: '취소됨' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setEventTab(t.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                    eventTab === t.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-gray-600 border border-gray-100'
                  }`}
                >
                  {t.label}
                  {t.value !== 'all' && (
                    <span className="ml-1 opacity-70">{events.filter(e => e.status === t.value).length}</span>
                  )}
                </button>
              ))}
            </div>
            <input
              value={eventSearch}
              onChange={e => setEventSearch(e.target.value)}
              placeholder="제목 · 주최자 검색"
              className="ml-auto text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 w-44"
            />
          </div>

          {eventsLoading ? (
            <div className="card p-12 text-center text-gray-400">불러오는 중...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">표시할 행사가 없습니다.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">행사명</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">주최자</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">시작일</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">신청</th>
                    <th className="text-left px-5 py-3.5 font-medium text-gray-600">상태</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEvents.map(event => {
                    const cfg = STATUS_CONFIG[event.status] ?? { label: event.status, color: 'bg-gray-100 text-gray-500' }
                    return (
                      <tr key={event.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link to={`/events/${event.id}`} className="font-semibold text-gray-900 hover:text-primary-600 hover:underline line-clamp-1 max-w-[200px]">
                              {event.title}
                            </Link>
                            {event.isPaid && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 shrink-0">유료</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{event.hostNameSnapshot ?? '-'}</td>
                        <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">{fmtDate(event.startAt)}</td>
                        <td className="px-5 py-3.5 text-gray-600 font-medium">{event._count?.registrations ?? 0}명</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/events/${event.id}`} className="text-xs text-gray-500 hover:underline">상세</Link>
                            {event.status === 'DRAFT' && (
                              <button
                                onClick={() => { if (confirm('이 행사를 공개하시겠습니까?')) publishMutation.mutate(event.id) }}
                                disabled={publishMutation.isPending && publishMutation.variables === event.id}
                                className="text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
                              >
                                공개
                              </button>
                            )}
                            {event.status !== 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  if (confirm(`"${event.title}" 행사를 삭제하시겠습니까?\n신청자가 있으면 자동 취소 처리됩니다.`))
                                    deleteMutation.mutate(event.id)
                                }}
                                disabled={deleteMutation.isPending && deleteMutation.variables === event.id}
                                className="text-xs text-red-500 hover:underline font-medium disabled:opacity-50"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── 인증 신청 탭 ── */}
      {tab === 'cert' && (
        <>
          {certLoading ? (
            <div className="card p-12 text-center">
              <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : certRequests.length === 0 ? (
            <div className="card p-16 text-center space-y-3">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">대기 중인 인증 신청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">총 <span className="font-semibold text-gray-700">{certRequests.length}건</span>의 인증 신청이 대기 중입니다.</p>
              <AnimatePresence initial={false}>
                {certRequests.map(req => {
                  const action = certActions[req.id]
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
                    >
                      {/* 신청자 정보 */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <UserAvatar user={req.user} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{req.user.name}</p>
                            {req.user.studentId && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">{req.user.studentId}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{req.user.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400">
                            {new Date(req.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </p>
                          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">검토 대기</span>
                        </div>
                      </div>

                      {/* 신청 내용 */}
                      <div className="px-5 pb-4 space-y-2">
                        {(req.organization || req.contact) && (
                          <div className="grid grid-cols-2 gap-2">
                            {req.organization && (
                              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">소속 · 직책</p>
                                <p className="text-sm text-gray-700 font-medium truncate">{req.organization}</p>
                              </div>
                            )}
                            {req.contact && (
                              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">연락처</p>
                                <p className="text-sm text-gray-700 font-medium truncate">{req.contact}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {req.organizationType && (
                          <div className={`rounded-xl px-3 py-2.5 ${req.organizationType === 'STUDENT_COUNCIL' ? 'bg-purple-50' : 'bg-gray-50'}`}>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">구분</p>
                            <p className={`text-sm font-semibold ${req.organizationType === 'STUDENT_COUNCIL' ? 'text-purple-700' : 'text-gray-700'}`}>
                              {req.organizationType === 'STUDENT_COUNCIL' ? '학생회' : '동아리'}
                            </p>
                            {req.expiresAt && (
                              <p className="text-xs text-purple-500 mt-0.5">
                                임기 만료일: {new Date(req.expiresAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        )}
                        {req.message && (
                          <div className="bg-blue-50 rounded-xl px-3 py-2.5">
                            <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">신청 사유</p>
                            <p className="text-sm text-blue-800">{req.message}</p>
                          </div>
                        )}

                        {/* 액션 */}
                        <div className="pt-1">
                          {!action ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setCertActions(v => ({ ...v, [req.id]: { type: 'reject', value: '' } }))}
                                className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition"
                              >
                                거절
                              </button>
                              <button
                                onClick={() => setCertActions(v => ({ ...v, [req.id]: { type: 'approve', value: '' } }))}
                                className="flex-[2] text-sm font-semibold py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
                              >
                                승인하기
                              </button>
                            </div>
                          ) : action.type === 'approve' ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="space-y-2 bg-green-50 rounded-xl p-3"
                            >
                              <p className="text-xs font-semibold text-green-700">승인 메모 <span className="text-green-500">*</span></p>
                              <input
                                type="text"
                                value={action.value}
                                onChange={e => setCertActions(v => ({ ...v, [req.id]: { ...v[req.id], value: e.target.value } }))}
                                placeholder="예) OO학생회 임원, OO동아리 대표"
                                maxLength={100}
                                className="w-full text-sm bg-white border border-green-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 placeholder:text-gray-300"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCertActions(v => { const n = {...v}; delete n[req.id]; return n })}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white transition"
                                >취소</button>
                                <button
                                  onClick={() => approveMutation.mutate({ id: req.id, memo: action.value })}
                                  disabled={approveMutation.isPending || !action.value.trim()}
                                  className="flex-1 text-sm font-semibold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition"
                                >
                                  {approveMutation.isPending ? '처리 중...' : '승인 확정'}
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="space-y-2 bg-red-50 rounded-xl p-3"
                            >
                              <p className="text-xs font-semibold text-red-700">거절 사유 <span className="text-red-400">*</span></p>
                              <input
                                type="text"
                                value={action.value}
                                onChange={e => setCertActions(v => ({ ...v, [req.id]: { ...v[req.id], value: e.target.value } }))}
                                placeholder="거절 사유를 입력해주세요"
                                maxLength={100}
                                className="w-full text-sm bg-white border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-300"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setCertActions(v => { const n = {...v}; delete n[req.id]; return n })}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white transition"
                                >취소</button>
                                <button
                                  onClick={() => rejectMutation.mutate({ id: req.id, reason: action.value })}
                                  disabled={rejectMutation.isPending || !action.value.trim()}
                                  className="flex-1 text-sm font-semibold py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
                                >
                                  {rejectMutation.isPending ? '처리 중...' : '거절 확정'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {tab === 'audit' && (() => {
        const ACTION_META = {
          CHANGE_ROLE:           { label: '역할 변경',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
          REJECT_CERT:           { label: '인증 거절',    color: 'bg-red-100 text-red-600',      dot: 'bg-red-400' },
          DELEGATION:            { label: '권한 위임',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
          CREATE_EVENT:          { label: '행사 생성',    color: 'bg-indigo-100 text-indigo-700',dot: 'bg-indigo-400' },
          PUBLISH_EVENT:         { label: '행사 공개',    color: 'bg-green-100 text-green-700',  dot: 'bg-green-400' },
          UPDATE_EVENT:          { label: '행사 수정',    color: 'bg-violet-100 text-violet-700',dot: 'bg-violet-400' },
          CLOSE_EVENT:           { label: '행사 마감',    color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
          DELETE_EVENT:          { label: '행사 삭제',    color: 'bg-red-100 text-red-600',      dot: 'bg-red-400' },
          CHECKIN:               { label: '체크인',       color: 'bg-purple-100 text-purple-700',dot: 'bg-purple-400' },
          UPDATE_SCHOOL_CONTACT: { label: '연락처 설정',  color: 'bg-cyan-100 text-cyan-700',    dot: 'bg-cyan-400' },
          DOWNLOAD_REPORT:       { label: '리포트 다운',  color: 'bg-slate-100 text-slate-600',  dot: 'bg-slate-400' },
        }

        const filterActions = ['ALL', 'CHANGE_ROLE', 'DELEGATION', 'CREATE_EVENT', 'PUBLISH_EVENT', 'CHECKIN']
        const filtered = auditFilter === 'ALL' ? auditLogs : auditLogs.filter(l => l.action === auditFilter)

        // 날짜별 그룹핑
        const grouped = filtered.reduce((acc, log) => {
          const date = new Date(log.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
          if (!acc[date]) acc[date] = []
          acc[date].push(log)
          return acc
        }, {})

        return (
          <div className="space-y-4">
            {/* 필터 */}
            <div className="flex gap-1.5 flex-wrap">
              {filterActions.map(f => {
                const meta = ACTION_META[f]
                return (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                      auditFilter === f
                        ? f === 'ALL' ? 'bg-gray-800 text-white' : `${meta?.color} ring-2 ring-offset-1 ring-current`
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'ALL' ? '전체' : meta?.label || f}
                  </button>
                )
              })}
            </div>

            {/* 로그 카운트 */}
            <p className="text-xs text-gray-400">
              총 <span className="font-semibold text-gray-600">{filtered.length}건</span>의 활동 로그
            </p>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">해당 조건의 로그가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([date, logs]) => (
                  <div key={date}>
                    {/* 날짜 구분선 */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">{date}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div className="space-y-2">
                      {logs.map(log => {
                        const meta = ACTION_META[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-300' }
                        const time = new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                        return (
                          <div key={log.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 transition">
                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                                  {meta.label}
                                </span>
                                <span className="text-sm text-gray-700">{log.detail || '-'}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium text-gray-500">{log.admin?.name}</span>
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-400">{time}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {ticketUser && (
        <UserTicketsModal
          user={ticketUser}
          fetchFn={getSchoolUserRegistrations}
          onClose={() => setTicketUser(null)}
        />
      )}
    </div>
  )
}
