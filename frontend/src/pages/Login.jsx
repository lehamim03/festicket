import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { login as loginApi } from '../api/auth'
import { useToast } from '../components/Toast'

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const onSubmit = async (data) => {
    try {
      const { token, user } = await loginApi(data)
      login(token, user)
      navigate('/')
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        const email = err.response.data.email
        if (err.response.data.tokenExpired) {
          navigate(`/verify-email?token=expired&email=${encodeURIComponent(email)}`)
        } else {
          toast('이메일 인증이 필요합니다. 인증 메일을 확인해주세요.', 'error')
        }
      } else {
        toast(err.response?.data?.message || '로그인에 실패했습니다.', 'error')
      }
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">다시 만나서 반가워요</h1>
          <p className="text-gray-500 mt-1 text-sm">계정에 로그인하세요</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div>
              <label className="label">이메일</label>
              <input
                {...register('email', { required: '이메일을 입력하세요' })}
                type="email"
                placeholder="you@university.ac.kr"
                className="input"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                <Link to="/forgot-password" className="text-xs text-primary-500 hover:underline">
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <input
                {...register('password', { required: '비밀번호를 입력하세요' })}
                type="password"
                placeholder="••••••••"
                className="input"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 mt-1"
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <a
            href={`${import.meta.env.VITE_API_BASE_URL}/auth/kakao`}
            className="flex items-center justify-center gap-2.5 w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 py-3 rounded-xl font-medium transition mt-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.582 2 11c0 2.746 1.646 5.184 4.145 6.726L5.09 21l4.182-2.195A11.7 11.7 0 0012 19c5.523 0 10-3.582 10-8s-4.477-8-10-8z" />
            </svg>
            카카오로 시작하기
          </a>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">
            무료로 가입하기
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition underline underline-offset-2">
            로그인 없이 행사 둘러보기 →
          </Link>
        </p>
      </div>
    </div>
  )
}
