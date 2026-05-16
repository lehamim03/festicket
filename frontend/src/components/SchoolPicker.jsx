import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function SchoolPicker({ schools, selectedSchoolId, onSelect }) {
  const [schoolSearch, setSchoolSearch] = useState('')
  const [expanded, setExpanded] = useState(false)

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.trim().toLowerCase())
  )

  const showAll = expanded || schoolSearch.trim().length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      {/* 윗줄: 전체 + 검색 + 접기 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSelect(null)}
          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            selectedSchoolId === null
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          🌐 전체
        </button>

        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={schoolSearch}
            onChange={e => setSchoolSearch(e.target.value)}
            placeholder="학교 검색..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          />
          {schoolSearch && (
            <button
              onClick={() => setSchoolSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-500 text-[10px] transition"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => { setExpanded(v => !v); setSchoolSearch('') }}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-all"
        >
          {expanded ? '접기' : '펼치기'}
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* 아랫줄: 학교 목록 */}
      <div className={`flex gap-2 ${showAll ? 'flex-wrap max-h-40 overflow-y-auto' : 'overflow-hidden'}`}>
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 py-1 px-1">검색 결과가 없어요</p>
        ) : filtered.map(school => (
          <button
            key={school.id}
            onClick={() => { onSelect(school.id); setExpanded(false); setSchoolSearch('') }}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedSchoolId === school.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-50 border border-gray-100 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            {school.name}
          </button>
        ))}
      </div>

      {/* 선택된 학교 표시 */}
      {selectedSchoolId && !showAll && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-indigo-600 font-semibold">
            {schools.find(s => s.id === selectedSchoolId)?.name} 보는 중
          </span>
          <div className="flex items-center gap-3">
            <Link
              to={`/schools/${selectedSchoolId}/events`}
              className="text-xs text-primary-500 font-semibold hover:text-primary-700 transition"
            >
              학교 행사 페이지 →
            </Link>
            <button onClick={() => onSelect(null)} className="text-xs text-gray-400 hover:text-gray-600 transition">
              전체로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
