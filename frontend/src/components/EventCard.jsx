import { Link } from 'react-router-dom'
import BookmarkButton from './BookmarkButton'

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

const PALETTES = [
  { from: '#6366f1', to: '#8b5cf6' },
  { from: '#f43f5e', to: '#fb923c' },
  { from: '#14b8a6', to: '#0ea5e9' },
  { from: '#f59e0b', to: '#84cc16' },
  { from: '#ec4899', to: '#a855f7' },
  { from: '#3b82f6', to: '#06b6d4' },
]

function getPalette(id) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PALETTES[sum % PALETTES.length]
}

export default function EventCard({ event, bookmarkedIds = [] }) {
  const sold = event._count?.registrations ?? 0
  const remaining = event.capacity - sold
  const isFull = remaining <= 0
  const ratio = Math.min(100, Math.round((sold / event.capacity) * 100))
  const palette = getPalette(event.id)

  const date = new Date(event.startAt)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const weekday = date.toLocaleDateString('ko-KR', { weekday: 'short' })
  const time = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const isUpcoming = event.publishAt && new Date(event.publishAt) > new Date()
  const isEnded = event.endAt && new Date(event.endAt) < new Date()

  return (
    <Link to={`/events/${event.id}`} className="group block">
      <div className={`relative bg-white rounded-3xl border border-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-1.5 transition-all duration-300 overflow-hidden${isEnded ? ' opacity-80' : ''}`}>

        {/* 컬러 헤더 */}
        <div
          className="relative h-40 flex items-end p-5 overflow-hidden"
          style={{ background: event.imageUrl ? '#111' : `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
        >

          {/* 이미지 */}
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ objectPosition: event.imagePosition || '50% 50%' }}
            />
          )}

          {/* 이미지 있을 때 하단 오버레이 (뱃지 가독성) */}
          {event.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          )}

          {/* 날짜 블록 */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2.5">
              <span className="text-4xl font-black text-white leading-none">{day}</span>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] font-semibold text-white/90 leading-tight">{month}월</span>
                <span className="text-[11px] font-semibold text-white/70 leading-tight">{weekday}</span>
              </div>
            </div>
          </div>

          {/* 가격 뱃지 */}
          <div className="absolute top-4 right-4 z-10">
            <span className="bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
              {!event.isPaid || !event.price ? '무료' : `${event.price.toLocaleString()}원`}
            </span>
          </div>

          {/* 종료 오버레이 */}
          {isEnded && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-20">
              <span className="text-white text-sm font-bold px-5 py-2 rounded-full backdrop-blur-sm tracking-wide border border-white/30 bg-white/10">
                종료됨
              </span>
            </div>
          )}

          {/* 마감 오버레이 */}
          {isFull && event.status !== 'WAITING' && !isEnded && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
              <span className="bg-black/60 text-white text-sm font-bold px-5 py-2 rounded-full backdrop-blur-sm tracking-wide">
                마감
              </span>
            </div>
          )}

          {/* 상태/범위 뱃지 */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
            {event.status === 'WAITING' && (
              <span className="bg-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-full">모집대기</span>
            )}
            {event.scope === 'SCHOOL' && (
              <span className="inline-flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                🏫 {event.school?.name || '학교 한정'}
              </span>
            )}
          </div>
        </div>

        {/* 내용 */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-bold text-gray-900 text-[15px] line-clamp-1 group-hover:opacity-70 transition-opacity duration-200">
              {event.title}
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <BookmarkButton
                eventId={event.id}
                isBookmarked={bookmarkedIds.includes(event.id)}
                className="w-7 h-7 hover:scale-110"
              />
              {event.host?.isVerifiedHost && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 border border-indigo-100">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  인증 주최자
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex items-center gap-2 text-[13px] text-emerald-700 font-medium">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="line-clamp-1">{event.location}</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-amber-600 font-medium">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{month}월 {day}일 {time}</span>
            </div>
          </div>

          {/* 잔여석 프로그레스 */}
          {isEnded ? (
            <div className="text-[12px] text-gray-400 font-medium text-center py-1 border-t border-gray-50 pt-3">
              종료된 행사입니다
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[11px] text-gray-400 font-medium">모집 현황</span>
                <span className={`text-[11px] font-bold ${
                  event.status === 'WAITING' ? 'text-amber-500'
                  : isFull ? 'text-red-500'
                  : ratio >= 80 ? 'text-orange-500'
                  : 'text-emerald-600'
                }`}>
                  {event.status === 'WAITING' ? '신청 준비중' : isFull ? `마감 · 대기 ${event._count?.waitlist ?? 0}명` : `잔여 ${remaining}석`}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${ratio}%`,
                    background: isFull ? '#f87171'
                      : ratio >= 80 ? '#fb923c'
                      : `linear-gradient(90deg, ${palette.from}, ${palette.to})`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 오픈 예정 오버레이 */}
        {isUpcoming && (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl pointer-events-none">
            <div className="bg-white/90 shadow-sm rounded-2xl px-4 py-2.5 flex flex-col items-center gap-1">
              <span className="text-[12px] font-black text-gray-700 tracking-wide">오픈 예정</span>
              <span className="text-[10px] font-semibold text-gray-500 text-center">
                {fmtPublishAt(event.publishAt)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
