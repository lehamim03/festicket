import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { getMyRegistrations, cancelFreeRegistration } from '../api/registrations'
import { cancelPaidRegistration, cancelPendingPayment } from '../api/payments'
import { useAuth } from '../hooks/useAuth'
import TicketCalendar from '../components/TicketCalendar'

function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_LABEL = {
  PENDING_PAYMENT: '결제 대기',
  CONFIRMED: '신청 완료',
  CANCELLED: '취소됨',
  EXPIRED: '만료',
  CHECKED_IN: '입장 완료',
  REFUND_FAILED: '환불 실패',
  CANCELLATION_REQUESTED: '환불 처리 중',
}

export default function MyTickets() {
  const [tab, setTab] = useState('active')
  const [view, setView] = useState('list')
  const [payingId, setPayingId] = useState(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const handleRetryPayment = async (r) => {
    setPayingId(r.id)
    try {
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
        amount: r.event.price,
        orderId: r.orderId,
        orderName: r.event.title,
        customerName: user.name,
        successUrl: `${window.location.origin}/payment/result`,
        failUrl: `${window.location.origin}/payment/result`,
      })
    } catch (err) {
      alert(err.response?.data?.message ?? err.message ?? '결제 준비에 실패했습니다.')
    } finally {
      setPayingId(null)
    }
  }

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ['my-registrations', tab],
    queryFn: () => getMyRegistrations({ archived: tab === 'archived' }),
  })

  const cancelMutation = useMutation({
    mutationFn: cancelFreeRegistration,
    onSuccess: () => {
      alert('취소되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '취소 실패'),
  })

  const cancelPaidMutation = useMutation({
    mutationFn: cancelPaidRegistration,
    onSuccess: () => {
      alert('환불 요청이 처리되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '환불 요청 실패'),
  })

  const cancelPendingMutation = useMutation({
    mutationFn: cancelPendingPayment,
    onSuccess: () => {
      alert('신청이 취소되었습니다.')
      queryClient.invalidateQueries({ queryKey: ['my-registrations'] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '취소 실패'),
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">내 티켓</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            목록
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            캘린더
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="card p-5">
          <TicketCalendar registrations={regs} />
        </div>
      ) : null}

      {view === 'list' && (
      <div className="flex gap-2">
        <TabButton active={tab === 'active'} onClick={() => setTab('active')}>활성</TabButton>
        <TabButton active={tab === 'archived'} onClick={() => setTab('archived')}>지난 신청</TabButton>
      </div>
      )}

      {view === 'list' && (isLoading ? (
        <div className="card p-12 text-center text-gray-500">불러오는 중...</div>
      ) : regs.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">표시할 신청이 없습니다.</div>
      ) : (
        <ul className="space-y-3">
          {regs.map(r => (
            <TicketItem
              key={r.id} r={r} tab={tab}
              onCancel={(id) => cancelMutation.mutate(id)}
              onRefund={(id) => cancelPaidMutation.mutate(id)}
              onCancelPending={(orderId) => cancelPendingMutation.mutate(orderId)}
              onRetryPayment={() => handleRetryPayment(r)}
              isPaying={payingId === r.id}
            />
          ))}
        </ul>
      ))}
    </div>
  )
}

function TicketItem({ r, tab, onCancel, onRefund, onCancelPending, onRetryPayment, isPaying }) {
  const [showQR, setShowQR] = useState(false)
  const refundDeadlinePassed = r.event.refundDeadlineAt && new Date() > new Date(r.event.refundDeadlineAt)
  const canCancel = tab === 'active' && r.status === 'CONFIRMED' && !r.event.isPaid
  const canRefund = tab === 'active' && r.status === 'CONFIRMED' && r.event.isPaid && !refundDeadlinePassed
  const canCancelPending = tab === 'active' && r.status === 'PENDING_PAYMENT'
  const canRetryPayment = tab === 'active' && r.status === 'PENDING_PAYMENT' && r.event.isPaid
  const showQRBtn = r.status === 'CONFIRMED' || r.status === 'CHECKED_IN'

  return (
    <li className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to={`/events/${r.event.id}`} className="font-semibold text-gray-900 hover:underline line-clamp-1">
            {r.event.title}
          </Link>
          <div className="text-sm text-gray-500 mt-1">📍 {r.event.location ?? '-'}</div>
          <div className="text-sm text-gray-500">🕒 {fmtDateTime(r.event.startAt)}</div>
          <div className="text-xs text-gray-400 mt-2">
            상태: <span className="font-semibold text-gray-700">{STATUS_LABEL[r.status] ?? r.status}</span>
            {r.event.isPaid && r.event.refundDeadlineAt && (
              <span className="ml-2">· 환불 마감 {fmtDateTime(r.event.refundDeadlineAt)}</span>
            )}
          </div>
          {r.event.refundContact && (
            <div className="text-xs text-gray-400">문의: {r.event.refundContact}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {showQRBtn && (
            <button
              onClick={() => setShowQR(v => !v)}
              className="btn text-xs border border-primary-200 text-primary-600 hover:bg-primary-50 px-3 py-1.5"
            >
              {showQR ? 'QR 닫기' : 'QR 보기'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => { if (confirm('신청을 취소하시겠습니까?')) onCancel(r.id) }}
              className="btn text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5"
            >
              취소
            </button>
          )}
          {canRefund && (
            <button
              onClick={() => { if (confirm('환불 신청 시 즉시 처리됩니다. 환불하시겠습니까?')) onRefund(r.id) }}
              className="btn text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5"
            >
              환불 신청
            </button>
          )}
          {tab === 'active' && r.status === 'CONFIRMED' && r.event.isPaid && refundDeadlinePassed && (
            <span className="text-xs text-gray-400 px-3 py-1.5">환불 마감</span>
          )}
          {canRetryPayment && (
            <button
              onClick={onRetryPayment}
              disabled={isPaying}
              className="btn text-xs border border-primary-200 text-primary-600 hover:bg-primary-50 px-3 py-1.5 disabled:opacity-50"
            >
              {isPaying ? '결제 중...' : '결제하기'}
            </button>
          )}
          {canCancelPending && (
            <button
              onClick={() => { if (confirm('결제 대기를 취소하시겠습니까?')) onCancelPending(r.orderId) }}
              className="btn text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-3 py-1.5"
            >
              신청 취소
            </button>
          )}
        </div>
      </div>
      {showQR && (
        <div className="flex flex-col items-center gap-2 pt-2 border-t border-gray-100">
          <QRCodeSVG value={r.id} size={160} />
          <p className="text-xs text-gray-400">입장 시 이 QR을 제시하세요</p>
        </div>
      )}
    </li>
  )
}

function TicketCard({ reg, onCancel }) {
  const { event, status } = reg
  const canCancel = status === 'CONFIRMED' && !event.isPaid

  return (
    <div className="card p-5 flex items-start justify-between gap-4">
      <div className="space-y-1 flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate">{event.title}</div>
        <div className="text-sm text-gray-500">{fmtDateTime(event.startAt)}</div>
        {event.location && <div className="text-xs text-gray-400">{event.location}</div>}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[status]}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
        {canCancel && onCancel && (
          <button onClick={onCancel} className="text-xs text-red-400 hover:text-red-600">
            취소
          </button>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, children, ...rest }) {
  return (
    <button
      {...rest}
      className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
        active ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-100'
      }`}
    >
      {children}
    </button>
  )
}
