import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NotificationBell from './NotificationBell'
import InquiryModal from './InquiryModal'
import CertRequestModal from './CertRequestModal'
import DelegationModal from './DelegationModal'
import UserAvatar from './UserAvatar'

const ROLE_LABEL = {
  ATTENDEE: '일반',
  CERTIFIED: '인증주최자',
  SCHOOL_ADMIN: '학교관리자',
  OPERATOR: '운영자',
}

const ROLE_COLOR = {
  ATTENDEE: 'bg-gray-100 text-gray-500',
  CERTIFIED: 'bg-blue-100 text-blue-700',
  SCHOOL_ADMIN: 'bg-purple-100 text-purple-700',
  OPERATOR: 'bg-orange-100 text-orange-700',
}

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [certOpen, setCertOpen] = useState(false)
  const [delegationOpen, setDelegationOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
    setOpen(false)
  }

  const expiryDaysLeft = (() => {
    if (!user?.roleExpiresAt) return null
    const diff = new Date(user.roleExpiresAt) - new Date()
    const days = Math.ceil(diff / 86400000)
    return days <= 7 ? days : null
  })()

  return (
    <>
    {expiryDaysLeft !== null && (
      <div className={`w-full text-center text-sm font-semibold py-2 px-4 flex items-center justify-center gap-3 ${
        expiryDaysLeft <= 3 ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900'
      }`}>
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        {expiryDaysLeft <= 0
          ? '인증주최자 임기가 오늘 만료됩니다.'
          : `인증주최자 권한이 ${expiryDaysLeft}일 후 만료됩니다.`
        }
        &nbsp;
        {user?.organizationType === 'CLUB' ? (
          <button
            onClick={() => setDelegationOpen(true)}
            className="underline font-bold hover:opacity-80 transition"
          >
            지금 위임하기 →
          </button>
        ) : (
          <span className="font-bold">재신청이 필요합니다.</span>
        )}
      </div>
    )}
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo6.png" alt="페스티켓 로고" className="h-8 w-auto" />
          <span className="font-black text-primary-600 text-lg tracking-tight whitespace-nowrap">페스티켓</span>
        </Link>

        <div className="flex items-center gap-1 min-w-0">
          {user && <NotificationBell />}
          <Link
            to="/notices"
            className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition whitespace-nowrap"
          >
            공지사항
          </Link>

        <div ref={ref} className="relative">
          {user ? (
            <>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-3 py-1.5 transition"
              >
                <UserAvatar user={user} size="sm" />
                <span className="text-sm font-semibold text-gray-800 max-w-[60px] sm:max-w-none truncate">{user.name}님</span>
                <span className={`hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${ROLE_COLOR[user.role]}`}>
                  {ROLE_LABEL[user.role]}
                </span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-52 max-w-[calc(100vw-1rem)] bg-white border border-gray-100 rounded-2xl shadow-modal py-1.5 text-sm">
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>
                  </div>

                  {user.role === 'OPERATOR' && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      운영자 대시보드
                    </Link>
                  )}

                  {user.role === 'SCHOOL_ADMIN' && (
                    <Link
                      to="/school-admin"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      학교 관리 대시보드
                    </Link>
                  )}

                  {['CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'].includes(user.role) && (
                    <Link
                      to="/my-events"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      내 행사 관리
                    </Link>
                  )}

                  <Link
                    to="/notices"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition sm:hidden"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    공지사항
                  </Link>
                  <Link
                    to="/my-tickets"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    내 티켓
                  </Link>
                  <Link
                    to="/my-bookmarks"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    즐겨찾기
                  </Link>

                  {user.role === 'ATTENDEE' && user.schoolId && (
                    <button
                      onClick={() => { setOpen(false); setCertOpen(true) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-blue-600 hover:bg-blue-50 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      인증주최자 신청
                    </button>
                  )}

                  {user.role === 'CERTIFIED' && user.organizationType === 'CLUB' && (
                    <button
                      onClick={() => { setOpen(false); setDelegationOpen(true) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-amber-600 hover:bg-amber-50 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      권한 위임
                    </button>
                  )}

                  <button
                    onClick={() => { setOpen(false); setInquiryOpen(true) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    1:1 문의
                  </button>

                  <button
                    onClick={() => { setOpen(false); navigate('/profile') }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    정보 수정
                  </button>

                  <div className="border-t border-gray-50 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary py-1.5 text-sm">로그인</Link>
              <Link to="/register" className="btn-primary py-1.5 text-sm">회원가입</Link>
            </div>
          )}
        </div>
        </div>
      </div>
    </header>

    {user && (
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {user.school?.adminContact && ['ATTENDEE', 'CERTIFIED'].includes(user.role) && (
          <a
            href={user.school.adminContact}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-white border border-gray-200 hover:border-primary-300 text-gray-700 hover:text-primary-600 pl-4 pr-5 py-3 rounded-full shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-sm font-semibold">학교관리자에게 문의</span>
          </a>
        )}
        <button
          onClick={() => setInquiryOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white pl-4 pr-5 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-sm font-semibold">문의하기</span>
        </button>
      </div>
    )}

    {inquiryOpen && <InquiryModal onClose={() => setInquiryOpen(false)} />}
    {certOpen && <CertRequestModal onClose={() => setCertOpen(false)} />}
    {delegationOpen && <DelegationModal onClose={() => setDelegationOpen(false)} />}
    </>
  )
}
