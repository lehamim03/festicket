import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../api/notifications'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '방금 전'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function Notifications() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
  }

  const readMut = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate })
  const readAllMut = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteNotification, onSuccess: invalidate })

  const unreadCount = notifications.filter(n => !n.isRead).length

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card p-5 h-16 animate-pulse bg-gray-50" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">알림</h1>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="text-xs text-primary-600 font-semibold">미읽음 {unreadCount}개</span>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => readAllMut.mutate()}
              disabled={readAllMut.isPending}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition disabled:opacity-50"
            >
              모두 읽음
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">알림이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => { if (!n.isRead) readMut.mutate(n.id) }}
              className={`card p-4 cursor-pointer transition hover:shadow-md ${!n.isRead ? 'border-l-4 border-primary-400 bg-primary-50/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                    {n.title}
                  </p>
                  {n.content && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{n.content}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                  <span className="text-xs text-gray-400">{fmtDate(n.createdAt)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(n.id) }}
                    disabled={deleteMut.isPending}
                    className="text-gray-300 hover:text-red-400 transition text-lg leading-none pb-0.5 disabled:opacity-50"
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
              {(() => {
                if (!n.relatedTargetId && n.type !== 'CERT_REQUEST') return null
                const linkMap = {
                  NEW_QUESTION:      { to: `/events/${n.relatedTargetId}`,     label: '행사 Q&A 보기 →' },
                  QUESTION_ANSWERED: { to: `/events/${n.relatedTargetId}`,     label: '행사 Q&A 보기 →' },
                  NOTICE_PUBLISHED:  { to: `/notices/${n.relatedTargetId}`,    label: '공지 보기 →' },
                  CERT_REQUEST:      { to: user?.role === 'OPERATOR' ? `/admin/cert-requests` : `/school-admin`, label: '인증 신청 확인 →' },
                }
                const link = linkMap[n.type]
                if (!link) return null
                return (
                  <Link
                    to={link.to}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-primary-600 hover:underline mt-1 inline-block"
                  >
                    {link.label}
                  </Link>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
