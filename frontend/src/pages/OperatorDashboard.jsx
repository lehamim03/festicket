import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '../api/admin'
import UserAvatar from '../components/UserAvatar'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const ROLE_LABEL = { ATTENDEE: '일반', CERTIFIED: '인증주최자', SCHOOL_ADMIN: '학교관리자', OPERATOR: '운영자' }
const ROLE_COLOR = {
  ATTENDEE: 'bg-gray-100 text-gray-600',
  CERTIFIED: 'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN: 'bg-purple-100 text-purple-700',
  OPERATOR: 'bg-orange-100 text-orange-700',
}
const STATUS_COLOR = {
  PUBLISHED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-500',
}
const STATUS_LABEL = { PUBLISHED: '공개', DRAFT: '초안', CANCELLED: '취소' }

function StatCard({ label, value, sub, color = 'text-primary-600' }) {
  return (
    <div className="card p-5">
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
      <p className="text-sm font-semibold text-gray-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function OperatorDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getAdminStats,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-full animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-50" />)}
        </div>
      </div>
    )
  }

  const u = stats?.users ?? {}
  const e = stats?.events ?? {}

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운영자 대시보드</h1>
        <p className="text-sm text-gray-400 mt-0.5">플랫폼 전체 현황</p>
      </div>

      {/* 환불 대기 알림 */}
      {((stats?.refundQueue?.pending ?? 0) + (stats?.refundQueue?.failed ?? 0)) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">처리 필요한 환불 건이 있습니다</p>
              <p className="text-xs text-red-400 mt-0.5">
                환불 처리 중 {stats.refundQueue.pending}건
                {stats.refundQueue.failed > 0 && (
                  <span className="ml-2 font-semibold">· 환불 실패 {stats.refundQueue.failed}건</span>
                )}
              </p>
            </div>
          </div>
          <Link
            to="/admin/refund-queue"
            className="text-xs font-semibold text-red-600 hover:underline shrink-0"
          >
            처리하러 가기 →
          </Link>
        </div>
      )}

      {/* 통계 카드 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">전체 통계</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="등록 학교" value={stats?.schools} color="text-indigo-600" />
          <StatCard
            label="전체 사용자"
            value={u.total}
            sub={`인증주최자 ${u.CERTIFIED ?? 0}명 · 학교관리자 ${u.SCHOOL_ADMIN ?? 0}명`}
            color="text-primary-600"
          />
          <StatCard
            label="공개 행사"
            value={e.PUBLISHED ?? 0}
            sub={`초안 ${e.DRAFT ?? 0}건 · 취소 ${e.CANCELLED ?? 0}건`}
            color="text-green-600"
          />
          <StatCard
            label="전체 행사"
            value={e.total}
            color="text-gray-700"
          />
        </div>
      </div>

      {/* 역할별 사용자 분포 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">역할별 사용자</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {['ATTENDEE', 'CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'].map(role => (
            <div key={role} className="card p-4 flex items-center gap-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_COLOR[role]}`}>
                {ROLE_LABEL[role]}
              </span>
              <span className="text-xl font-black text-gray-800">{u[role] ?? 0}</span>
              <span className="text-xs text-gray-400">명</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* 최근 가입 사용자 */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">최근 가입 사용자</span>
            <Link to="/admin/schools" className="text-xs text-primary-600 hover:underline">학교별 보기 →</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {(stats?.recentUsers ?? []).length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-gray-400">가입 사용자가 없습니다.</li>
            ) : (
              stats.recentUsers.map(user => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800 truncate">{user.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[user.role]}`}>
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                    {user.school && <div className="text-xs text-gray-300">{user.school.name}</div>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtDate(user.createdAt)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* 최근 생성 행사 */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">최근 생성 행사</span>
          </div>
          <ul className="divide-y divide-gray-50">
            {(stats?.recentEvents ?? []).length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-gray-400">생성된 행사가 없습니다.</li>
            ) : (
              stats.recentEvents.map(event => (
                <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        to={`/events/${event.id}`}
                        className="text-sm font-semibold text-gray-800 hover:underline truncate"
                      >
                        {event.title}
                      </Link>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[event.status]}`}>
                        {STATUS_LABEL[event.status]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {event.school?.name} · {event.host?.name}
                      {event.isPaid && <span className="ml-1 text-blue-400">유료</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500 font-medium">{event._count?.registrations ?? 0}명</div>
                    <div className="text-xs text-gray-300">{fmtDate(event.createdAt)}</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

      </div>

      {/* 바로가기 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">바로가기</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { to: '/admin/schools', label: '학교 관리', desc: '학교 등록·수정·삭제', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
            { to: '/admin/users', label: '유저 관리', desc: '전체 사용자 조회·역할 변경', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
            { to: '/admin/events', label: '행사 관리', desc: '전체 행사 공개·삭제', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { to: '/my-events', label: '내 행사 관리', desc: '내가 만든 행사', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { to: '/admin/notices', label: '공지 관리', desc: '전체 공지 작성·발행', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
            { to: '/admin/audit-logs', label: '감사 로그', desc: '관리자 액션 기록', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { to: '/admin/inquiries', label: '1:1 문의', desc: '사용자 문의 답변', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
          ].map(item => (
            <Link key={item.to} to={item.to} className="card p-4 flex items-center gap-3 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                  {item.to === '/admin/inquiries' && (stats?.pendingInquiries ?? 0) > 0 && (
                    <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                      {stats.pendingInquiries}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
