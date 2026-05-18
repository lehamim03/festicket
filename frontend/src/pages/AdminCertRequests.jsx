import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdminAllCertRequests, adminApproveCertRequest, adminRejectCertRequest } from '../api/certRequests'
import { getSchools } from '../api/schools'
import { useToast } from '../components/Toast'

const STATUS_LABEL = { PENDING: '대기중', APPROVED: '승인', REJECTED: '거절' }
const STATUS_COLOR = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-500',
}
const ORG_LABEL = { STUDENT_COUNCIL: '학생회', CLUB: '동아리' }

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

function ReviewModal({ request, type, onClose }) {
  const [text, setText] = useState('')
  const toast = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      type === 'approve'
        ? adminApproveCertRequest(request.id, text)
        : adminRejectCertRequest(request.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cert-requests'] })
      toast(type === 'approve' ? '승인되었습니다.' : '거절되었습니다.', 'success')
      onClose()
    },
    onError: (err) => toast(err.response?.data?.message || '처리에 실패했습니다.', 'error'),
  })

  const isApprove = type === 'approve'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-bold text-gray-900">{isApprove ? '인증 승인' : '인증 거절'}</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {request.user?.name} · {request.user?.email}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
          <div className="flex gap-2">
            <span className="text-gray-400 w-16 shrink-0">구분</span>
            <span className="font-medium">{ORG_LABEL[request.organizationType] ?? request.organizationType}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 w-16 shrink-0">단체</span>
            <span className="font-medium">{request.organization}</span>
          </div>
          {request.expiresAt && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-16 shrink-0">임기 만료</span>
              <span className="font-medium">{fmtDate(request.expiresAt)}</span>
            </div>
          )}
          {request.message && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-16 shrink-0">메시지</span>
              <span className="text-gray-700">{request.message}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">
            {isApprove ? '승인 메모 *' : '거절 사유 *'}
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder={isApprove ? '예: 학생회 대표 확인됨' : '예: 서류 미비'}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!text.trim() || mutation.isPending}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition ${
              isApprove
                ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-200'
                : 'bg-red-500 hover:bg-red-600 disabled:bg-red-200'
            }`}
          >
            {mutation.isPending ? '처리 중...' : (isApprove ? '승인' : '거절')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminCertRequests() {
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-cert-requests', statusFilter, schoolFilter, search],
    queryFn: () => getAdminAllCertRequests({
      status: statusFilter || undefined,
      schoolId: schoolFilter || undefined,
      search: search || undefined,
    }),
  })

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: getSchools,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">인증주최자 신청 관리</h1>
        <p className="text-sm text-gray-400 mt-0.5">전체 학교의 인증신청을 조회·처리합니다.</p>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[
            { value: '', label: '전체' },
            { value: 'PENDING', label: '대기중' },
            { value: 'APPROVED', label: '승인' },
            { value: 'REJECTED', label: '거절' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                statusFilter === opt.value
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={schoolFilter}
          onChange={e => setSchoolFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="">전체 학교</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름·이메일·단체명 검색"
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 w-52"
        />
      </div>

      {/* 목록 */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">신청 내역이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 font-semibold uppercase tracking-wide">
                <th className="px-5 py-3 text-left">신청자</th>
                <th className="px-4 py-3 text-left">학교</th>
                <th className="px-4 py-3 text-left">구분·단체</th>
                <th className="px-4 py-3 text-left">담당 관리자</th>
                <th className="px-4 py-3 text-left">신청일</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-left">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-gray-800">{req.user?.name}</div>
                    <div className="text-xs text-gray-400">{req.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{req.school?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{req.organization}</div>
                    <div className="text-xs text-gray-400">
                      {ORG_LABEL[req.organizationType] ?? req.organizationType}
                      {req.expiresAt && ` · 만료 ${fmtDate(req.expiresAt)}`}
                    </div>
                    {req.contact && <div className="text-xs text-gray-400">{req.contact}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {req.targetAdmin
                      ? <span className="text-gray-600">{req.targetAdmin.name}</span>
                      : <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">운영자</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(req.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLOR[req.status]}`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                    {req.reviewNote && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-32 truncate" title={req.reviewNote}>
                        {req.reviewNote}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {req.status === 'PENDING' ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setModal({ request: req, type: 'approve' })}
                          className="px-3 py-1 text-xs font-semibold bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => setModal({ request: req, type: 'reject' })}
                          className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          거절
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{req.reviewedBy?.name ?? '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <ReviewModal
          request={modal.request}
          type={modal.type}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
