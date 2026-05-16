import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvent, publishEvent, closeEvent, getNextRelease } from '../api/events'
import { createFreeRegistration, cancelFreeRegistration } from '../api/registrations'
import { preparePayment, cancelPaidRegistration, cancelPendingPayment } from '../api/payments'
import { getBookmarkIds } from '../api/bookmarks'
import BookmarkButton from '../components/BookmarkButton'
import UserAvatar from '../components/UserAvatar'
import { useAuth } from '../hooks/useAuth'
import EventWhitelistManager from '../components/EventWhitelistManager'
import EventParticipantManager from '../components/EventParticipantManager'
import EventQnA from '../components/EventQnA'
import EventReview from '../components/EventReview'

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}
function fmtPublishAt(iso) {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 || 12
  return `${month}월 ${day}일 ${ampm} ${h12}시 ${m.toString().padStart(2, '0')}분`
}

// ── 신청 상태 표시 ────────────────────────────────────────────────────────────
const STATUS_LABEL = {
  CONFIRMED: '신청 완료',
  PENDING_PAYMENT: '결제 대기',
  CANCELLATION_REQUESTED: '취소 처리 중',
  REFUND_FAILED: '환불 실패',
  CHECKED_IN: '입장 완료',
}

// ── 취소표 카운트다운 ─────────────────────────────────────────────────────────
function ReleaseCountdown({ nextReleaseAt, pendingRange }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(nextReleaseAt) - Date.now()) / 1000)))

  useEffect(() => {
    const timer = setInterval(() => {
      setSecs(Math.max(0, Math.floor((new Date(nextReleaseAt) - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [nextReleaseAt])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className="text-center p-3 bg-amber-50 rounded-2xl border border-amber-100">
      <p className="text-xs font-semibold text-amber-700">다음 취소표 오픈까지</p>
      <p className="text-xl font-black text-amber-600 tracking-widest">{mm}:{ss}</p>
      <p className="text-xs text-amber-500 mt-0.5">
        예상 {pendingRange[0]}~{pendingRange[1]}자리
      </p>
    </div>
  )
}

// ── 주최자 카드 ──────────────────────────────────────────────────────────────
const ROLE_LABEL = {
  CERTIFIED: '인증주최자',
  SCHOOL_ADMIN: '학교총관리자',
  OPERATOR: '운영자',
  ATTENDEE: '일반사용자',
}

function HostCard({ host, hostEventCount }) {
  if (!host) return null
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 space-y-4">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">주최자</div>

      <div className="flex items-center gap-3">
        <UserAvatar user={host} size="lg" className="rounded-2xl" />
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-sm truncate">{host.name}</div>
          {host.school?.name && (
            <div className="text-xs text-gray-400 truncate">{host.school.name}</div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 font-semibold w-fit">
          {ROLE_LABEL[host.role] ?? host.role}
        </span>
        {host.roleMemo && (
          <div className="text-xs text-gray-400">{host.roleMemo}</div>
        )}
      </div>

      <div className="border-t border-gray-50" />

      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">진행한 행사</span>
          <span className="text-sm font-bold text-gray-800">{hostEventCount ?? 0}개</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">평균 별점</span>
          {host.hostRating != null && host.ratingCount > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-sm">★</span>
              <span className="text-sm font-bold text-gray-800">{Number(host.hostRating).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({host.ratingCount})</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">리뷰 없음</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 우측 신청 카드 ────────────────────────────────────────────────────────────
function RegistrationCard({ event, user, myReg, activeCount, navigate, applyMutation, cancelMutation, cancelPaidMutation, cancelPendingMutation, onPaidRegister, isPaying, nextRelease }) {
  const lockedCount = event.lockedCount ?? 0
  const remaining = event.capacity - activeCount - lockedCount
  const isFull = remaining <= 0
  const ratio = Math.min(100, Math.round(((activeCount + lockedCount) / event.capacity) * 100))
  const now = new Date()
  const isUpcoming = event.publishAt && new Date(event.publishAt) > now
  const releaseCutoff = event.releaseDeadline
    ? new Date(event.releaseDeadline)
    : event.startAt ? new Date(new Date(event.startAt).getTime() - 30 * 60_000) : null
  const isDeadlinePassed = !!releaseCutoff && now > releaseCutoff

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 space-y-4">
      {/* 가격 */}
      <div className="text-2xl font-black text-gray-900">
        {event.isPaid ? `${event.price?.toLocaleString()}원` : '무료'}
      </div>

      {/* 신청 현황 */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">신청 현황</span>
          <span className={`text-sm font-bold ${isFull ? 'text-red-500' : 'text-emerald-500'}`}>
            {isFull ? '마감' : `잔여 ${remaining}석`}
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-500"
            style={{ width: `${ratio}%` }}
          />
        </div>
        <div className="text-xs text-gray-400">{activeCount}/{event.capacity}명 신청</div>
      </div>

      {/* 화이트리스트 포함 안내 */}
      {event.isWhitelisted && (
        <p className="text-sm text-green-600 font-medium">✓ 화이트리스트에 포함되어 있습니다.</p>
      )}

      {/* 신청 버튼 */}
      <div className="space-y-2">
        {isUpcoming ? (
          <>
            <button disabled className="btn w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 text-base font-bold cursor-not-allowed">
              오픈 예정
            </button>
            <p className="text-xs text-center text-gray-400">
              오픈 예정: {fmtPublishAt(event.publishAt)}
            </p>
          </>
        ) : !user ? (
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary w-full py-3.5 rounded-2xl text-base font-bold"
          >
            로그인 후 신청하기
          </button>
        ) : myReg ? (
          <>
            <div className="py-2.5 text-center bg-gray-50 rounded-2xl text-sm">
              <span className="text-gray-500">신청 상태: </span>
              <span className="font-bold text-gray-800">{STATUS_LABEL[myReg.status] ?? myReg.status}</span>
            </div>
            {!event.isPaid && myReg.status === 'CONFIRMED' && (
              <button
                onClick={() => { if (confirm('신청을 취소하시겠습니까?')) cancelMutation.mutate(myReg.id) }}
                disabled={cancelMutation.isPending}
                className="btn w-full py-2.5 rounded-2xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition"
              >
                신청 취소
              </button>
            )}
            {myReg.status === 'PENDING_PAYMENT' && (
              <button
                onClick={() => { if (confirm('결제 대기를 취소하시겠습니까?')) cancelPendingMutation.mutate(myReg.orderId) }}
                disabled={cancelPendingMutation.isPending}
                className="btn w-full py-2.5 rounded-2xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition"
              >
                {cancelPendingMutation.isPending ? '처리 중...' : '신청 취소'}
              </button>
            )}
            {event.isPaid && myReg.status === 'CONFIRMED' && (
              <button
                onClick={() => { if (confirm('환불 신청 시 즉시 처리됩니다. 환불하시겠습니까?')) cancelPaidMutation.mutate(myReg.id) }}
                disabled={cancelPaidMutation.isPending}
                className="btn w-full py-2.5 rounded-2xl border border-red-200 text-red-500 text-sm hover:bg-red-50 transition"
              >
                {cancelPaidMutation.isPending ? '처리 중...' : '환불 신청'}
              </button>
            )}
          </>
        ) : event.status === 'CLOSED' ? (
          <>
            <button disabled className="btn w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 text-base font-bold cursor-not-allowed">
              신청 마감
            </button>
            <p className="text-xs text-center text-gray-400">
              {event.closedAt
                ? '호스트에 의해 조기 마감된 행사입니다.'
                : '신청 기간이 종료된 행사입니다.'}
            </p>
          </>
        ) : isDeadlinePassed ? (
          <>
            <button disabled className="btn w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 text-base font-bold cursor-not-allowed">
              신청 마감
            </button>
            <p className="text-xs text-center text-gray-400">
              {event.releaseDeadline
                ? `2차 신청마감(${fmtDate(event.releaseDeadline)} ${fmtTime(event.releaseDeadline)})이 지났습니다.`
                : '행사 시작 30분 전 신청이 마감되었습니다.'}
            </p>
          </>
        ) : event.status !== 'PUBLISHED' ? (
          <button disabled className="btn w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 text-base cursor-not-allowed">
            신청 불가
          </button>
        ) : isFull ? (
          <>
            <button disabled className="btn w-full py-3.5 rounded-2xl bg-gray-100 text-gray-500 text-base cursor-not-allowed">
              정원 마감
            </button>
            {nextRelease?.enabled && (
              <ReleaseCountdown nextReleaseAt={nextRelease.nextReleaseAt} pendingRange={nextRelease.pendingRange} />
            )}
          </>
        ) : event.isPaid ? (
          <button
            onClick={onPaidRegister}
            disabled={isPaying}
            className={`btn btn-primary w-full py-3.5 rounded-2xl text-base font-bold${isPaying ? ' opacity-50 cursor-not-allowed' : ''}`}
          >
            {isPaying ? '준비 중...' : `${event.price?.toLocaleString()}원 결제하기`}
          </button>
        ) : (
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="btn btn-primary w-full py-3.5 rounded-2xl text-base font-bold"
          >
            {applyMutation.isPending ? '신청 중...' : '지금 신청하기'}
          </button>
        )}
      </div>

      <p className="text-[11px] text-center text-gray-400">신청 후 이메일로 QR 티켓이 발송됩니다</p>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [isPaying, setIsPaying] = useState(false)

  const { data: event, isLoading, isError, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id),
  })

  const { data: bookmarkedIds = [] } = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: getBookmarkIds,
    enabled: !!user,
    staleTime: 60000,
  })

  const applyMutation = useMutation({
    mutationFn: () => createFreeRegistration(id),
    onSuccess: (res) => {
      alert(`신청이 완료되었습니다.\n\n${res.notice?.channels ?? ''}`)
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '신청에 실패했습니다.'),
  })

  const cancelMutation = useMutation({
    mutationFn: (regId) => cancelFreeRegistration(regId),
    onSuccess: () => {
      alert('신청이 취소되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '취소에 실패했습니다.'),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err) => alert(err.response?.data?.message ?? '공개에 실패했습니다.'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
    onError: (err) => alert(err.response?.data?.message ?? '마감에 실패했습니다.'),
  })

  const cancelPendingMutation = useMutation({
    mutationFn: (orderId) => cancelPendingPayment(orderId),
    onSuccess: () => {
      alert('신청이 취소되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '취소에 실패했습니다.'),
  })

  const cancelPaidMutation = useMutation({
    mutationFn: (regId) => cancelPaidRegistration(regId),
    onSuccess: () => {
      alert('환불 요청이 처리되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '환불 요청에 실패했습니다.'),
  })

  // UC-15: 다음 취소표 릴리즈 시각 (행사가 releaseIntervalMinutes 설정된 경우만)
  const { data: nextRelease } = useQuery({
    queryKey: ['next-release', id],
    queryFn: () => getNextRelease(id),
    enabled: !!event && event.status === 'PUBLISHED' && !!event.releaseIntervalMinutes,
    refetchInterval: 30_000,
  })

  const handlePaidRegistration = async () => {
    setIsPaying(true)
    try {
      let orderId, amount, eventTitle
      try {
        const res = await preparePayment(event.id)
        orderId = res.orderId; amount = res.amount; eventTitle = res.eventTitle
      } catch (err) {
        if (err.response?.data?.isWhitelisted) {
          setIsPaying(false)
          applyMutation.mutate()
          return
        }
        throw err
      }

      await new Promise((resolve, reject) => {
        if (window.TossPayments) return resolve()
        const script = document.createElement('script')
        script.src = 'https://js.tosspayments.com/v1'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })

      const tossPayments = window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY)
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName: eventTitle,
        customerName: user.name,
        successUrl: `${window.location.origin}/payment/result`,
        failUrl: `${window.location.origin}/payment/result`,
      })
    } catch (err) {
      alert(err.response?.data?.message ?? err.message ?? '결제 준비에 실패했습니다.')
      setIsPaying(false)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }


  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="w-full h-56 rounded-3xl bg-gray-100 animate-pulse mb-6" />
        <div className="h-7 bg-gray-100 rounded-full w-1/2 animate-pulse mb-3" />
        <div className="h-4 bg-gray-100 rounded-full w-1/4 animate-pulse" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center text-gray-400">
        {error?.response?.data?.message ?? '행사를 불러올 수 없습니다.'}
      </div>
    )
  }
  if (!event) return null

  const activeCount = event._count?.registrations ?? 0
  const myReg = event.myRegistration
  const isHost = user && (user.id === event.host?.id || user.role === 'SCHOOL_ADMIN' || user.role === 'OPERATOR')

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── 히어로 이미지 ── */}
      <div className="relative mb-6">
        <div className="w-full h-56 rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-100 via-purple-50 to-indigo-100">
          <img
            src={event.imageUrl || '/logo6.png'}
            alt={event.title}
            className={`w-full h-full ${event.imageUrl ? 'object-cover' : 'object-contain p-8 opacity-60'}`}
          />
        </div>

        {/* 뒤로 버튼 */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3.5 left-3.5 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-sm flex items-center justify-center text-gray-700 hover:bg-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 즐겨찾기 버튼 */}
        <div className="absolute top-3.5 right-3.5 flex flex-col items-center gap-0.5">
          <BookmarkButton
            eventId={event.id}
            isBookmarked={bookmarkedIds.includes(event.id)}
            className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white"
          />
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
            {bookmarkedIds.includes(event.id) ? '저장됨' : '즐겨찾기'}
          </span>
        </div>
      </div>

      {/* ── 본문 2컬럼 ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">

        {/* 왼쪽: 정보 */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 제목 + 주최자 */}
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">{event.title}</h1>
            <p className="text-sm text-gray-400 mt-1.5">
              주최: {event.hostNameSnapshot ?? event.host?.name}
            </p>
            {event.coHosts?.length > 0 && (
              <p className="text-sm text-gray-400 mt-0.5">
                공동주최: {event.coHosts.map(ch => ch.user?.name).filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* 공유 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${copied ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? '복사됨!' : '링크 복사'}
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FEE500] hover:bg-yellow-400 text-sm font-bold text-gray-900 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.485 1.39 4.685 3.5 6.095V20l3.228-1.614C9.742 18.779 10.86 19 12 19c5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
              </svg>
              카카오 공유
            </button>
          </div>

          {/* 일정 & 장소 카드 */}
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">
            {/* 날짜/시간 */}
            <div className="flex items-center gap-3 p-4">
              <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">행사 시작시간</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {fmtDate(event.startAt)} {fmtTime(event.startAt)}
                  {fmtTime(event.endAt) !== fmtTime(event.startAt) && ` ~ ${fmtTime(event.endAt)}`}
                </div>
              </div>
            </div>

            {/* 장소 */}
            {event.location && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">행사 장소</div>
                  <div className="text-sm text-gray-500 mt-0.5">{event.location}</div>
                </div>
              </div>
            )}

            {/* 1차 신청마감 */}
            {event.registrationDeadline && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">1차 신청마감</div>
                  <div className="text-sm text-gray-500 mt-0.5">{fmtDate(event.registrationDeadline)} {fmtTime(event.registrationDeadline)}</div>
                </div>
              </div>
            )}

            {/* 환불 마감 */}
            {event.isPaid && event.refundDeadlineAt && (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">환불 마감</div>
                  <div className="text-sm text-gray-500 mt-0.5">{fmtDate(event.refundDeadlineAt)} {fmtTime(event.refundDeadlineAt)}</div>
                </div>
              </div>
            )}

            {/* 2차 신청마감 */}
            {event.releaseDeadline ? (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">2차 신청마감</div>
                  <div className="text-sm text-gray-500 mt-0.5">{fmtDate(event.releaseDeadline)} {fmtTime(event.releaseDeadline)}</div>
                </div>
              </div>
            ) : event.releaseIntervalMinutes ? (
              <div className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">2차 신청마감</div>
                  <div className="text-sm text-gray-500 mt-0.5">행사 시작 30분 전 자동 마감</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 행사 설명 */}
          {event.description && (
            <div className="bg-white rounded-2xl shadow-sm p-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </div>
          )}

          {/* 환불 정책 (유료 행사) */}
          {event.isPaid && (event.refundDeadlineAt || event.refundContact) && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-1 text-sm">
              <div className="font-semibold text-amber-800">환불 정책</div>
              {event.refundDeadlineAt && (
                <div className="text-gray-600">
                  {fmtDate(event.refundDeadlineAt)} {fmtTime(event.refundDeadlineAt)}까지 본인 환불 가능
                </div>
              )}
              {event.refundContact && (
                <div className="text-gray-500">환불 마감 이후 문의: {event.refundContact}</div>
              )}
            </div>
          )}

          {/* Q&A 섹션 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <EventQnA eventId={id} user={user} isHost={isHost} />
          </div>

          {/* 리뷰 섹션 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <EventReview
              eventId={id}
              user={user}
              checkedIn={myReg?.status === 'CHECKED_IN'}
              eventEnded={event.endAt ? new Date(event.endAt) < new Date() : false}
            />
          </div>

        </div>

        {/* 오른쪽: 신청 카드 + 주최자 카드 (sticky) */}
        <div className="w-full lg:w-60 shrink-0 lg:sticky top-6 space-y-4">
          <RegistrationCard
            event={event}
            user={user}
            myReg={myReg}
            activeCount={activeCount}
            navigate={navigate}
            applyMutation={applyMutation}
            cancelMutation={cancelMutation}
            cancelPaidMutation={cancelPaidMutation}
            cancelPendingMutation={cancelPendingMutation}
            onPaidRegister={handlePaidRegistration}
            isPaying={isPaying}
            nextRelease={nextRelease}
          />
          <HostCard host={event.host} hostEventCount={event.hostEventCount} />
        </div>

      </div>
    </div>
  )
}
