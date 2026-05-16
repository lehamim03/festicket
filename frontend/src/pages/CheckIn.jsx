import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checkin, getCheckinStats } from '../api/checkin'
import { getEventRegistrations } from '../api/events'
import QRScanner from '../components/QRScanner'

const ACTIVE_STATUSES = ['CONFIRMED', 'CHECKED_IN']

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function CheckIn() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [result, setResult] = useState(null)
  const [mode, setMode] = useState('reader')
  const [listTab, setListTab] = useState('all')
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['checkin-stats', id],
    queryFn: () => getCheckinStats(id),
    refetchInterval: 10000,
  })

  const { data: registrations = [], refetch: refetchList } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: () => getEventRegistrations(id),
    refetchInterval: 10000,
    select: (data) => data.filter(r => ACTIVE_STATUSES.includes(r.status)),
  })

  const mutation = useMutation({
    mutationFn: ({ qrCode, eventId }) => checkin(qrCode, eventId),
    onSuccess: (data) => {
      setResult(data)
      refetchStats()
      refetchList()
      if (inputRef.current) {
        inputRef.current.value = ''
        inputRef.current.focus()
      }
    },
  })

  const handleScan = (qrCode) => {
    if (mutation.isPending || !qrCode.trim()) return
    setResult(null)
    mutation.mutate({ qrCode: qrCode.trim(), eventId: id })
  }

  useEffect(() => {
    if (mode === 'reader') inputRef.current?.focus()
  }, [mode])

  const checkedIn = registrations.filter(r => r.status === 'CHECKED_IN')
  const notCheckedIn = registrations.filter(r => r.status === 'CONFIRMED')

  const listSource = listTab === 'checked' ? checkedIn
    : listTab === 'pending' ? notCheckedIn
    : registrations

  const filtered = search.trim()
    ? listSource.filter(r =>
        r.user.name.includes(search) ||
        (r.user.studentId ?? '').includes(search) ||
        r.user.email.includes(search)
      )
    : listSource

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link to={`/events/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← 행사로</Link>
        <h1 className="text-2xl font-bold text-gray-900">QR 체크인</h1>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{stats.checkedIn}</p>
            <p className="text-xs text-gray-500 mt-0.5">체크인 완료</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">총 참가자</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.remaining}</p>
            <p className="text-xs text-gray-500 mt-0.5">미입장</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* 왼쪽: 스캐너 */}
        <div className="space-y-4">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setMode('reader')}
              className={`flex-1 py-2.5 text-sm font-medium transition ${mode === 'reader' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              리더기 / 수동입력
            </button>
            <button
              onClick={() => setMode('camera')}
              className={`flex-1 py-2.5 text-sm font-medium transition ${mode === 'camera' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              카메라 스캔
            </button>
          </div>

          {mode === 'reader' ? (
            <div className="card p-5 space-y-3">
              <p className="text-sm text-gray-500">QR 리더기를 연결하거나 코드를 직접 입력하세요.</p>
              <input
                ref={inputRef}
                type="text"
                placeholder="QR 코드 값이 여기 입력됩니다"
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(e.target.value) }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                autoComplete="off"
              />
              <button
                onClick={() => handleScan(inputRef.current?.value || '')}
                disabled={mutation.isPending}
                className="btn-primary w-full py-2.5 disabled:opacity-50"
              >
                {mutation.isPending ? '확인 중...' : '체크인'}
              </button>
            </div>
          ) : (
            <QRScanner onScan={handleScan} />
          )}

          {result && (
            <div className={`p-5 rounded-2xl text-center font-medium border ${result.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {result.ok ? (
                <>
                  <p className="text-xl font-bold">✓ 체크인 완료</p>
                  <p className="text-sm mt-1 opacity-80">{result.user?.name} ({result.user?.email})</p>
                </>
              ) : (
                <p>{result.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 참가자 목록 */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-800 text-sm">참가자 목록</span>
              <span className="text-xs text-gray-400">{registrations.length}명</span>
            </div>

            {/* 탭 */}
            <div className="flex gap-1.5">
              {[
                { value: 'all', label: '전체', count: registrations.length },
                { value: 'checked', label: '입장 완료', count: checkedIn.length, color: 'text-green-700' },
                { value: 'pending', label: '미입장', count: notCheckedIn.length, color: 'text-orange-600' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setListTab(t.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    listTab === t.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label} <span className="opacity-75">{t.count}</span>
                </button>
              ))}
            </div>

            {/* 검색 */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 · 학번 · 이메일 검색"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <ul className="divide-y divide-gray-50 max-h-[300px] lg:max-h-[480px] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-8 text-center text-sm text-gray-400">표시할 참가자가 없습니다.</li>
            ) : (
              filtered.map(r => (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.status === 'CHECKED_IN' ? 'bg-green-50/40' : ''}`}>
                  {/* 상태 아이콘 */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    r.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {r.status === 'CHECKED_IN' ? '✓' : '–'}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{r.user.name}</span>
                      {r.user.studentId && (
                        <span className="text-xs text-gray-400">{r.user.studentId}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{r.user.email}</div>
                    {r.status === 'CHECKED_IN' && r.checkedInAt && (
                      <div className="text-xs text-green-600 mt-0.5">{fmtTime(r.checkedInAt)} 입장</div>
                    )}
                  </div>

                  {/* 상태 뱃지 */}
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                    r.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {r.status === 'CHECKED_IN' ? '입장 완료' : '미입장'}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

      </div>
    </div>
  )
}
