import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { updateMe, deleteMe } from '../api/auth'
import { useToast } from '../components/Toast'
import api from '../api/axios'

function Section({ title, children }) {
  return (
    <div className="card p-6">
      <h2 className="text-base font-bold text-gray-900 mb-5">{title}</h2>
      {children}
    </div>
  )
}

function WithdrawModal({ onClose, onConfirm, isPending, isSchoolAdmin }) {
  const [input, setInput] = useState('')

  if (isSchoolAdmin) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-sm p-6">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">탈퇴 불가</h2>
          <p className="text-sm text-gray-500 mb-5">학교총관리자는 운영자에게 탈퇴 요청이 필요합니다.</p>
          <button onClick={onClose} className="btn-primary w-full justify-center">확인</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">정말 탈퇴하시겠어요?</h2>
        <p className="text-sm text-gray-500 mb-4">확인을 위해 아래에 <span className="font-semibold text-gray-700">탈퇴합니다</span>를 입력하세요.</p>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="탈퇴합니다"
          className="input mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">취소</button>
          <button
            onClick={onConfirm}
            disabled={input !== '탈퇴합니다' || isPending}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            {isPending ? '처리 중...' : '탈퇴'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const [info, setInfo] = useState({ name: user?.name || '', studentId: user?.studentId || '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' })

  const uploadImageMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('image', file)
      return api.post('/auth/profile-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }).then(r => r.data)
    },
    onSuccess: (data) => {
      updateUser({ ...user, profileImageUrl: data.profileImageUrl })
      setPreviewUrl(null)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast('프로필 사진이 변경되었습니다.', 'success')
    },
    onError: (err) => toast(err.response?.data?.message || '업로드에 실패했습니다.', 'error'),
  })

  const deleteImageMutation = useMutation({
    mutationFn: () => api.delete('/auth/profile-image').then(r => r.data),
    onSuccess: () => {
      updateUser({ ...user, profileImageUrl: null })
      setPreviewUrl(null)
      toast('프로필 사진이 삭제되었습니다.', 'success')
    },
    onError: () => toast('삭제에 실패했습니다.', 'error'),
  })

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return toast('파일 크기는 3MB 이하여야 합니다.', 'error')
    setPreviewUrl(URL.createObjectURL(file))
    uploadImageMutation.mutate(file)
    e.target.value = ''
  }

  const updateInfoMutation = useMutation({
    mutationFn: () => updateMe({ name: info.name, studentId: info.studentId || null }),
    onSuccess: (data) => {
      updateUser(data)
      toast('정보가 수정되었습니다.', 'success')
    },
    onError: (err) => toast(err.response?.data?.message || '수정에 실패했습니다.', 'error'),
  })

  const updatePwMutation = useMutation({
    mutationFn: () => updateMe({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    onSuccess: () => {
      toast('비밀번호가 변경되었습니다.', 'success')
      setPw({ currentPassword: '', newPassword: '', confirm: '' })
    },
    onError: (err) => toast(err.response?.data?.message || '변경에 실패했습니다.', 'error'),
  })

  const withdrawMutation = useMutation({
    mutationFn: deleteMe,
    onSuccess: () => {
      logout()
      navigate('/login')
      toast('탈퇴가 완료되었습니다.', 'success')
    },
    onError: (err) => toast(err.response?.data?.message || '탈퇴에 실패했습니다.', 'error'),
  })

  const handleInfoSubmit = (e) => {
    e.preventDefault()
    if (!info.name.trim()) return toast('이름을 입력해주세요.', 'error')
    updateInfoMutation.mutate()
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    if (!pw.currentPassword || !pw.newPassword) return toast('모든 항목을 입력해주세요.', 'error')
    if (pw.newPassword !== pw.confirm) return toast('새 비밀번호가 일치하지 않습니다.', 'error')
    if (pw.newPassword.length < 8) return toast('비밀번호는 8자 이상이어야 합니다.', 'error')
    updatePwMutation.mutate()
  }

  const isKakaoUser = !!user?.isKakaoUser

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-5">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">정보 수정</h1>
        <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
      </div>

      {/* 프로필 사진 */}
      <Section title="프로필 사진">
        <div className="flex items-center gap-5">
          {/* 아바타 */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary-100 flex items-center justify-center border-2 border-gray-100">
              {(previewUrl || user?.profileImageUrl) ? (
                <img src={previewUrl || user.profileImageUrl} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-primary-600">{user?.name?.slice(0, 1) ?? '?'}</span>
              )}
            </div>
            {uploadImageMutation.isPending && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadImageMutation.isPending}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
            >
              {uploadImageMutation.isPending ? '업로드 중...' : '사진 변경'}
            </button>
            {user?.profileImageUrl && (
              <button
                type="button"
                onClick={() => deleteImageMutation.mutate()}
                disabled={deleteImageMutation.isPending}
                className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-50"
              >
                {deleteImageMutation.isPending ? '삭제 중...' : '사진 삭제'}
              </button>
            )}
            <p className="text-xs text-gray-400">JPG · PNG · WEBP, 최대 3MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </Section>

      {/* 기본 정보 */}
      <Section title="기본 정보">
        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div>
            <label className="label">이름</label>
            <input
              value={info.name}
              onChange={e => setInfo(v => ({ ...v, name: e.target.value }))}
              className="input"
              placeholder="이름"
            />
          </div>
          <div>
            <label className="label">이메일</label>
            <input value={user?.email || ''} disabled className="input opacity-50 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">이메일은 변경할 수 없습니다.</p>
          </div>
          <div>
            <label className="label">학번 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input
              value={info.studentId}
              onChange={e => setInfo(v => ({ ...v, studentId: e.target.value }))}
              className="input"
              placeholder="학번"
            />
          </div>
          <div>
            <label className="label">학교</label>
            <input value={user?.school?.name || '소속 학교 없음'} disabled className="input opacity-50 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">학교는 변경할 수 없습니다.</p>
          </div>
          <div>
            <label className="label">역할</label>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-700 font-medium">
                {{ ATTENDEE: '일반 사용자', CERTIFIED: '인증 주최자', SCHOOL_ADMIN: '학교 총관리자', OPERATOR: '운영자' }[user?.role] ?? user?.role}
              </span>
              {user?.roleMemo && (
                <span className="text-xs text-gray-400">{user.roleMemo}</span>
              )}
              {user?.roleExpiresAt && (
                (() => {
                  const days = Math.ceil((new Date(user.roleExpiresAt) - new Date()) / 86400000)
                  return (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full w-fit ${
                      days <= 3 ? 'bg-red-100 text-red-600' :
                      days <= 7 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      임기 만료일: {new Date(user.roleExpiresAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {days > 0 ? ` (D-${days})` : ' (오늘 만료)'}
                    </span>
                  )
                })()
              )}
            </div>
          </div>
          <button type="submit" disabled={updateInfoMutation.isPending} className="btn-primary w-full justify-center">
            {updateInfoMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </form>
      </Section>

      {/* 비밀번호 변경 */}
      {!isKakaoUser && (
        <Section title="비밀번호 변경">
          <form onSubmit={handlePwSubmit} className="space-y-4">
            <div>
              <label className="label">현재 비밀번호</label>
              <input
                type="password"
                value={pw.currentPassword}
                onChange={e => setPw(v => ({ ...v, currentPassword: e.target.value }))}
                className="input"
                placeholder="현재 비밀번호"
              />
            </div>
            <div>
              <label className="label">새 비밀번호</label>
              <input
                type="password"
                value={pw.newPassword}
                onChange={e => setPw(v => ({ ...v, newPassword: e.target.value }))}
                className="input"
                placeholder="8자 이상"
              />
            </div>
            <div>
              <label className="label">새 비밀번호 확인</label>
              <input
                type="password"
                value={pw.confirm}
                onChange={e => setPw(v => ({ ...v, confirm: e.target.value }))}
                className="input"
                placeholder="새 비밀번호 재입력"
              />
            </div>
            <button type="submit" disabled={updatePwMutation.isPending} className="btn-primary w-full justify-center">
              {updatePwMutation.isPending ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </Section>
      )}

      {isKakaoUser && (
        <Section title="비밀번호 변경">
          <p className="text-sm text-gray-400">카카오 계정은 비밀번호를 변경할 수 없습니다.</p>
        </Section>
      )}

      {/* 회원 탈퇴 */}
      <Section title="회원 탈퇴">
        <p className="text-sm text-gray-500 mb-4">탈퇴 후 계정 정보는 보관되며 동일 이메일로 7일 이내 재가입이 불가합니다.</p>
        <button
          onClick={() => setShowWithdraw(true)}
          className="text-sm font-medium text-red-500 hover:text-red-700 hover:underline transition"
        >
          회원 탈퇴
        </button>
      </Section>

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onConfirm={() => withdrawMutation.mutate()}
          isPending={withdrawMutation.isPending}
          isSchoolAdmin={user?.role === 'SCHOOL_ADMIN'}
        />
      )}
    </div>
  )
}
