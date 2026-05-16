import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEventWhitelist,
  createEventWhitelist,
  addWhitelistEntry,
  uploadWhitelistFile,
  deleteWhitelistEntry,
} from '../api/whitelist'

export default function EventWhitelistManager({ eventId, hideTitle = false }) {
  const queryClient = useQueryClient()
  const [studentId, setStudentId] = useState('')
  const [search, setSearch] = useState('')
  const fileRef = useRef(null)

  const { data: whitelist, isLoading } = useQuery({
    queryKey: ['whitelist', eventId],
    queryFn: () => getEventWhitelist(eventId),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => createEventWhitelist(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whitelist', eventId] }),
    onError: (err) => alert(err.response?.data?.message ?? '생성 실패'),
  })

  const addMutation = useMutation({
    mutationFn: (id) => addWhitelistEntry(eventId, id),
    onSuccess: () => {
      setStudentId('')
      queryClient.invalidateQueries({ queryKey: ['whitelist', eventId] })
    },
    onError: (err) => alert(err.response?.data?.message ?? '추가 실패'),
  })

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadWhitelistFile(eventId, file),
    onSuccess: (res) => {
      alert(`업로드 완료\n추가: ${res.added}건 / 중복 제외: ${res.skipped}건`)
      queryClient.invalidateQueries({ queryKey: ['whitelist', eventId] })
      if (fileRef.current) fileRef.current.value = ''
    },
    onError: (err) => alert(err.response?.data?.message ?? '업로드 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: (entryId) => deleteWhitelistEntry(eventId, entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whitelist', eventId] }),
    onError: (err) => alert(err.response?.data?.message ?? '삭제 실패'),
  })

  const filteredEntries = useMemo(() => {
    if (!whitelist?.entries) return []
    const q = search.trim().toLowerCase()
    if (!q) return whitelist.entries
    return whitelist.entries.filter(e =>
      e.studentId.includes(q) ||
      (e.userName && e.userName.toLowerCase().includes(q))
    )
  }, [whitelist, search])

  if (isLoading) return <div className="text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!hideTitle && <h3 className="font-semibold text-gray-800">학생회비 납부자 화이트리스트</h3>}
        {!whitelist && (
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="btn btn-primary text-sm px-4 py-2"
          >
            화이트리스트 생성
          </button>
        )}
      </div>

      {!whitelist ? (
        <p className="text-sm text-gray-500">
          화이트리스트가 없습니다. 생성하면 등록된 학번의 학생이 이 행사에 무료로 신청할 수 있습니다.
        </p>
      ) : (
        <>
          {/* 학번 개별 추가 */}
          <div className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="학번 입력 (예: 12345678)"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && studentId.trim()) addMutation.mutate(studentId.trim())
              }}
            />
            <button
              onClick={() => studentId.trim() && addMutation.mutate(studentId.trim())}
              disabled={addMutation.isPending || !studentId.trim()}
              className="btn btn-primary px-4"
            >
              추가
            </button>
          </div>

          {/* CSV/TXT 일괄 업로드 */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 shrink-0">일괄 업로드 (txt/csv):</label>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              className="text-sm text-gray-600 flex-1"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadMutation.mutate(file)
              }}
            />
            {uploadMutation.isPending && <span className="text-xs text-gray-400">업로드 중...</span>}
          </div>

          {/* 검색 */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="학번 또는 이름으로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 목록 */}
          <div>
            <div className="text-sm text-gray-500 mb-2">
              {search
                ? `검색 결과 ${filteredEntries.length}건 / 전체 ${whitelist.entries.length}개`
                : `등록된 학번 ${whitelist.entries.length}개`
              }
            </div>
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-gray-400">
                {search ? '검색 결과가 없습니다.' : '등록된 학번이 없습니다.'}
              </p>
            ) : (
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left px-4 py-2">학번</th>
                      <th className="text-left px-4 py-2">이름</th>
                      <th className="text-left px-4 py-2">등록일</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-gray-50">
                        <td className="px-4 py-2 font-mono">{entry.studentId}</td>
                        <td className="px-4 py-2 text-gray-700">
                          {entry.userName ?? <span className="text-gray-300">미가입</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-400">
                          {new Date(entry.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`${entry.studentId}${entry.userName ? ` (${entry.userName})` : ''}를 삭제하시겠습니까?\n이미 신청된 티켓에는 영향이 없습니다.`)) {
                                deleteMutation.mutate(entry.id)
                              }
                            }}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
