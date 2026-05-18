import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import KakaoCallback from './pages/KakaoCallback'
import KakaoRegister from './pages/KakaoRegister'
import VerifyEmail from './pages/VerifyEmail'
import PrivateRoute from './components/PrivateRoute'
import OperatorRoute from './components/OperatorRoute'
import SchoolAdminRoute from './components/SchoolAdminRoute'
import OperatorDashboard from './pages/OperatorDashboard'
import AdminEvents from './pages/AdminEvents'
import AdminAuditLog from './pages/AdminAuditLog'
import AdminUsers from './pages/AdminUsers'
import AdminRefundQueue from './pages/AdminRefundQueue'
import SchoolManage from './pages/SchoolManage'
import SchoolDetail from './pages/SchoolDetail'
import SchoolAdminDashboard from './pages/SchoolAdminDashboard'
import Home from './pages/Home'
import EventDetail from './pages/EventDetail'
import EventCreate from './pages/EventCreate'
import EventEdit from './pages/EventEdit'
import EventManage from './pages/EventManage'
import MyTickets from './pages/MyTickets'
import MyBookmarks from './pages/MyBookmarks'
import SchoolEvents from './pages/SchoolEvents'
import MyEvents from './pages/MyEvents'
import CheckIn from './pages/CheckIn'
import Profile from './pages/Profile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentFail from './pages/PaymentFail'
import PaymentResult from './pages/PaymentResult'
import Header from './components/Header'
import Notices from './pages/Notices'
import NoticeDetail from './pages/NoticeDetail'
import AdminNotices from './pages/AdminNotices'
import SchoolAdminNotices from './pages/SchoolAdminNotices'
import Notifications from './pages/Notifications'
import AdminInquiries from './pages/AdminInquiries'
import AdminCertRequests from './pages/AdminCertRequests'
import Footer from './components/Footer'

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#e9e4ff]">
      <Header />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/kakao" element={<KakaoRegister />} />
        <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<div className="max-w-6xl mx-auto px-4 py-6"><Home /></div>} />
        <Route path="/events/create" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><EventCreate /></div></PrivateRoute>} />
        <Route path="/events/:id/edit" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><EventEdit /></div></PrivateRoute>} />
        <Route path="/events/:id/manage" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><EventManage /></div></PrivateRoute>} />
        <Route path="/events/:id" element={<div className="max-w-6xl mx-auto px-4 py-6"><EventDetail /></div>} />
        {/* UC-05 BR-01: 비로그인 방문자도 행사 목록·상세 조회 가능 */}
        <Route path="/" element={<div className="max-w-6xl mx-auto px-4 py-6"><Home /></div>} />
        <Route path="/events/:id" element={<div className="max-w-6xl mx-auto px-4 py-6"><EventDetail /></div>} />
        {/* UC-01 행사 생성 (CERTIFIED 이상 — 백엔드에서 권한 검사) */}
        <Route path="/events/new" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><EventCreate /></div></PrivateRoute>} />
        {/* UC-13 내 티켓 */}
        <Route path="/my-tickets" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><MyTickets /></div></PrivateRoute>} />
        <Route path="/my-bookmarks" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><MyBookmarks /></div></PrivateRoute>} />
        <Route path="/schools/:schoolId/events" element={<SchoolEvents />} />
        <Route path="/my-events" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><MyEvents /></div></PrivateRoute>} />
        <Route path="/events/:id/checkin" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><CheckIn /></div></PrivateRoute>} />
        <Route path="/admin" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><OperatorDashboard /></div></OperatorRoute>} />
        <Route path="/admin/events" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminEvents /></div></OperatorRoute>} />
        <Route path="/admin/audit-logs" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminAuditLog /></div></OperatorRoute>} />
        <Route path="/admin/users" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminUsers /></div></OperatorRoute>} />
        <Route path="/admin/refund-queue" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminRefundQueue /></div></OperatorRoute>} />
        <Route path="/admin/schools" element={<OperatorRoute><SchoolManage /></OperatorRoute>} />
        <Route path="/admin/schools/:schoolId" element={<OperatorRoute><SchoolDetail /></OperatorRoute>} />
        <Route path="/payment/success" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><PaymentSuccess /></div></PrivateRoute>} />
        <Route path="/payment/fail" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><PaymentFail /></div></PrivateRoute>} />
        <Route path="/payment/result" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><PaymentResult /></div></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/school-admin" element={<SchoolAdminRoute><SchoolAdminDashboard /></SchoolAdminRoute>} />
        <Route path="/school-admin/notices" element={<SchoolAdminRoute><div className="max-w-6xl mx-auto px-4 py-6"><SchoolAdminNotices /></div></SchoolAdminRoute>} />
        <Route path="/notices" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><Notices /></div></PrivateRoute>} />
        <Route path="/notices/:id" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><NoticeDetail /></div></PrivateRoute>} />
        <Route path="/admin/notices" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminNotices /></div></OperatorRoute>} />
        <Route path="/admin/inquiries" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminInquiries /></div></OperatorRoute>} />
        <Route path="/admin/cert-requests" element={<OperatorRoute><div className="max-w-6xl mx-auto px-4 py-6"><AdminCertRequests /></div></OperatorRoute>} />
        <Route path="/notifications" element={<PrivateRoute><div className="max-w-6xl mx-auto px-4 py-6"><Notifications /></div></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  )
}
