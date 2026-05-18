import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvents, publishEvent, deleteEvent } from '../api/events'
import { getSchools } from '../api/schools'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CONFIG = {
  DRAFT:     { label: '초안',   color: 'bg-amber-100 text-amber-700' },
  PUBLISHED: { label: '공개중', color: 'bg-green-100 text-green-700' },
  CLOSED:    { label: '종료됨', color: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-500' },
}

const TABS = [
  { value: 'all',       label: '전체' },
  { value: 'PUBLISHED', label: '공개중' },
  { value: 'DRAFT',     label: '초안' },
  { value: 'CLOSED',    label: '종료됨' },
  { value: 'CANCELLED', label: '취소됨' },
]

export default function AdminEvents() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => getEvents(),
  })

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: getSchools,
  })

  const publishMutation = useMutation({
    mutationFn: publishEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '공개 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
    onError: (err) => alert(err.response?.data?.message ?? '삭제 실패'),
  })

  const filtered = useMemo(() => {
    let list = allEvents
    if (tab !== 'all') list = list.filter(e => e.status === tab)
    if (schoolFilter) list = list.filter(e => e.schoolId === schoolFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.host?.name?.toLowerCase().includes(q) ||
        e.school?.name?.toLowerCase().includes(q)
      )
    }
    return list
  }, [allEvents, tab, schoolFilter, search])

  const countByStatus = (status) => allEvents.filter(e => e.status === status).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-gray-400 hover:text-gray-600 text-sm">← 대시보드</Link>
          <h1 className="text-2xl font-bold text-gray-900">행사 관리</h1>
        </div>
        <span className="text-sm text-gray-400">전체 {allEvents.length}건</span>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 상태 탭 */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.value
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100'
              }`}
            >
              {t.label}
              {t.value !== 'all' && (
                <span className="ml-1 opacity-70">{countByStatus(t.value)}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-2 sm:ml-auto">
          {/* 학교 필터 */}
          <select
            value={schoolFilter}
            onChange={e => setSchoolFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="">전체 학교</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* 검색 */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목 · 주최자 · 학교"
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 w-44"
          />
        </div>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="card p-12 text-center text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">표시할 행사가 없습니다.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">행사명</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">학교</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">주최자</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">시작일</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">신청</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">상태</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(event => {
                const cfg = STATUS_CONFIG[event.status] ?? { label: event.status, color: 'bg-gray-100 text-gray-500' }
                const attendees = event._count?.registrations ?? 0
                return (
                  <tr key={event.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/events/${event.id}`}
                          className="font-semibold text-gray-900 hover:text-primary-600 hover:underline line-clamp-1 max-w-[180px]"
                        >
                          {event.title}
                        </Link>
                        {event.isPaid && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 shrink-0">유료</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{event.school?.name ?? '-'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{event.host?.name ?? '-'}</td>
                    <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap">{fmtDate(event.startAt)}</td>
                    <td className="px-5 py-3.5 text-gray-600 font-medium">{attendees}명</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
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
                          <Link
                            to={`/events/${event.id}/edit`}
                            className="text-xs text-primary-600 hover:underline font-medium"
                          >
                            수정
                          </Link>
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
    </div>
  )
}
