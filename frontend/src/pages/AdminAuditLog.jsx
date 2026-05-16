import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '../api/admin'

const ACTION_META = {
  REGISTER:              { label: '행사 신청',    color: 'bg-teal-100 text-teal-700' },
  CANCEL_FREE:           { label: '신청 취소',    color: 'bg-gray-100 text-gray-600' },
  PAYMENT_CONFIRM:       { label: '결제 완료',    color: 'bg-emerald-100 text-emerald-700' },
  CANCEL_PAID:           { label: '유료 취소',    color: 'bg-orange-100 text-orange-600' },
  REFUND_RETRY:          { label: '환불 재시도',  color: 'bg-amber-100 text-amber-700' },
  ADMIN_CANCEL:          { label: '티켓 강제취소', color: 'bg-rose-100 text-rose-600' },
  EDIT_USER:             { label: '사용자 수정',  color: 'bg-sky-100 text-sky-700' },
  CHANGE_ROLE:           { label: '역할 변경',    color: 'bg-blue-100 text-blue-700' },
  DELEGATION:            { label: '권한 위임',    color: 'bg-amber-100 text-amber-700' },
  REJECT_CERT:           { label: '인증 거절',    color: 'bg-red-100 text-red-600' },
  CREATE_EVENT:          { label: '행사 생성',    color: 'bg-indigo-100 text-indigo-700' },
  PUBLISH_EVENT:         { label: '행사 공개',    color: 'bg-green-100 text-green-700' },
  UPDATE_EVENT:          { label: '행사 수정',    color: 'bg-violet-100 text-violet-700' },
  CLOSE_EVENT:           { label: '행사 마감',    color: 'bg-gray-100 text-gray-600' },
  DELETE_EVENT:          { label: '행사 삭제',    color: 'bg-red-100 text-red-600' },
  DOWNLOAD_REPORT:       { label: '리포트 다운',  color: 'bg-slate-100 text-slate-600' },
  CHECKIN:               { label: '체크인',       color: 'bg-purple-100 text-purple-700' },
  CREATE_SCHOOL:         { label: '학교 등록',    color: 'bg-lime-100 text-lime-700' },
  UPDATE_SCHOOL:         { label: '학교 수정',    color: 'bg-yellow-100 text-yellow-700' },
  DELETE_SCHOOL:         { label: '학교 삭제',    color: 'bg-red-100 text-red-600' },
  UPDATE_SCHOOL_CONTACT: { label: '연락처 설정',  color: 'bg-cyan-100 text-cyan-700' },
  ANSWER_INQUIRY:        { label: '문의 답변',    color: 'bg-cyan-100 text-cyan-700' },
  DELETE_INQUIRY:        { label: '문의 삭제',    color: 'bg-gray-100 text-gray-500' },
}

const ROLE_LABEL = { ATTENDEE: '일반', CERTIFIED: '인증주최자', SCHOOL_ADMIN: '학교관리자', OPERATOR: '운영자' }
const ROLE_COLOR = {
  ATTENDEE: 'bg-gray-100 text-gray-600',
  CERTIFIED: 'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN: 'bg-purple-100 text-purple-700',
  OPERATOR: 'bg-orange-100 text-orange-700',
}

function fmtDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

const LIMIT_OPTIONS = [50, 100, 200, 500]

export default function AdminAuditLog() {
  const [action, setAction] = useState('')
  const [limit, setLimit] = useState(100)

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', action, limit],
    queryFn: () => getAuditLogs({ ...(action ? { action } : {}), limit }),
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link
        to="/admin"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        운영자 대시보드
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">감사 로그</h1>
          <p className="text-sm text-gray-400 mt-0.5">관리자 액션 기록</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary text-sm px-4 py-2 rounded-xl"
        >
          새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">전체 액션</option>
          {Object.entries(ACTION_META).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          {LIMIT_OPTIONS.map(n => (
            <option key={n} value={n}>{n}건</option>
          ))}
        </select>
        <span className="text-sm text-gray-400 ml-1">총 {logs.length}건</span>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">감사 로그가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">일시</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">액터</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">액션</th>
                <th className="text-left px-5 py-3.5 font-medium text-gray-600">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map(log => {
                const meta = ACTION_META[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-500' }
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap text-xs">
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{log.admin?.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${ROLE_COLOR[log.admin?.role]}`}>
                          {ROLE_LABEL[log.admin?.role] ?? log.admin?.role}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{log.admin?.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs max-w-xs truncate">
                      {log.detail || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
