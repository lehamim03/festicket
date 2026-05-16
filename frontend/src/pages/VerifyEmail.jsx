import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { verifyEmail, resendVerification } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const emailParam = params.get('email') || ''
  const [status, setStatus] = useState(token === 'expired' ? 'expired' : 'loading')
  const [resending, setResending] = useState(false)
  const [resendEmail, setResendEmail] = useState(emailParam)
  const called = useRef(false)
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    if (called.current) return
    called.current = true
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        const msg = err.response?.data?.message || ''
        if (msg.includes('만료')) setStatus('expired')
        else setStatus('error')
      })
  }, [])

  const handleResend = async () => {
    const email = user?.email || resendEmail.trim()
    if (!email) { toast('이메일을 입력해주세요.', 'error'); return }
    setResending(true)
    try {
      await resendVerification(email)
      toast('인증 메일을 재발송했습니다.', 'success')
    } catch (err) {
      toast(err.response?.data?.message || '재발송에 실패했습니다.', 'error')
    } finally {
      setResending(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">인증 처리 중...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center card p-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">이메일 인증 완료!</h2>
          <p className="text-sm text-gray-500 mb-6">이제 로그인해서 서비스를 이용하실 수 있습니다.</p>
          <Link to="/login" className="btn-primary w-full justify-center">로그인하러 가기</Link>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center card p-10">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">인증 링크가 만료됐어요</h2>
          <p className="text-sm text-gray-500 mb-6">
            인증 링크는 24시간 동안만 유효합니다.<br />
            {user ? '아래 버튼을 눌러 새 인증 메일을 받으세요.' : '로그인 후 인증 메일을 재발송할 수 있습니다.'}
          </p>
          {!user && (
            <input
              type="email"
              value={resendEmail}
              onChange={e => setResendEmail(e.target.value)}
              placeholder="가입한 이메일 입력"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          )}
          <button
            onClick={handleResend}
            disabled={resending}
            className="btn-primary w-full justify-center"
          >
            {resending ? '재발송 중...' : '인증 메일 재발송'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md text-center card p-10">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-2">유효하지 않은 링크예요</h2>
        <p className="text-sm text-gray-500 mb-6">이미 사용됐거나 올바르지 않은 링크입니다.</p>
        <Link to="/login" className="btn-primary w-full justify-center">로그인 페이지로</Link>
      </div>
    </div>
  )
}
