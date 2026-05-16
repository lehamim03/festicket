import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSchool } from '../api/schools'
import { getEvents } from '../api/events'
import { getBookmarkIds } from '../api/bookmarks'
import EventCard from '../components/EventCard'
import { useAuth } from '../hooks/useAuth'

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'PUBLISHED', label: '모집 중' },
  { value: 'CLOSED', label: '마감' },
]

export default function SchoolEvents() {
  const { schoolId } = useParams()
  const { user } = useAuth()
  const [status, setStatus] = useState('')

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => getSchool(schoolId),
  })

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', schoolId],
    queryFn: () => getEvents(schoolId),
  })

  const { data: bookmarkedIds = [] } = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: getBookmarkIds,
    enabled: !!user,
    staleTime: 60000,
  })

  const filtered = status ? events.filter(e => e.status === status) : events

  if (schoolLoading) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">불러오는 중...</div>
  )
  if (!school) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">학교를 찾을 수 없습니다.</div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* 학교 헤더 */}
      <div className="bg-white rounded-3xl shadow-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">{school.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">@{school.domain}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-black text-primary-600">{events.length}</p>
            <p className="text-xs text-gray-400">전체 행사</p>
          </div>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${
              status === t.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-100 hover:border-gray-200'
            }`}
          >
            {t.label}
            {t.value === '' && <span className="ml-1.5 text-xs opacity-70">{events.length}</span>}
            {t.value !== '' && (
              <span className="ml-1.5 text-xs opacity-70">
                {events.filter(e => e.status === t.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 행사 그리드 */}
      {eventsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-3xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400">등록된 행사가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => (
            <EventCard key={event.id} event={event} bookmarkedIds={bookmarkedIds} />
          ))}
        </div>
      )}

      {!user && (
        <div className="bg-primary-50 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-primary-800 text-sm">행사에 참여하고 싶으신가요?</p>
            <p className="text-xs text-primary-500 mt-0.5">로그인하면 신청할 수 있습니다.</p>
          </div>
          <Link to="/login" className="btn-primary text-sm px-4 py-2">로그인</Link>
        </div>
      )}
    </div>
  )
}
