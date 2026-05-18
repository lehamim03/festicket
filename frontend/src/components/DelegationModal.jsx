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

  const handleSearch = async (value) => {
    setQuery(value)
    setSelected(null)
    setConfirm(false)
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
      toast(data.message, 'success')
      onClose()
    },
    onError: (err) => toast(err.response?.data?.message || '위임에 실패했습니다.', 'error'),
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
            <p>진행 중인 행사가 없어야 위임할 수 있습니다.</p>
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
                      onClick={() => { setSelected(u); setSearchResults([]) }}
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
              <button onClick={() => { setSelected(null); setQuery(''); setConfirm(false) }} className="text-xs text-gray-400 hover:text-gray-600">변경</button>
            </div>
          )}

          {selected && !confirm && (
            <button
              onClick={() => setConfirm(true)}
              className="btn-primary w-full justify-center"
            >
              권한 위임하기
            </button>
          )}

          {confirm && (
            <div className="bg-red-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 text-center">
                정말 <span className="underline">{selected.name}</span>님에게 위임하시겠습니까?
              </p>
              <p className="text-xs text-red-500 text-center">위임 후 즉시 일반 사용자로 전환됩니다.</p>
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
