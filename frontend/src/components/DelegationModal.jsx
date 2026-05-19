import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { useToast } from './Toast'

export default function DelegationModal({ onClose }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [eventPreview, setEventPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const handleSearch = async (value) => {
    setQuery(value)
    setSelected(null)
    setConfirm(false)
    setErrorMsg(null)
    setEventPreview(null)
    if (!value.trim()) return setSearchResults([])
    setSearching(true)
    try {
      const res = await api.get('/delegations/search', { params: { q: value } })
      setSearchResults(res.data)
    } catch (err) {
      toast(err.response?.data?.message || '검색에 실패했습니다.', 'error')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const delegateMutation = useMutation({
    mutationFn: () => api.post('/delegations', { toUserId: selected.id }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['my-events'] })
      toast(data.message, 'success')
      onClose()
    },
    onError: (err) => {
      const msg = err.response?.data?.message || '위임에 실패했습니다.'
      setErrorMsg(msg)
      setConfirm(false)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">권한 위임</h2>
            <p className="text-xs text-gray-400 mt-0.5">인증주최자 권한을 후임자에게 즉시 넘깁니다</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">권한 위임 안내</p>
            <p>위임 즉시 나는 일반 사용자로 전환되며, 선택한 사용자가 인증주최자가 됩니다.</p>
            <p>진행 중인 행사가 있으면 위임할 수 없습니다. 임시저장 행사는 후임자에게 자동 인수인계됩니다.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">후임자 검색 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="이름 또는 학번으로 검색"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-gray-400"
            />
            {searching && <p className="text-xs text-gray-400">검색 중...</p>}
            {!searching && searchResults.length > 0 && !selected && (
              <ul className="border border-gray-100 rounded-xl overflow-hidden">
                {searchResults.map(u => (
                  <li key={u.id}>
                    <button
                      onClick={() => { setSelected(u); setSearchResults([]); setErrorMsg(null); setEventPreview(null) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-800">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.studentId || u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searching && query.trim() && searchResults.length === 0 && !selected && (
              <p className="text-xs text-gray-400">검색 결과가 없습니다.</p>
            )}
          </div>

          {selected && (
            <div className="bg-primary-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary-800">{selected.name}</p>
                <p className="text-xs text-primary-500">{selected.studentId || selected.email}</p>
              </div>
              <button onClick={() => { setSelected(null); setQuery(''); setConfirm(false); setErrorMsg(null); setEventPreview(null) }} className="text-xs text-gray-400 hover:text-gray-600">변경</button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {selected && !confirm && (
            <button
              onClick={async () => {
                setLoadingPreview(true)
                try {
                  const res = await api.get('/delegations/events-preview')
                  setEventPreview(res.data)
                } catch {
                  setEventPreview({ published: 0, draft: 0, total: 0 })
                } finally {
                  setLoadingPreview(false)
                  setConfirm(true)
                }
              }}
              disabled={loadingPreview}
              className="btn-primary w-full justify-center disabled:opacity-50"
            >
              {loadingPreview ? '확인 중...' : '권한 위임하기'}
            </button>
          )}

          {confirm && (
            <div className="bg-red-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 text-center">
                정말 <span className="underline">{selected.name}</span>님에게 위임하시겠습니까?
              </p>
              <p className="text-xs text-red-500 text-center">위임 후 즉시 일반 사용자로 전환됩니다.</p>
              {eventPreview && eventPreview.total > 0 && (
                <div className="bg-white border border-red-200 rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-gray-700">함께 인수인계되는 행사</p>
                  <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                    {eventPreview.draft > 0 && <span>초안 <strong className="text-gray-800">{eventPreview.draft}건</strong></span>}
                    {eventPreview.ended > 0 && <span>종료됨 <strong className="text-gray-800">{eventPreview.ended}건</strong></span>}
                  </div>
                  <p className="text-xs text-gray-400">참가자 정보, 결제 내역 등 모든 행사 데이터가 이전됩니다.</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(false)}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={() => delegateMutation.mutate()}
                  disabled={delegateMutation.isPending}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition"
                >
                  {delegateMutation.isPending ? '위임 중...' : '확인, 위임합니다'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
