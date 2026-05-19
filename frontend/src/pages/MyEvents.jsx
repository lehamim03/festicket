import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMyEvents, publishEvent, closeEvent, deleteEvent, cancelEvent } from '../api/events'
import { useAuth } from '../hooks/useAuth'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG = {
  DRAFT:     { label: '초안',   color: 'bg-amber-100 text-amber-700' },
  PUBLISHED: { label: '공개중', color: 'bg-green-100 text-green-700' },
  CLOSED:    { label: '마감됨', color: 'bg-gray-100 text-gray-600' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-500' },
  ENDED:     { label: '종료됨', color: 'bg-slate-100 text-slate-500' },
}

function getDisplayStatus(event) {
  if (event.status === 'PUBLISHED' && event.endAt && new Date(event.endAt) < new Date()) return 'ENDED'
  return event.status
}

const TABS = [
  { value: 'all',       label: '전체' },
  { value: 'DRAFT',     label: '초안' },
  { value: 'PUBLISHED', label: '공개중' },
  { value: 'CLOSED',    label: '마감됨' },
  { value: 'CANCELLED', label: '취소됨' },
]

function ProfileCard({ user, events }) {
  const totalEvents = events.length

  const totalReviewCount = events.reduce((s, e) => s + (e.reviewCount ?? 0), 0)
  const overallRating = totalReviewCount > 0
    ? Math.round(
        events.reduce((s, e) => s + (e.reviewAvg ?? 0) * (e.reviewCount ?? 0), 0) / totalReviewCount * 10
      ) / 10
    : null

  const totalCheckedIn = events.reduce((s, e) => s + (e.checkedInCount ?? 0), 0)

  const ROLE_LABEL = {
    CERTIFIED: '인증사용자',
    SCHOOL_ADMIN: '학교총관리자',
    OPERATOR: '운영자',
    ATTENDEE: '일반사용자',
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-5 space-y-5 sticky top-6">
      {/* 기본 정보 */}
      <div className="space-y-1">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center mb-3">
          <span className="text-xl font-bold text-primary-600">{user?.name?.[0] ?? '?'}</span>
        </div>
        <div className="font-bold text-gray-900 text-base">{user?.name}</div>
        {user?.school?.name && (
          <div className="text-xs text-gray-500">{user.school.name}</div>
        )}
        {user?.studentId && (
          <div className="text-xs text-gray-400 font-mono">{user.studentId}</div>
        )}
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold mt-1">
          {ROLE_LABEL[user?.role] ?? user?.role}
        </span>
        {user?.roleMemo && (
          <div className="text-xs text-gray-400 mt-0.5">{user.roleMemo}</div>
        )}
      </div>

      <div className="border-t border-gray-50" />

      {/* 통계 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">주최한 행사</span>
          <span className="text-sm font-bold text-gray-800">{totalEvents}개</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">총 체크인 인원</span>
          <span className="text-sm font-bold text-gray-800">{totalCheckedIn}명</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">전체 행사 평균 별점</span>
          {overallRating !== null ? (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-sm">★</span>
              <span className="text-sm font-bold text-gray-800">{overallRating.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({totalReviewCount})</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">리뷰 없음</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyEvents() {
  const [tab, setTab] = useState('all')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['my-events'],
    queryFn: getMyEvents,
  })

  const publishMutation = useMutation({
    mutationFn: publishEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '공개 실패'),
  })

  const closeMutation = useMutation({
    mutationFn: closeEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '마감 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '삭제 실패'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, cancelReason }) => cancelEvent(id, cancelReason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '취소 실패'),
  })

  const filtered = tab === 'all' ? events : events.filter(e => e.status === tab)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex gap-6 items-start">

        {/* 프로필 카드 (왼쪽 사이드바) */}
        <div className="w-56 shrink-0 hidden lg:block">
          <ProfileCard user={user} events={events} />
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">내 행사 관리</h1>
            <Link to="/events/create" className="btn-primary text-sm px-4 py-2 rounded-xl">
              + 행사 만들기
            </Link>
          </div>

          {/* 탭 필터 */}
          <div className="flex gap-2 flex-wrap">
            {TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
                  tab === t.value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-100'
                }`}
              >
                {t.label}
                {t.value !== 'all' && (
                  <span className="ml-1.5 text-xs opacity-70">
                    {events.filter(e => e.status === t.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="card p-12 text-center text-gray-400">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center space-y-3">
              <p className="text-gray-400">표시할 행사가 없습니다.</p>
              <Link to="/events/create" className="btn-primary text-sm px-5 py-2.5 rounded-xl inline-block">
                행사 만들기
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map(event => (
                <EventRow
                  key={event.id}
                  event={event}
                  onPublish={() => {
                    if (confirm('이 행사를 공개하시겠습니까?')) publishMutation.mutate(event.id)
                  }}
                  onClose={() => {
                    if (confirm(`"${event.title}" 행사를 마감하시겠습니까?\n더 이상 신청을 받지 않습니다.`)) closeMutation.mutate(event.id)
                  }}
                  onDelete={() => {
                    if (confirm(`"${event.title}" 초안을 삭제하시겠습니까?`)) {
                      deleteMutation.mutate(event.id)
                    }
                  }}
                  onCancel={() => {
                    const reason = prompt(`"${event.title}" 행사를 취소하시겠습니까?\n취소 사유를 입력해주세요. (선택)`)
                    if (reason !== null) cancelMutation.mutate({ id: event.id, cancelReason: reason })
                  }}
                  isPublishing={publishMutation.isPending && publishMutation.variables === event.id}
                  isClosing={closeMutation.isPending && closeMutation.variables === event.id}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === event.id}
                  isCancelling={cancelMutation.isPending && cancelMutation.variables?.id === event.id}
                />
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}

function StarDisplay({ avg, count }) {
  if (avg === null || avg === undefined) return null
  return (
    <div className="flex items-center gap-1">
      <span className="text-amber-400 text-sm">{'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span>
      <span className="text-xs text-gray-500 font-semibold">{avg.toFixed(1)}</span>
      <span className="text-xs text-gray-400">({count}개)</span>
    </div>
  )
}

function EventRow({ event, onPublish, onClose, onDelete, onCancel, isPublishing, isClosing, isDeleting, isCancelling }) {
  const displayStatus = getDisplayStatus(event)
  const cfg = STATUS_CONFIG[displayStatus] ?? { label: event.status, color: 'bg-gray-100 text-gray-500' }
  const isEnded = displayStatus === 'ENDED'
  const attendees = event._count?.registrations ?? 0
  const remaining = event.capacity - attendees

  return (
    <li className="card p-5">
      <div className="flex items-start gap-4">
        {/* 썸네일 */}
        <div
          className="w-16 h-16 rounded-2xl shrink-0 overflow-hidden bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center"
        >
          {event.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-7 h-7 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            {event.isCoHost && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                공동호스트
              </span>
            )}
            {event.isPaid && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                유료 {event.price?.toLocaleString()}원
              </span>
            )}
          </div>
          <Link to={`/events/${event.id}`} className="font-bold text-gray-900 hover:underline line-clamp-1 block">
            {event.title}
          </Link>
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>📅 {fmtDate(event.startAt)} {fmtTime(event.startAt)}</span>
            {event.location && <span>📍 {event.location}</span>}
            {event.school && <span>🏫 {event.school.name}</span>}
          </div>
          <div className="text-xs text-gray-500">
            신청 <span className="font-semibold text-gray-800">{attendees}명</span>
            <span className="mx-1 text-gray-300">/</span>
            정원 {event.capacity}명
            {remaining > 0 && <span className="ml-1 text-emerald-600">({remaining}석 남음)</span>}
            {remaining <= 0 && <span className="ml-1 text-red-500">(마감)</span>}
          </div>
          {isEnded && <StarDisplay avg={event.reviewAvg} count={event.reviewCount} />}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
        <Link
          to={`/events/${event.id}/manage`}
          className="btn text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg"
        >
          관리
        </Link>

        {event.status !== 'CANCELLED' && !isEnded && (
          <Link
            to={`/events/${event.id}/edit`}
            className="btn text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
          >
            수정
          </Link>
        )}

        {event.status === 'DRAFT' && (
          <button
            onClick={onPublish}
            disabled={isPublishing}
            className="btn text-xs border border-green-200 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {isPublishing ? '공개 중...' : '공개하기'}
          </button>
        )}

        {['PUBLISHED', 'CLOSED'].includes(event.status) && !isEnded && (
          <Link
            to={`/events/${event.id}/checkin`}
            className="btn text-xs border border-primary-200 text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg"
          >
            QR 체크인
          </Link>
        )}

        {event.status === 'PUBLISHED' && !isEnded && (
          <button
            onClick={onClose}
            disabled={isClosing}
            className="btn text-xs border border-orange-200 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {isClosing ? '마감 중...' : '신청 마감'}
          </button>
        )}

        {!event.isCoHost && event.status === 'DRAFT' && (
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="btn text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg disabled:opacity-50 ml-auto"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        )}

        {!event.isCoHost && event.status === 'PUBLISHED' && !isEnded && (
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="btn text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg disabled:opacity-50 ml-auto"
          >
            {isCancelling ? '취소 중...' : '행사 취소'}
          </button>
        )}
      </div>
    </li>
  )
}
