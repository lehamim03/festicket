import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvent, getEventRegistrations, approveRefund, publishEvent, closeEvent, cancelEvent, downloadReport, addCoHost, removeCoHost, searchCoHostCandidates } from '../api/events'
import { getReviews } from '../api/reviews'
import { useAuth } from '../hooks/useAuth'
import EventWhitelistManager from '../components/EventWhitelistManager'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fmtTimeOnly(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── 상태 설정 ────────────────────────────────────────────────────────────────
const EVENT_STATUS = {
  DRAFT:     { label: '초안',   color: 'bg-amber-100 text-amber-700' },
  PUBLISHED: { label: '공개중', color: 'bg-green-100 text-green-700' },
  CLOSED:    { label: '마감됨', color: 'bg-gray-200 text-gray-600' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-500' },
  ENDED:     { label: '종료됨', color: 'bg-slate-100 text-slate-500' },
}

const REG_STATUS = {
  PENDING_PAYMENT:        { label: '결제 대기',    color: 'bg-amber-100 text-amber-700' },
  CONFIRMED:              { label: '발권완료',     color: 'bg-green-100 text-green-700' },
  CANCELLATION_REQUESTED: { label: '환불 처리 중', color: 'bg-blue-100 text-blue-700' },
  REFUND_FAILED:          { label: '환불 실패',    color: 'bg-red-100 text-red-500' },
  CHECKED_IN:             { label: '체크인 완료',  color: 'bg-purple-100 text-purple-700' },
}

// 참가자 명단에서 숨길 상태 (취소된 참여자)
const HIDDEN_STATUSES = ['CANCELLED', 'EXPIRED']

// ── 정보 행 ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '-'}</span>
    </div>
  )
}

const ROLE_LABEL = { CERTIFIED: '인증주최자', SCHOOL_ADMIN: '학교총관리자', OPERATOR: '운영자', ATTENDEE: '일반사용자' }

function CoHostSection({ event, user, isMainHost, queryClient, eventId, coHostQuery, setCoHostQuery, coHostCandidates, setCoHostCandidates }) {
  const coHosts = event.coHosts ?? []
  const [open, setOpen] = useState(true)

  const addMut = useMutation({
    mutationFn: (userId) => addCoHost(eventId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      setCoHostQuery('')
      setCoHostCandidates([])
    },
    onError: (err) => alert(err.response?.data?.message ?? '추가 실패'),
  })

  const removeMut = useMutation({
    mutationFn: (userId) => removeCoHost(eventId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
    onError: (err) => alert(err.response?.data?.message ?? '제거 실패'),
  })

  const handleSearch = async (q) => {
    setCoHostQuery(q)
    if (q.trim().length < 1) return setCoHostCandidates([])
    try {
      const results = await searchCoHostCandidates(event.schoolId, q)
      const existingIds = new Set([event.host?.id, ...coHosts.map(c => c.userId)])
      setCoHostCandidates(results.filter(r => !existingIds.has(r.id)))
    } catch {
      setCoHostCandidates([])
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-4">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div>
          <h2 className="text-sm font-bold text-gray-700">공동호스트</h2>
          <p className="text-xs text-gray-400 mt-0.5">공동호스트 추가·제거는 행사 생성자만 가능합니다.</p>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && <>
      {/* 현재 공동호스트 목록 */}
      {coHosts.length === 0 ? (
        <p className="text-xs text-gray-400">등록된 공동호스트가 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {coHosts.map(ch => (
            <div key={ch.userId} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                  {ch.user?.name?.[0] ?? '?'}
                </div>
                <span className="text-sm text-gray-800 font-medium">{ch.user?.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {ROLE_LABEL[ch.user?.role] ?? ch.user?.role}
                </span>
              </div>
              {isMainHost && (
                <button
                  onClick={() => { if (confirm(`"${ch.user?.name}"을(를) 공동호스트에서 제거하시겠습니까?`)) removeMut.mutate(ch.userId) }}
                  className="text-xs text-red-400 hover:text-red-600 transition"
                >
                  제거
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가 (주 호스트만) */}
      {isMainHost && (
        <div className="space-y-2 pt-2 border-t border-gray-50">
          <div className="relative">
            <input
              className="input text-sm pr-8"
              placeholder="이름 또는 이메일로 검색"
              value={coHostQuery}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          {coHostCandidates.length > 0 && (
            <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {coHostCandidates.map(c => (
                <button
                  key={c.id}
                  onClick={() => addMut.mutate(c.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left border-b border-gray-50 last:border-0"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{c.email}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 shrink-0">
                    {ROLE_LABEL[c.role] ?? c.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────────────
export default function EventManage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [refundTarget, setRefundTarget] = useState(null)
  const [refundReason, setRefundReason] = useState('')
  const [coHostQuery, setCoHostQuery] = useState('')
  const [coHostCandidates, setCoHostCandidates] = useState([])
  const [whitelistOpen, setWhitelistOpen] = useState(true)
  const [participantOpen, setParticipantOpen] = useState(true)

  const { data: event, isLoading: eventLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
  })

  const { data: registrations = [], isLoading: regLoading, dataUpdatedAt } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () => getEventRegistrations(id),
    enabled: !!event,
    refetchInterval: 10000,
  })

  const isEnded = event?.endAt && new Date(event.endAt) < new Date()

  const { data: reviews = [], isLoading: reviewLoading } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => getReviews(id),
    enabled: !!isEnded,
  })

  const publishMutation = useMutation({
    mutationFn: () => publishEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err) => alert(err.response?.data?.message ?? '공개 실패'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err) => alert(err.response?.data?.message ?? '마감 실패'),
  })

  const cancelMutation = useMutation({
    mutationFn: (cancelReason) => cancelEvent(id, cancelReason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err) => alert(err.response?.data?.message ?? '취소 실패'),
  })

  const refundMutation = useMutation({
    mutationFn: () => approveRefund(id, refundTarget.id, refundReason),
    onSuccess: (res) => {
      alert(res.message)
      setRefundTarget(null)
      setRefundReason('')
      queryClient.invalidateQueries({ queryKey: ['event-registrations', id] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '환불 처리 실패'),
  })

  // 시각화 데이터 — useMemo는 얼리 리턴 전에 선언해야 Rules of Hooks 준수
  const statusChartData = useMemo(() => {
    const map = {
      CONFIRMED:              { label: '발권완료',     color: '#22c55e' },
      CHECKED_IN:             { label: '체크인',       color: '#6366f1' },
      PENDING_PAYMENT:        { label: '결제대기',     color: '#f59e0b' },
      CANCELLATION_REQUESTED: { label: '환불대기',     color: '#3b82f6' },
      REFUND_FAILED:          { label: '환불실패',     color: '#ef4444' },
      CANCELLED:              { label: '취소',         color: '#d1d5db' },
      EXPIRED:                { label: '만료',         color: '#e5e7eb' },
    }
    return Object.entries(
      registrations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {})
    )
      .map(([status, count]) => ({ name: map[status]?.label ?? status, value: count, color: map[status]?.color ?? '#ccc' }))
      .filter(d => d.value > 0)
  }, [registrations])

  const trendData = useMemo(() => {
    if (!registrations.length) return []
    const byDate = registrations.reduce((acc, r) => {
      const d = new Date(r.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      acc[d] = (acc[d] || 0) + 1
      return acc
    }, {})
    let cum = 0
    return Object.entries(byDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, count]) => ({ date, count, cumulative: (cum += count) }))
  }, [registrations])

  if (eventLoading) return <div className="card p-12 text-center text-gray-400">불러오는 중...</div>
  if (isError || !event) return <div className="card p-12 text-center text-gray-400">행사를 찾을 수 없습니다.</div>

  const isMainHost = user?.id === event.host?.id
  const isCoHost = !isMainHost && event.coHosts?.some(ch => ch.userId === user?.id)
  const isHost = user && (
    isMainHost || isCoHost ||
    ['SCHOOL_ADMIN', 'OPERATOR'].includes(user.role)
  )
  if (!isHost) return <div className="card p-12 text-center text-gray-400">접근 권한이 없습니다.</div>

  const displayStatus = isEnded ? 'ENDED' : event.status
  const statusCfg = EVENT_STATUS[displayStatus] ?? { label: event.status, color: 'bg-gray-100 text-gray-500' }

  // 체크인 현황 통계
  const totalParticipants = registrations.filter(r => ['CONFIRMED', 'CHECKED_IN'].includes(r.status)).length
  const checkedIn = registrations.filter(r => r.status === 'CHECKED_IN').length
  const notCheckedIn = registrations.filter(r => r.status === 'CONFIRMED').length
  const checkInRate = totalParticipants > 0 ? Math.round((checkedIn / totalParticipants) * 100) : 0

  // 참가자 명단 (취소자 제외)
  const visibleRegs = registrations.filter(r => !HIDDEN_STATUSES.includes(r.status))

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* 헤더 */}
      <div>
        <button
          onClick={() => navigate('/my-events')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          내 행사 목록
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 line-clamp-1">{event.title}</h1>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <p className="text-sm text-gray-400 mt-1">주최: {event.hostNameSnapshot ?? event.host?.name}</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 flex-wrap">
        <Link to={`/events/${id}`} className="btn text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl">
          공개 페이지
        </Link>
        {event.status === 'DRAFT' && (
          <button
            onClick={() => { if (confirm('행사를 공개하시겠습니까?')) publishMutation.mutate() }}
            disabled={publishMutation.isPending}
            className="btn text-sm border border-green-200 text-green-700 hover:bg-green-50 px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {publishMutation.isPending ? '공개 중...' : '공개하기'}
          </button>
        )}
        {event.status === 'PUBLISHED' && (
          <>
            <button
              onClick={() => { if (confirm('신청을 마감하시겠습니까?')) closeMutation.mutate() }}
              disabled={closeMutation.isPending}
              className="btn text-sm border border-orange-200 text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {closeMutation.isPending ? '마감 중...' : '신청 마감'}
            </button>
            <Link to={`/events/${id}/checkin`} className="btn text-sm border border-primary-200 text-primary-600 hover:bg-primary-50 px-4 py-2 rounded-xl">
              QR 체크인
            </Link>
            <button
              onClick={() => {
                const reason = prompt('행사를 취소하시겠습니까?\n참가자 전원에게 자동 환불됩니다.\n\n취소 사유를 입력해주세요. (선택)')
                if (reason !== null) cancelMutation.mutate(reason)
              }}
              disabled={cancelMutation.isPending}
              className="btn text-sm border border-red-200 text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {cancelMutation.isPending ? '취소 중...' : '행사 취소'}
            </button>
          </>
        )}
        {!['CANCELLED', 'CLOSED'].includes(event.status) && (
          <Link to={`/events/${id}/edit`} className="btn text-sm border border-blue-200 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl">
            행사 수정
          </Link>
        )}
        <button
          onClick={() => downloadReport(id, 'csv').catch(e => alert(e.message))}
          className="btn text-sm border border-purple-200 text-purple-600 hover:bg-purple-50 px-4 py-2 rounded-xl"
        >
          CSV
        </button>
        <button
          onClick={() => downloadReport(id, 'xlsx').catch(e => alert(e.message))}
          className="btn text-sm border border-purple-200 text-purple-600 hover:bg-purple-50 px-4 py-2 rounded-xl"
        >
          Excel
        </button>
        <button
          onClick={() => downloadReport(id, 'pdf').catch(e => alert(e.message))}
          className="btn text-sm border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-xl"
        >
          PDF
        </button>
      </div>

      {/* 행사 정보 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">행사 정보</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="시작" value={fmtDateTime(event.startAt)} />
            <InfoRow label="종료" value={fmtDateTime(event.endAt)} />
            <InfoRow label="신청 마감 (1차)" value={fmtDateTime(event.registrationDeadline)} />
            <InfoRow
              label="신청 마감 (2차)"
              value={event.releaseDeadline ? fmtDateTime(event.releaseDeadline) : '미설정 (시작 30분 전)'}
            />
            <InfoRow label="장소" value={event.location} />
            <InfoRow label="정원" value={`${event.capacity}명`} />
          </div>
          <div>
            <InfoRow label="오픈 시각" value={event.publishAt ? fmtDateTime(event.publishAt) : '즉시 공개'} />
            <InfoRow label="요금" value={event.isPaid ? `${event.price?.toLocaleString()}원` : '무료'} />
            {event.isPaid && (
              <>
                <InfoRow
                  label="환불 마감"
                  value={event.refundDeadlineAt ? fmtDateTime(event.refundDeadlineAt) : '제한 없음'}
                />
                <InfoRow label="환불 문의처" value={event.refundContact} />
              </>
            )}
            {event.status === 'CLOSED' && (
              <InfoRow label="마감 시각" value={event.closedAt ? fmtDateTime(event.closedAt) + ' (조기)' : '자연 마감'} />
            )}
          </div>
        </div>
        {event.imageUrl && (
          <img src={event.imageUrl} alt={event.title} className="w-full h-36 object-cover rounded-2xl mt-3" />
        )}
        {event.description && (
          <div className="mt-3 pt-3 border-t border-gray-50">
            <div className="text-xs text-gray-400 mb-1">설명</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{event.description}</div>
          </div>
        )}
      </div>

      {/* 공동호스트 */}
      <CoHostSection
        event={event}
        user={user}
        isMainHost={isMainHost}
        queryClient={queryClient}
        eventId={id}
        coHostQuery={coHostQuery}
        setCoHostQuery={setCoHostQuery}
        coHostCandidates={coHostCandidates}
        setCoHostCandidates={setCoHostCandidates}
      />

      {/* 화이트리스트 — 유료 행사만 */}
      {event.isPaid && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
          <button
            onClick={() => setWhitelistOpen(o => !o)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-sm font-bold text-gray-800">학생회비 납부자 화이트리스트</h2>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${whitelistOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {whitelistOpen && (
            <div className="mt-4">
              <EventWhitelistManager eventId={id} hideTitle />
            </div>
          )}
        </div>
      )}

      {/* 체크인 현황 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-800">체크인 현황</h2>
          <span className="text-xs text-gray-400">
            {lastUpdated ? `${lastUpdated} 갱신` : '10초마다 자동 갱신'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="text-center">
            <div className="text-4xl font-black text-gray-900">{totalParticipants}</div>
            <div className="text-xs text-gray-400 mt-1">총 참가자</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-blue-500">{checkedIn}</div>
            <div className="text-xs text-gray-400 mt-1">체크인 완료</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-black text-amber-500">{notCheckedIn}</div>
            <div className="text-xs text-gray-400 mt-1">미체크인</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-500">체크인 진행률</span>
            <span className="text-xs font-bold text-primary-600">{checkInRate}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${checkInRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* 시각화 */}
      {registrations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* 신청 상태 분포 */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">신청 상태 분포</h2>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={statusChartData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {statusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}명`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {statusChartData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{d.value}명</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 시간대별 신청 추이 */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">신청 추이 (누적)</h2>
            {trendData.length < 2 ? (
              <div className="flex items-center justify-center h-40 text-xs text-gray-400">데이터가 부족합니다.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v}명`]} />
                  <Area type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" name="누적 신청" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      )}

      {/* 참가자 명단 */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
        <button
          onClick={() => setParticipantOpen(o => !o)}
          className="flex items-center justify-between w-full text-left mb-4"
        >
          <h2 className="text-sm font-bold text-gray-800">
            참가자 명단
            <span className="text-gray-400 font-normal ml-1">({visibleRegs.length}명)</span>
          </h2>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${participantOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {participantOpen && (regLoading ? (
          <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
        ) : visibleRegs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">신청자가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-3 font-medium">이름</th>
                  <th className="text-left pb-3 font-medium">이메일</th>
                  <th className="text-left pb-3 font-medium">상태</th>
                  <th className="text-left pb-3 font-medium">체크인 시각</th>
                  {event.isPaid && <th className="pb-3"></th>}
                </tr>
              </thead>
              <tbody>
                {visibleRegs.map((reg) => {
                  const cfg = REG_STATUS[reg.status] ?? { label: reg.status, color: 'bg-gray-100 text-gray-500' }
                  const canRefund = event.isPaid &&
                    ['CONFIRMED', 'REFUND_FAILED'].includes(reg.status) &&
                    reg.paymentKey
                  return (
                    <tr key={reg.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3">
                        <div className="font-medium text-gray-800">{reg.user.name}</div>
                        {reg.user.studentId && (
                          <div className="text-xs text-gray-400 font-mono">{reg.user.studentId}</div>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">{reg.user.email}</td>
                      <td className="py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-400">
                        {reg.checkedInAt ? fmtTimeOnly(reg.checkedInAt) : '-'}
                      </td>
                      {event.isPaid && (
                        <td className="py-3 text-right">
                          {canRefund && (
                            <button
                              onClick={() => { setRefundTarget(reg); setRefundReason('') }}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              환불
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* 리뷰 섹션 — 행사 종료 후에만 표시 */}
      {isEnded && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4">
            리뷰
            <span className="text-gray-400 font-normal ml-1">({reviews.length}개)</span>
          </h2>

          {reviewLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">불러오는 중...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">아직 리뷰가 없습니다.</p>
          ) : (
            <>
              {/* 평점 요약 */}
              {(() => {
                const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
                const rounded = Math.round(avg * 10) / 10
                return (
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div className="text-center">
                      <div className="text-4xl font-black text-amber-500">{rounded.toFixed(1)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{reviews.length}개 리뷰</div>
                    </div>
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const cnt = reviews.filter(r => r.rating === star).length
                        const pct = reviews.length > 0 ? (cnt / reviews.length) * 100 : 0
                        return (
                          <div key={star} className="flex items-center gap-2">
                            <span className="text-xs text-amber-400 w-5 shrink-0">{star}★</span>
                            <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-4 shrink-0">{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* 리뷰 목록 */}
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">{r.authorName}</span>
                        <span className="text-amber-400 text-sm leading-none">
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 환불 모달 */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">환불 승인</h3>
            <div className="bg-gray-50 rounded-2xl p-3 space-y-1 text-sm">
              <div className="font-semibold text-gray-800">{refundTarget.user.name}</div>
              <div className="text-gray-500">{refundTarget.user.email}</div>
              {refundTarget.paidAmount != null && (
                <div className="text-gray-500">결제금액: {refundTarget.paidAmount.toLocaleString()}원</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                환불 사유 <span className="text-red-400">*</span>
              </label>
              <textarea
                className="input min-h-[80px] resize-none text-sm"
                placeholder="환불 사유를 입력해주세요"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setRefundTarget(null); setRefundReason('') }}
                className="btn flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-2xl text-sm"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!refundReason.trim()) return alert('환불 사유를 입력해주세요.')
                  refundMutation.mutate()
                }}
                disabled={refundMutation.isPending}
                className="btn flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-2xl text-sm font-semibold disabled:opacity-60"
              >
                {refundMutation.isPending ? '처리 중...' : '환불 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
