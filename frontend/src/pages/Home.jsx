import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEvents } from '../api/events'
import { getSchools } from '../api/schools'
import { getBookmarkIds } from '../api/bookmarks'
import EventCard from '../components/EventCard'
import HeroSection from '../components/HeroSection'
import SchoolPicker from '../components/SchoolPicker'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'

const PRICE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'free', label: '무료' },
  { value: 'paid', label: '유료' },
]

const DATE_FILTERS = [
  { value: 'all', label: '전체 날짜' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-100" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-4 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        <div className="h-1.5 bg-gray-100 rounded-full mt-2" />
      </div>
    </div>
  )
}

export default function Home() {
  const [search, setSearch] = useState('')
  const [priceFilter, setPriceFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]   = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState(null) // null = 전체(PUBLIC)
  const [showEnded, setShowEnded] = useState(false)
  const { user } = useAuth()

  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: getSchools })
  const { data: bookmarkedIds = [] } = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: getBookmarkIds,
    enabled: !!user,
    staleTime: 60000,
  })

  const { data: events, isLoading, isError } = useQuery({
    queryKey: ['events', selectedSchoolId],
    queryFn: () => getEvents(selectedSchoolId)
  })

  const filtered = useMemo(() => {
    if (!events) return []
    const now = new Date()
    const result = events.filter((e) => {
      const isEnded = e.endAt && new Date(e.endAt) < now
      if (!showEnded && isEnded) return false
      if (showEnded && !isEnded) return false

      if (search) {
        const q = search.toLowerCase()
        const hit = e.title.toLowerCase().includes(q)
          || e.location.toLowerCase().includes(q)
          || e.description?.toLowerCase().includes(q)
        if (!hit) return false
      }
      if (priceFilter === 'free' && e.price !== 0) return false
      if (priceFilter === 'paid' && e.price === 0) return false
      if (dateFilter !== 'all') {
        const start = new Date(e.startAt)
        if (dateFilter === 'today' && start.toDateString() !== now.toDateString()) return false
        if (dateFilter === 'week') {
          const week = new Date(now); week.setDate(now.getDate() + 7)
          if (start < now || start > week) return false
        }
        if (dateFilter === 'month') {
          const month = new Date(now); month.setMonth(now.getMonth() + 1)
          if (start < now || start > month) return false
        }
      }
      // 날짜 범위 필터
      if (dateFrom) {
        const from = new Date(dateFrom)
        if (new Date(e.startAt) < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(e.startAt) > to) return false
      }
      return true
    })
    // 종료된 행사는 최근 종료 순 정렬
    if (showEnded) result.sort((a, b) => new Date(b.endAt) - new Date(a.endAt))
    return result
  }, [events, search, priceFilter, dateFilter, dateFrom, dateTo, showEnded])

  const selectedSchool = schools.find(s => s.id === selectedSchoolId)

  const stats = events && events.length > 0 ? [
    { label: showEnded ? '종료된 행사' : '행사 모집 중', value: `${events.length}개` },
    { label: '총 모집 인원', value: `${events.reduce((s, e) => s + e.capacity, 0).toLocaleString()}명` },
    { label: '무료 행사', value: `${events.filter(e => e.price === 0).length}개` },
  ] : []

  return (
    <div className="space-y-6">
      {/* 히어로 */}
      <HeroSection eventCount={events?.length ?? 0} user={user} stats={stats} />

      {/* 학교 필터 */}
      {schools.length > 0 && (
        <SchoolPicker
          schools={schools}
          selectedSchoolId={selectedSchoolId}
          onSelect={setSelectedSchoolId}
        />
      )}

      {/* 검색 & 필터 */}
      <div id="events" className="flex flex-col gap-4">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="행사명 또는 장소로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11 py-3.5 rounded-2xl text-[15px]"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-card">
            {PRICE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPriceFilter(value)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  priceFilter === value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-2xl p-1 shadow-card">
            {DATE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setDateFilter(value); setDateFrom(''); setDateTo('') }}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                  dateFilter === value
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 날짜 범위 직접 입력 */}
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-3 py-1.5 shadow-card">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setDateFilter('all') }}
              className="text-sm text-gray-700 outline-none bg-transparent w-32"
            />
            <span className="text-gray-300 text-sm">~</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={e => { setDateTo(e.target.value); setDateFilter('all') }}
              className="text-sm text-gray-700 outline-none bg-transparent w-32"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-gray-300 hover:text-gray-500 transition ml-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* 종료된 행사 토글 */}
          <button
            onClick={() => { setShowEnded(v => !v); setDateFilter('all'); setDateFrom(''); setDateTo('') }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium border shadow-card transition-all ${
              showEnded
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-500 border-gray-100 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {showEnded ? '← 진행 중 행사' : '종료된 행사'}
          </button>
        </div>
      </div>

      {/* 결과 헤더 */}
      {!isLoading && !isError && (
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-gray-700">
            {filtered.length > 0
              ? `${showEnded ? '종료된 ' : ''}행사 ${filtered.length}개`
              : '결과 없음'}
          </h2>
          {(search || priceFilter !== 'all' || dateFilter !== 'all' || dateFrom || dateTo || showEnded) && (
            <button
              onClick={() => { setSearch(''); setPriceFilter('all'); setDateFilter('all'); setDateFrom(''); setDateTo(''); setShowEnded(false) }}
              className="text-xs text-primary-600 font-medium hover:underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      )}

      {/* 행사 목록 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : isError ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-gray-500 font-medium">행사 목록을 불러올 수 없습니다.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-gray-700 font-semibold mb-1">
            {showEnded
              ? (selectedSchool ? `${selectedSchool.name}의 종료된 행사가 없어요` : '종료된 행사가 없어요')
              : (selectedSchool ? `${selectedSchool.name}의 행사가 없어요` : '조건에 맞는 행사가 없어요')}
          </p>
          <p className="text-sm text-gray-400">다른 키워드나 필터로 검색해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((event) => <EventCard key={event.id} event={event} bookmarkedIds={bookmarkedIds} />)}
        </div>
      )}

      {/* 비로그인 CTA */}
      {!user && (
        <div className="bg-white rounded-3xl shadow-card p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <p className="font-bold text-gray-900">행사에 참여하고 싶으신가요?</p>
            <p className="text-sm text-gray-400 mt-0.5">로그인하면 신청·결제·QR 체크인까지 한 번에.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link to="/register" className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              회원가입
            </Link>
            <Link to="/login" className="btn-primary px-5 py-2.5 text-sm">
              로그인
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
