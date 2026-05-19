const express = require('express')
const path = require('path')
const multer = require('multer')
const XLSX = require('xlsx')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const { requireRole, optionalAuth } = authMiddleware
const { cancelPayment } = require('../services/toss')
const supabase = require('../services/supabase')
const audit = require('../utils/audit')
const { releaseAll, getNextReleaseInfo } = require('../services/releaseService')

const STORAGE_BUCKET = 'event-images'

// 파일은 메모리에만 버퍼링 (디스크 사용 안 함 → 배포 환경 안전)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  fileFilter: (req, file, cb) => {
    cb(null, /image\/(jpeg|png|webp)/.test(file.mimetype))
  },
})

const router = express.Router()
const prisma = new PrismaClient()

// ── PDF 보고서 HTML 템플릿 ──────────────────────────────────────────────────
function buildReportHtml({ event, registrations, reviews, noShowRate, cancelRate, totalPaid, totalRefunded, avgRating, checkedIn, noShow, cancelled, totalReg }) {
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'

  const withMemo = (user) => user?.roleMemo ? `${user.name}(${user.roleMemo})` : user?.name ?? '?'
  const STATUS_KO = {
    CONFIRMED: { label: '발권완료', bg: '#dcfce7', color: '#166534' },
    CHECKED_IN: { label: '체크인', bg: '#ede9fe', color: '#5b21b6' },
    PENDING_PAYMENT: { label: '결제대기', bg: '#fef9c3', color: '#854d0e' },
    CANCELLATION_REQUESTED: { label: '환불대기', bg: '#dbeafe', color: '#1e40af' },
    REFUND_FAILED: { label: '환불실패', bg: '#fee2e2', color: '#991b1b' },
    CANCELLED: { label: '취소', bg: '#f3f4f6', color: '#6b7280' },
    EXPIRED: { label: '만료', bg: '#f3f4f6', color: '#9ca3af' },
  }

  const hostLabel = withMemo(event.host) !== '?' ? withMemo(event.host) : (event.hostNameSnapshot ?? '-')
  const coHostNames = (event.coHosts ?? []).map(ch => withMemo(ch.user)).join(', ') || '없음'

  const isEnded = event.endAt && new Date(event.endAt) < new Date()
  const statusLabel = isEnded ? '종료됨' : { DRAFT: '초안', PUBLISHED: '공개중', CLOSED: '마감됨', CANCELLED: '취소됨' }[event.status] ?? event.status
  const statusColor = isEnded ? '#64748b' : { DRAFT: '#d97706', PUBLISHED: '#16a34a', CLOSED: '#6b7280', CANCELLED: '#ef4444' }[event.status] ?? '#6b7280'

  const stars = avgRating !== null ? '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating)) : ''

  const regRows = registrations.map(r => {
    const s = STATUS_KO[r.status] ?? { label: r.status, bg: '#f3f4f6', color: '#374151' }
    return `
      <tr>
        <td>${r.user.name}</td>
        <td>${r.user.email}</td>
        <td>${r.user.studentId ?? '-'}</td>
        <td>${fmt(r.createdAt)}</td>
        <td><span class="badge" style="background:${s.bg};color:${s.color}">${s.label}</span></td>
        <td>${r.checkedInAt ? fmt(r.checkedInAt) : '-'}</td>
        ${event.isPaid ? `<td style="text-align:right">${(r.paidAmount ?? 0).toLocaleString()}</td><td style="text-align:right">${(r.refundedAmount ?? 0).toLocaleString()}</td>` : ''}
        <td>${r.cancelReason ?? '-'}</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 11px; color: #1f2937; background: #fff; }
  .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0; }
  .header-top { display: flex; align-items: center; justify-content: space-between; }
  .brand { font-size: 11px; opacity: 0.7; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
  .event-title { font-size: 20px; font-weight: 700; }
  .status-badge { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }
  .host-line { opacity: 0.8; margin-top: 4px; font-size: 11px; }

  .body { padding: 16px; }
  .section-title { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .info-card { background: #f9fafb; border-radius: 8px; padding: 12px; }
  .info-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #9ca3af; }
  .info-value { font-weight: 500; text-align: right; max-width: 60%; }

  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .stat-card { background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-num { font-size: 22px; font-weight: 800; color: #1f2937; }
  .stat-num.blue { color: #2563eb; }
  .stat-num.amber { color: #d97706; }
  .stat-num.red { color: #dc2626; }
  .stat-label { font-size: 10px; color: #9ca3af; margin-top: 2px; }

  .meta-row { display: flex; gap: 12px; margin-bottom: 16px; }
  .meta-card { background: #f9fafb; border-radius: 8px; padding: 10px 14px; flex: 1; }
  .meta-card .stars { color: #f59e0b; font-size: 14px; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #4f46e5; color: #fff; }
  th { padding: 7px 8px; text-align: left; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fafb; }
  .badge { padding: 2px 7px; border-radius: 20px; font-size: 9px; font-weight: 600; white-space: nowrap; }

  .footer { text-align: center; color: #d1d5db; font-size: 9px; margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">festicket · 행사 레포트</div>
    <div class="header-top">
      <div class="event-title">${event.title}</div>
      <span class="status-badge" style="background:${statusColor}33;border-color:${statusColor}66">${statusLabel}</span>
    </div>
    <div class="host-line">주최: ${hostLabel} ${coHostNames !== '없음' ? `· 공동주최: ${coHostNames}` : ''}</div>
  </div>

  <div class="body">
    <div class="info-grid">
      <div class="info-card">
        <div class="section-title">행사 정보</div>
        <div class="info-row"><span class="info-label">주최자</span><span class="info-value">${hostLabel}</span></div>
        ${coHostNames !== '없음' ? `<div class="info-row"><span class="info-label">공동호스트</span><span class="info-value" style="font-size:9px">${coHostNames}</span></div>` : ''}
        <div class="info-row"><span class="info-label">시작일시</span><span class="info-value">${fmt(event.startAt)}</span></div>
        <div class="info-row"><span class="info-label">종료일시</span><span class="info-value">${fmt(event.endAt)}</span></div>
        <div class="info-row"><span class="info-label">장소</span><span class="info-value">${event.location ?? '-'}</span></div>
        <div class="info-row"><span class="info-label">정원</span><span class="info-value">${event.capacity}명</span></div>
        <div class="info-row"><span class="info-label">요금</span><span class="info-value">${event.isPaid ? `${event.price?.toLocaleString()}원` : '무료'}</span></div>
      </div>
      <div class="info-card">
        <div class="section-title">마감 정보</div>
        <div class="info-row"><span class="info-label">1차 신청마감</span><span class="info-value">${fmt(event.registrationDeadline)}</span></div>
        ${event.isPaid ? `<div class="info-row"><span class="info-label">환불 마감</span><span class="info-value">${fmt(event.refundDeadlineAt)}</span></div>` : ''}
        <div class="info-row"><span class="info-label">2차 신청마감</span><span class="info-value">${event.releaseDeadline ? fmt(event.releaseDeadline) : '미설정 (시작 30분 전)'}</span></div>

      </div>
    </div>

    <div class="section-title">참가 통계</div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-num">${totalReg}</div><div class="stat-label">총 신청자</div></div>
      <div class="stat-card"><div class="stat-num blue">${checkedIn}</div><div class="stat-label">체크인</div></div>
      <div class="stat-card"><div class="stat-num amber">${noShowRate !== null ? noShowRate + '%' : '-'}</div><div class="stat-label">노쇼율</div></div>
      <div class="stat-card"><div class="stat-num red">${cancelRate !== null ? cancelRate + '%' : '-'}</div><div class="stat-label">취소율</div></div>
    </div>

    ${(event.isPaid || (isEnded && avgRating !== null)) ? `
    <div class="meta-row">
      ${event.isPaid ? `
      <div class="meta-card">
        <div class="section-title">결제 현황</div>
        <div style="display:flex;gap:24px;margin-top:4px">
          <div><div style="font-size:14px;font-weight:700;color:#4f46e5">${totalPaid.toLocaleString()}원</div><div style="color:#9ca3af;font-size:10px">총 결제액</div></div>
          <div><div style="font-size:14px;font-weight:700;color:#ef4444">${totalRefunded.toLocaleString()}원</div><div style="color:#9ca3af;font-size:10px">총 환불액</div></div>
          <div><div style="font-size:14px;font-weight:700;color:#059669">${(totalPaid - totalRefunded).toLocaleString()}원</div><div style="color:#9ca3af;font-size:10px">순수익</div></div>
        </div>
      </div>` : ''}
      ${isEnded && avgRating !== null ? `
      <div class="meta-card">
        <div class="section-title">리뷰</div>
        <div style="margin-top:4px;display:flex;align-items:center;gap:8px">
          <span class="stars">${stars}</span>
          <span style="font-size:18px;font-weight:800;color:#f59e0b">${avgRating.toFixed(1)}</span>
          <span style="color:#9ca3af">(${reviews.length}개)</span>
        </div>
      </div>` : ''}
    </div>` : ''}

    <div class="section-title" style="margin-bottom:8px">신청자 명단 (${registrations.length}명)</div>
    <table>
      <thead>
        <tr>
          <th>이름</th><th>이메일</th><th>학번</th><th>신청시각</th><th>상태</th><th>체크인시각</th>
          ${event.isPaid ? '<th>결제</th><th>환불</th>' : ''}
          <th>취소·환불 사유</th>
        </tr>
      </thead>
      <tbody>${regRows}</tbody>
    </table>

    <div class="footer">생성일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · festicket</div>
  </div>
</body>
</html>`
}

const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'REFUND_FAILED', 'CHECKED_IN']

// 관리 권한 헬퍼: 호스트 본인, 공동호스트, 같은 학교 SCHOOL_ADMIN, OPERATOR
function canManageEvent(user, event) {
  if (user.role === 'OPERATOR') return true
  if (user.role === 'SCHOOL_ADMIN' && user.schoolId === event.schoolId) return true
  if (event.hostId === user.id) return true
  if (event.coHosts?.some(ch => ch.userId === user.id)) return true
  return false
}

// ─── 이미지 업로드 ────────────────────────────────────────────────────────────

// POST /upload-image — 대표 이미지 업로드 (CERTIFIED 이상)
// 주의: /:id 보다 앞에 정의해야 'upload-image'가 :id로 매칭되지 않음
router.post('/upload-image', authMiddleware, requireRole('CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'),
  upload.single('image'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: '이미지 파일이 필요합니다. (JPG·PNG·WEBP, 최대 5MB)' })

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
    const storagePath = `events/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (error) {
      console.error('Supabase Storage upload error:', error)
      return res.status(500).json({ message: '이미지 업로드에 실패했습니다.', detail: error.message })
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    res.json({ imageUrl: publicUrl })
  }
)

// ─── 행사 CRUD ────────────────────────────────────────────────────────────────

// GET /mine — 내가 주최한 행사 목록 (호스트 본인, SCHOOL_ADMIN: 학교 전체)
// 주의: /:id 보다 앞에 정의해야 'mine'이 :id로 매칭되지 않음
router.get('/mine', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id
    let where = { deletedAt: null }

    if (req.user.role === 'SCHOOL_ADMIN') {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } })
      if (!me?.schoolId) return res.json([])
      where.schoolId = me.schoolId
    } else if (req.user.role === 'OPERATOR') {
      where.hostId = userId
    } else {
      // CERTIFIED 등: 본인이 주최하거나 공동호스트인 행사
      where = { deletedAt: null, OR: [{ hostId: userId }, { coHosts: { some: { userId } } }] }
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        school: { select: { id: true, name: true } },
        _count: {
          select: { registrations: { where: { status: { in: ACTIVE_STATUSES } } } },
        },
        reviews: { select: { rating: true } },
        registrations: { where: { status: 'CHECKED_IN' }, select: { id: true } },
        coHosts: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = events.map(({ reviews, registrations: checkedInRegs, coHosts, ...e }) => {
      const reviewCount = reviews.length
      const reviewAvg = reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
        : null
      const isCoHost = e.hostId !== userId && coHosts.some(ch => ch.userId === userId)
      return { ...e, reviewAvg, reviewCount, checkedInCount: checkedInRegs.length, isCoHost }
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /cohost-candidates — 공동호스트 후보 검색 (/:id 보다 앞에 정의해야 함)
router.get('/cohost-candidates', authMiddleware, async (req, res, next) => {
  try {
    const { schoolId, q } = req.query
    if (!schoolId) return res.status(400).json({ message: 'schoolId가 필요합니다.' })

    const nameEmailFilter = q ? [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ] : undefined

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: req.user.id },
        OR: [
          // 같은 학교 일반/인증/학교관리자
          {
            schoolId,
            role: { in: ['ATTENDEE', 'CERTIFIED', 'SCHOOL_ADMIN'] },
            ...(nameEmailFilter ? { OR: nameEmailFilter } : {}),
          },
          // 운영자는 학교 무관 검색
          {
            role: 'OPERATOR',
            ...(nameEmailFilter ? { OR: nameEmailFilter } : {}),
          },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      take: 20,
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

// POST /release-all — 취소표 일괄 릴리즈 (UC-14, 시스템 토큰 전용)
// 주의: /:id 보다 앞에 정의
router.post('/release-all', async (req, res, next) => {
  try {
    const token = req.headers['x-system-token']
    if (!token || token !== process.env.SYSTEM_TOKEN) {
      return res.status(401).json({ message: '시스템 토큰 인증 실패' })
    }
    const result = await releaseAll()
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET / — 행사 목록 조회 (UC-05, BR-01 비로그인 허용)
// 일반사용자: 본인 학교만(BR-02). 비로그인/SCHOOL_ADMIN/OPERATOR: schoolId 쿼리 우선, 없으면 전체.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { schoolId, status } = req.query
    const where = { deletedAt: null, status: status || { notIn: ['DRAFT', 'CANCELLED'] } }

    if (req.user?.role === 'ATTENDEE') {
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } })
      if (!me?.schoolId) return res.json([])
      where.schoolId = me.schoolId
    } else if (schoolId) {
      where.schoolId = schoolId
    }

    if (status) where.status = status

    const events = await prisma.event.findMany({
      where,
      include: {
        host: { select: { id: true, name: true, profileImageUrl: true } },
        school: { select: { id: true, name: true } },
        _count: {
          select: { registrations: { where: { status: { in: ACTIVE_STATUSES } } } },
        },
      },
      orderBy: { startAt: 'asc' },
    })
    res.json(events)
  } catch (err) {
    next(err)
  }
})

// GET /:id — 행사 상세 조회 (UC-05, 비로그인 허용)
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        host: {
          select: {
            id: true, name: true, email: true,
            role: true, roleMemo: true,
            hostRating: true, ratingCount: true,
            profileImageUrl: true,
            school: { select: { name: true } },
          },
        },
        school: { select: { id: true, name: true } },
        _count: {
          select: { registrations: { where: { status: { in: ACTIVE_STATUSES } } } },
        },
        coHosts: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    // BR-02: 일반사용자는 본인 학교 행사만 상세 조회 가능
    if (req.user?.role === 'ATTENDEE') {
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { schoolId: true } })
      if (me?.schoolId && event.schoolId !== me.schoolId) {
        return res.status(403).json({ message: '본인 학교 행사만 조회할 수 있습니다.' })
      }
    }

    // 누적 취소 자리 수 (UI 표시용)
    const cancelledCount = await prisma.registration.count({
      where: { eventId: event.id, status: { in: ['CANCELLED', 'EXPIRED'] } },
    })

    // BR-17: 릴리즈 대기 중인 잠긴 자리 수 — 프론트가 실제 가용 좌석 계산에 사용
    let lockedCount = 0
    if (event.releaseIntervalMinutes) {
      const since = event.lastReleaseAt ?? new Date(0)
      lockedCount = await prisma.registration.count({
        where: {
          eventId: event.id,
          status: { in: ['CANCELLED', 'EXPIRED'] },
          updatedAt: { gt: since },
        },
      })
    }

    // 본인 활성 신청 상태(로그인 시)
    let myRegistration = null
    if (req.user) {
      myRegistration = await prisma.registration.findFirst({
        where: { eventId: event.id, userId: req.user.id, status: { in: ACTIVE_STATUSES } },
        select: { id: true, status: true, orderId: true },
      })
    }

    // 본인 화이트리스트 포함 여부(로그인 + 학번 있을 때)
    let isWhitelisted = false
    if (req.user?.studentId) {
      const entry = await prisma.whitelistEntry.findFirst({
        where: { whitelist: { eventId: event.id }, studentId: req.user.studentId },
      })
      isWhitelisted = !!entry
    }

    // 주최자가 진행한 행사 수 (삭제되지 않은 공개 이상)
    const hostEventCount = await prisma.event.count({
      where: { hostId: event.hostId, deletedAt: null, status: { not: 'DRAFT' } },
    })

    res.json({ ...event, cancelledCount, lockedCount, myRegistration, isWhitelisted, hostEventCount })
  } catch (err) {
    next(err)
  }
})

// GET /:id/next-release — 다음 취소표 릴리즈 시각 조회 (UC-15, 비로그인 허용)
router.get('/:id/next-release', optionalAuth, async (req, res, next) => {
  try {
    const info = await getNextReleaseInfo(req.params.id)
    if (!info) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    res.json(info)
  } catch (err) {
    next(err)
  }
})

// POST / — 행사 생성 (UC-01)
router.post('/', authMiddleware, requireRole('CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'), async (req, res, next) => {
  try {
    const {
      title, description, location, schoolId,
      isPaid, price, capacity,
      startAt, endAt, registrationDeadline,
      releaseIntervalMinutes,
      imageUrl,
      publishAt,
      refundContact,
      refundDeadlineAt: refundDeadlineAtRaw,
      releaseDeadline: releaseDeadlineRaw,
      refundPolicyText, contactEmail, contactPhone,
      status: reqStatus,
    } = req.body

    const isDraft = reqStatus === 'DRAFT'
    if (!['DRAFT', 'PUBLISHED', undefined].includes(reqStatus)) {
      return res.status(400).json({ message: '유효하지 않은 status입니다.' })
    }

    if (!title) {
      return res.status(400).json({ message: '행사명은 필수입니다.' })
    }

    let startDate, endDate
    if (!isDraft) {
      if (!startAt || !endAt || !capacity) {
        return res.status(400).json({ message: '공개 행사는 시작/종료 시각과 정원이 필수입니다.' })
      }
      startDate = new Date(startAt)
      endDate = new Date(endAt)
      // BR-20: 시작 시각은 현재 이후
      if (startDate <= new Date()) {
        return res.status(400).json({ message: '행사 시작 시각은 현재 시각 이후여야 합니다. (BR-20)' })
      }
      if (endDate <= startDate) {
        return res.status(400).json({ message: '행사 종료 시각은 시작 시각 이후여야 합니다.' })
      }
      // BR-21: 신청 마감은 시작 이전
      if (registrationDeadline && new Date(registrationDeadline) >= startDate) {
        return res.status(400).json({ message: '신청 마감 시각은 행사 시작 이전이어야 합니다. (BR-21)' })
      }
      // BR-22: 정원 1 이상
      if (capacity < 1) {
        return res.status(400).json({ message: '정원은 1 이상이어야 합니다. (BR-22)' })
      }
      // BR-23: 유료 행사 최소 금액 100원
      if (isPaid && (!price || price < 100)) {
        return res.status(400).json({ message: '유료 행사는 100원 이상이어야 합니다. (BR-23)' })
      }
      // BR-24: 릴리즈 주기는 5/15/30/60 중 하나
      if (releaseIntervalMinutes != null && ![5, 15, 30, 60].includes(releaseIntervalMinutes)) {
        return res.status(400).json({ message: '취소표 릴리즈 주기는 5/15/30/60 중 하나여야 합니다. (BR-24)' })
      }
      if (publishAt) {
        const publishDate = new Date(publishAt)
        if (isNaN(publishDate.getTime())) {
          return res.status(400).json({ message: '유효하지 않은 오픈 시각입니다.' })
        }
        if (publishDate >= startDate) {
          return res.status(400).json({ message: '오픈 시각은 행사 시작 시각 이전이어야 합니다.' })
        }
      }
    } else {
      startDate = startAt ? new Date(startAt) : null
      endDate = endAt ? new Date(endAt) : null
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { school: { select: { name: true } } },
    })
    const targetSchoolId = schoolId || user.schoolId
    if (!targetSchoolId) return res.status(400).json({ message: '학교 정보가 없습니다.' })

    const refundDeadlineAt = refundDeadlineAtRaw ? new Date(refundDeadlineAtRaw) : null
    const releaseDeadline  = releaseDeadlineRaw  ? new Date(releaseDeadlineRaw)  : null

    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        schoolId: targetSchoolId,
        hostId: req.user.id,
        hostNameSnapshot: user.name,
        hostAffiliationSnapshot: user.school?.name ?? null,
        imageUrl: imageUrl ?? null,
        publishAt: publishAt ? new Date(publishAt) : null,
        isPaid: !!isPaid,
        price: isPaid ? price : null,
        capacity,
        startAt: startDate,
        endAt: endDate,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        releaseIntervalMinutes: releaseIntervalMinutes ?? null,
        refundContact: refundContact ?? null,
        refundDeadlineAt,
        releaseDeadline,
        refundPolicyText,
        contactEmail,
        contactPhone,
        status: isDraft ? 'DRAFT' : 'PUBLISHED',
      },
    })

    audit(req.user.id, 'CREATE_EVENT', 'EVENT', event.id, event.title)
    res.status(201).json(event)
  } catch (err) {
    next(err)
  }
})

// PUT /:id/publish — 행사 공개
router.put('/:id/publish', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { coHosts: { select: { userId: true } } } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!canManageEvent(user, event)) return res.status(403).json({ message: '권한이 없습니다.' })

    if (!event.startAt || !event.endAt || !event.capacity) {
      return res.status(400).json({ message: '공개하려면 시작/종료 시각과 정원을 먼저 입력해주세요.' })
    }
    if (new Date(event.startAt) <= new Date()) {
      return res.status(400).json({ message: '행사 시작 시각이 이미 지났습니다. 시작 시각을 수정 후 공개해주세요.' })
    }
    if (event.isPaid && (!event.price || event.price < 100)) {
      return res.status(400).json({ message: '유료 행사는 가격을 100원 이상으로 설정 후 공개해주세요.' })
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED' },
    })
    audit(req.user.id, 'PUBLISH_EVENT', 'EVENT', event.id, event.title)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// PUT /:id — 행사 수정 (UC-02)
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { coHosts: { select: { userId: true } } } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!canManageEvent(user, event)) return res.status(403).json({ message: '권한이 없습니다.' })

    const now = new Date()
    const isStarted = event.startAt <= now

    const {
      title, description, location,
      startAt, endAt, registrationDeadline,
      capacity, isPaid, price,
      releaseIntervalMinutes, imageUrl, publishAt,
      refundContact,
      refundDeadlineAt: refundDeadlineAtRaw,
      releaseDeadline: releaseDeadlineRaw,
    } = req.body

    // BR-26: 행사 시작 후에는 종료 시각만 수정 가능
    if (isStarted) {
      if (!endAt) return res.status(400).json({ message: '행사 시작 후에는 종료 시각만 수정할 수 있습니다. (BR-26)' })
      const newEnd = new Date(endAt)
      if (newEnd <= event.startAt) return res.status(400).json({ message: '종료 시각은 시작 시각 이후여야 합니다.' })
      const updated = await prisma.event.update({ where: { id: event.id }, data: { endAt: newEnd } })
      audit(req.user.id, 'UPDATE_EVENT', 'EVENT', event.id, event.title)
      return res.json(updated)
    }

    const activeCount = await prisma.registration.count({
      where: { eventId: event.id, status: { in: ACTIVE_STATUSES } },
    })

    // BR-25: 정원은 활성 신청자 수 이하로 줄일 수 없음
    if (capacity !== undefined && Number(capacity) < activeCount) {
      return res.status(400).json({ message: `정원은 현재 신청자 수(${activeCount}명) 이상이어야 합니다. (BR-25)` })
    }
    // BR-27: 유/무료 전환은 신청자 0명일 때만 가능
    if (isPaid !== undefined && !!isPaid !== event.isPaid && activeCount > 0) {
      return res.status(400).json({ message: '신청자가 있는 경우 유/무료 전환이 불가합니다. (BR-27)' })
    }

    const newStartAt = startAt ? new Date(startAt) : event.startAt
    const newEndAt = endAt ? new Date(endAt) : event.endAt

    if (startAt && newStartAt <= now) {
      return res.status(400).json({ message: '행사 시작 시각은 현재 시각 이후여야 합니다.' })
    }
    if (newEndAt <= newStartAt) {
      return res.status(400).json({ message: '종료 시각은 시작 시각 이후여야 합니다.' })
    }
    if (registrationDeadline && new Date(registrationDeadline) >= newStartAt) {
      return res.status(400).json({ message: '신청 마감은 행사 시작 이전이어야 합니다.' })
    }

    const data = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (location !== undefined) data.location = location
    if (startAt) data.startAt = newStartAt
    if (endAt) data.endAt = newEndAt
    if (registrationDeadline !== undefined) data.registrationDeadline = registrationDeadline ? new Date(registrationDeadline) : null
    if (capacity !== undefined) data.capacity = Number(capacity)
    if (isPaid !== undefined) { data.isPaid = !!isPaid; data.price = isPaid ? Number(price) : null }
    if (releaseIntervalMinutes !== undefined) data.releaseIntervalMinutes = Number(releaseIntervalMinutes)
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null
    if (publishAt !== undefined) data.publishAt = publishAt ? new Date(publishAt) : null
    if (refundContact !== undefined) data.refundContact = refundContact
    if (refundDeadlineAtRaw !== undefined) data.refundDeadlineAt = refundDeadlineAtRaw ? new Date(refundDeadlineAtRaw) : null
    if (releaseDeadlineRaw !== undefined) data.releaseDeadline = releaseDeadlineRaw ? new Date(releaseDeadlineRaw) : null

    const updated = await prisma.event.update({ where: { id: event.id }, data })
    audit(req.user.id, 'UPDATE_EVENT', 'EVENT', event.id, event.title)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// POST /:id/close — 행사 마감 (UC-03)
router.post('/:id/close', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { coHosts: { select: { userId: true } } } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!canManageEvent(user, event)) return res.status(403).json({ message: '권한이 없습니다.' })

    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ message: '공개 중인 행사만 마감할 수 있습니다.' })
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    audit(req.user.id, 'CLOSE_EVENT', 'EVENT', event.id, event.title)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// POST /:id/cancel — 행사 취소 (PUBLISHED → CANCELLED, 참가자 자동 환불)
router.post('/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const canCancel = user.role === 'OPERATOR' ||
      (user.role === 'SCHOOL_ADMIN' && user.schoolId === event.schoolId) ||
      event.hostId === user.id
    if (!canCancel) return res.status(403).json({ message: '권한이 없습니다.' })
    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ message: '공개 중인 행사만 취소할 수 있습니다.' })
    }

    const reason = req.body.cancelReason?.trim() || '행사 취소'

    const [paidCount, freeCount] = await Promise.all([
      event.isPaid ? prisma.registration.count({
        where: { eventId: event.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      }) : Promise.resolve(0),
      !event.isPaid ? prisma.registration.count({
        where: { eventId: event.id, status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'CHECKED_IN'] } },
      }) : Promise.resolve(0),
    ])

    await prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: event.id }, data: { status: 'CANCELLED' } })

      if (event.isPaid) {
        await tx.registration.updateMany({
          where: { eventId: event.id, status: 'PENDING_PAYMENT' },
          data: { status: 'EXPIRED' },
        })
        await tx.registration.updateMany({
          where: { eventId: event.id, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
          data: { status: 'CANCELLATION_REQUESTED', cancelReason: reason, nextRetryAt: null },
        })
      } else {
        await tx.registration.updateMany({
          where: { eventId: event.id, status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'CHECKED_IN'] } },
          data: { status: 'CANCELLED', cancelReason: reason },
        })
      }
    })

    if (event.isPaid) {
      const toRefund = await prisma.registration.findMany({
        where: { eventId: event.id, status: 'CANCELLATION_REQUESTED', idempotencyKey: null },
        select: { id: true },
      })
      for (const reg of toRefund) {
        await prisma.registration.update({
          where: { id: reg.id },
          data: { idempotencyKey: `${reg.id}-cancel-${Date.now()}` },
        })
      }
    }

    audit(req.user.id, 'CANCEL_EVENT', 'EVENT', event.id, `${event.title} — ${reason}`)
    res.json({ message: '행사가 취소되었습니다.', freeCancelled: freeCount, paidRefundQueued: paidCount })
  } catch (err) { next(err) }
})

// DELETE /:id — 초안 행사 삭제 (DRAFT 전용 soft delete)
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const canDelete = user.role === 'OPERATOR' ||
      (user.role === 'SCHOOL_ADMIN' && user.schoolId === event.schoolId) ||
      event.hostId === user.id
    if (!canDelete) return res.status(403).json({ message: '삭제 권한이 없습니다.' })
    if (event.status !== 'DRAFT') {
      return res.status(400).json({ message: '초안 행사만 삭제할 수 있습니다. 공개된 행사는 행사 취소를 이용해주세요.' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: event.id }, data: { deletedAt: new Date() } })
      await tx.eventQuestion.updateMany({
        where: { eventId: event.id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    })

    audit(req.user.id, 'DELETE_EVENT', 'EVENT', event.id, event.title)
    res.json({ message: '행사가 삭제되었습니다.' })
  } catch (err) { next(err) }
})

// ─── 참여자 관리 ──────────────────────────────────────────────────────────────

// GET /:eventId/registrations — 참여자 목록 조회 (호스트/관리자, UC-P07)
router.get('/:eventId/registrations', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findFirst({ where: { id: req.params.eventId }, include: { coHosts: { select: { userId: true } } } })
    if (!event) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!canManageEvent(user, event)) return res.status(403).json({ message: '권한이 없습니다.' })

    const registrations = await prisma.registration.findMany({
      where: { eventId: req.params.eventId },
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json(registrations)
  } catch (err) {
    next(err)
  }
})

// POST /:eventId/registrations/bulk-refund — 일괄 환불 트리거 (OPERATOR 전용)
// 주의: :regId/refund 보다 먼저 정의해야 'bulk-refund'가 :regId로 매칭되지 않음
router.post('/:eventId/registrations/bulk-refund', authMiddleware, requireRole('OPERATOR'), async (req, res, next) => {
  try {
    const { eventId } = req.params

    const regs = await prisma.registration.findMany({
      where: { eventId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
    })

    let queued = 0
    for (const reg of regs) {
      const idempotencyKey = reg.idempotencyKey || `${reg.id}-cancel-${Date.now()}`
      await prisma.registration.update({
        where: { id: reg.id },
        data: {
          status: 'CANCELLATION_REQUESTED',
          idempotencyKey,
          cancelReason: reg.cancelReason || '일괄 환불 처리',
          nextRetryAt: null,
        },
      })
      queued++
    }

    res.json({ message: `${queued}건의 환불이 큐에 등록되었습니다.` })
  } catch (err) {
    next(err)
  }
})

// POST /:eventId/registrations/:regId/refund — 관리자 환불 처리 (UC-P04)
router.post('/:eventId/registrations/:regId/refund', authMiddleware, async (req, res, next) => {
  try {
    const { eventId, regId } = req.params
    const { cancelReason } = req.body

    const [event, registration, user] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId }, include: { coHosts: { select: { userId: true } } } }),
      prisma.registration.findUnique({ where: { id: regId } }),
      prisma.user.findUnique({ where: { id: req.user.id } }),
    ])

    if (!event) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    if (!registration || registration.eventId !== eventId) {
      return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    }
    // BR-P02/P06: 환불 마감 여부 무관, 호스트/관리자는 처리 가능
    if (!canManageEvent(user, event)) return res.status(403).json({ message: '권한이 없습니다.' })
    if (!['CONFIRMED', 'CHECKED_IN'].includes(registration.status)) {
      return res.status(400).json({ message: '환불 처리할 수 없는 상태입니다.' })
    }
    if (!registration.paymentKey) {
      return res.status(400).json({ message: '결제 정보가 없습니다.' })
    }

    const idempotencyKey = `${registration.id}-cancel-${Date.now()}`

    // Phase 1: CANCELLATION_REQUESTED + 멱등키 + 처리자 기록
    await prisma.registration.update({
      where: { id: regId },
      data: {
        status: 'CANCELLATION_REQUESTED',
        idempotencyKey,
        cancelReason: cancelReason || '관리자 처리',
        cancelledBy: req.user.id,
      },
    })

    // Phase 2: 토스 결제 취소 API 호출
    try {
      await cancelPayment({
        paymentKey: registration.paymentKey,
        cancelReason: cancelReason || '관리자 처리',
        idempotencyKey,
      })

      await prisma.registration.update({
        where: { id: regId },
        data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
      })

      res.json({ message: '환불이 완료되었습니다.' })
    } catch (tossErr) {
      const tossCode = tossErr.response?.data?.code

      if (tossCode === 'ALREADY_CANCELED') {
        await prisma.registration.update({
          where: { id: regId },
          data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
        })
        return res.json({ message: '환불이 완료되었습니다.' })
      }

      // 일시적 실패 → 환불 큐에서 재시도
      await prisma.registration.update({
        where: { id: regId },
        data: { retryCount: 0, nextRetryAt: new Date(Date.now() + 60000) },
      })
      res.json({ message: '환불 요청이 접수되었습니다. 처리 중입니다.' })
    }
  } catch (err) {
    next(err)
  }
})

// ─── 공동호스트 관리 ───────────────────────────────────────────────────────────

// POST /:id/cohosts — 공동호스트 추가 (주 호스트만)
router.post('/:id/cohosts', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { coHosts: { select: { userId: true } } },
    })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    if (event.hostId !== req.user.id) return res.status(403).json({ message: '주 호스트만 공동호스트를 추가할 수 있습니다.' })

    const { userId } = req.body
    if (!userId) return res.status(400).json({ message: 'userId가 필요합니다.' })
    if (userId === req.user.id) return res.status(400).json({ message: '본인을 공동호스트로 추가할 수 없습니다.' })

    const candidate = await prisma.user.findUnique({ where: { id: userId } })
    if (!candidate || candidate.deletedAt) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    if (candidate.role !== 'OPERATOR' && candidate.schoolId !== event.schoolId) {
      return res.status(400).json({ message: '같은 학교 소속만 공동호스트로 추가할 수 있습니다.' })
    }
    if (!['ATTENDEE', 'CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'].includes(candidate.role)) {
      return res.status(400).json({ message: '유효하지 않은 사용자입니다.' })
    }
    if (event.coHosts.some(ch => ch.userId === userId)) {
      return res.status(409).json({ message: '이미 공동호스트로 등록된 사용자입니다.' })
    }

    const coHost = await prisma.eventCoHost.create({
      data: { eventId: event.id, userId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    })
    res.status(201).json(coHost)
  } catch (err) {
    next(err)
  }
})

// DELETE /:id/cohosts/:userId — 공동호스트 제거 (주 호스트만)
router.delete('/:id/cohosts/:userId', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    if (event.hostId !== req.user.id) return res.status(403).json({ message: '주 호스트만 공동호스트를 제거할 수 있습니다.' })

    await prisma.eventCoHost.deleteMany({
      where: { eventId: event.id, userId: req.params.userId },
    })
    res.json({ message: '공동호스트가 제거되었습니다.' })
  } catch (err) {
    next(err)
  }
})

// ─── 레포트 다운로드 ───────────────────────────────────────────────────────────
// GET /:eventId/report?format=csv|xlsx — 호스트(권한 회수 후에도), SCHOOL_ADMIN, OPERATOR (BR-06, BR-44)
router.get('/:eventId/report', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.params
    const format = ['xlsx', 'pdf'].includes(req.query.format) ? req.query.format : 'csv'

    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: {
        host: { select: { name: true, roleMemo: true } },
        coHosts: { include: { user: { select: { name: true, roleMemo: true } } } },
      },
    })
    if (!event) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    // BR-06: 호스트는 권한 회수 여부와 무관하게 접근 가능 — hostId로만 판정
    const isHost = event.hostId === req.user.id
    const isSchoolAdmin = req.user.role === 'SCHOOL_ADMIN' && req.user.schoolId === event.schoolId
    const isOperator = req.user.role === 'OPERATOR'
    if (!isHost && !isSchoolAdmin && !isOperator) {
      return res.status(403).json({ message: '레포트 다운로드 권한이 없습니다.' })
    }

    const [registrations, reviews] = await Promise.all([
      prisma.registration.findMany({
        where: { eventId },
        include: { user: { select: { name: true, email: true, studentId: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.review.findMany({ where: { eventId }, select: { rating: true } }),
    ])

    // 통계 계산
    const ACTIVE = ['CONFIRMED', 'CHECKED_IN', 'CANCELLATION_REQUESTED', 'REFUND_FAILED']
    const totalReg = registrations.filter(r => ACTIVE.includes(r.status)).length
    const checkedIn = registrations.filter(r => r.status === 'CHECKED_IN').length
    const noShow = registrations.filter(r => r.status === 'CONFIRMED').length
    const cancelled = registrations.filter(r => ['CANCELLED', 'EXPIRED'].includes(r.status)).length
    const totalPaid = registrations.reduce((s, r) => s + (r.paidAmount ?? 0), 0)
    const totalRefunded = registrations.reduce((s, r) => s + (r.refundedAmount ?? 0), 0)
    const attended = checkedIn + noShow  // 발권 완료 기준 (체크인 + 미체크인)
    const noShowRate = attended > 0 ? Math.round((noShow / attended) * 1000) / 10 : null
    const totalAll = registrations.length
    const cancelRate = totalAll > 0 ? Math.round((cancelled / totalAll) * 1000) / 10 : null
    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
      : null

    const ROLE_LABEL_KO = { CERTIFIED: '인증주최자', SCHOOL_ADMIN: '학교총관리자', OPERATOR: '운영자', ATTENDEE: '일반사용자' }
    const coHostNames = (event.coHosts ?? [])
      .map(ch => `${ch.user?.name ?? '?'} (${ROLE_LABEL_KO[ch.user?.role] ?? ch.user?.role})`)
      .join(', ')

    const fmt = (iso) => iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'

    // 행사 정보 섹션
    const infoRows = [
      ['행사명', event.title],
      ['주최자', event.hostNameSnapshot ?? event.host?.name ?? '-'],
      ['공동호스트', coHostNames || '없음'],
      ['시작일시', fmt(event.startAt)],
      ['종료일시', fmt(event.endAt)],
      ['장소', event.location ?? '-'],
      ['정원', event.capacity],
      ['요금', event.isPaid ? `${event.price?.toLocaleString()}원 (유료)` : '무료'],
      ['1차 신청마감', fmt(event.registrationDeadline)],
      ['환불 마감', event.isPaid ? fmt(event.refundDeadlineAt) : '-'],
      ['2차 신청마감', event.releaseDeadline ? fmt(event.releaseDeadline) : '미설정 (시작 30분 전)'],
      [''],
      ['총 신청자', totalReg],
      ['체크인', checkedIn],
      ['노쇼', noShow],
      ['취소', cancelled],
      ['노쇼율', noShowRate !== null ? `${noShowRate}%` : '-'],
      ['취소율', cancelRate !== null ? `${cancelRate}%` : '-'],
      ...(event.isPaid ? [
        ['총 결제액', `${totalPaid.toLocaleString()}원`],
        ['총 환불액', `${totalRefunded.toLocaleString()}원`],
      ] : []),
      ['리뷰 수', reviews.length],
      ['평균 평점', avgRating !== null ? `${avgRating.toFixed(1)} / 5.0` : '리뷰 없음'],
    ]

    // 신청자 명단 헤더 + 행
    const listHeader = ['이름', '이메일', '학번', '신청시각', '상태', '체크인시각', '결제금액', '환불금액', '취소·환불 사유']
    const listRows = registrations.map(r => [
      r.user.name,
      r.user.email,
      r.user.studentId ?? '-',
      fmt(r.createdAt),
      r.status,
      fmt(r.checkedInAt),
      r.paidAmount ?? 0,
      r.refundedAmount ?? 0,
      r.cancelReason ?? '-',
    ])

    // BR-44: 다운로드 로그 기록
    audit(req.user.id, 'DOWNLOAD_REPORT', 'EVENT', event.id, `${event.title} (${format})`)

    if (format === 'pdf') {
      const html = buildReportHtml({ event, registrations, reviews, infoRows, noShowRate, cancelRate, totalPaid, totalRefunded, avgRating, checkedIn, noShow, cancelled, totalReg })
      const { launchBrowser } = require('../utils/browser')
      const browser = await launchBrowser()
      try {
        const page = await browser.newPage()
        try {
          await page.setContent(html, { waitUntil: 'domcontentloaded' })
          const client = await page.createCDPSession()
          const { data } = await client.send('Page.printToPDF', {
            printBackground: true,
            paperWidth: 8.27,
            paperHeight: 11.69,
            marginTop: 16 / 25.4,
            marginBottom: 16 / 25.4,
            marginLeft: 14 / 25.4,
            marginRight: 14 / 25.4,
          })
          const pdfBuffer = Buffer.from(data, 'base64')
          res.setHeader('Content-Type', 'application/pdf')
          res.setHeader('Content-Disposition', `attachment; filename="report_${eventId}.pdf"`)
          return res.send(pdfBuffer)
        } finally {
          await page.close()
        }
      } finally {
        await browser.close()
      }
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new()

      const ws1 = XLSX.utils.aoa_to_sheet([['항목', '값'], ...infoRows])
      XLSX.utils.book_append_sheet(wb, ws1, '행사정보')

      const ws2 = XLSX.utils.aoa_to_sheet([listHeader, ...listRows])
      XLSX.utils.book_append_sheet(wb, ws2, '신청자명단')

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="report_${eventId}.xlsx"`)
      return res.send(buffer)
    }

    // CSV: 두 섹션을 빈 줄로 구분
    const escape = (v) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const toRow = (arr) => arr.map(escape).join(',')

    const csvLines = [
      '# 행사 정보',
      toRow(['항목', '값']),
      ...infoRows.map(toRow),
      '',
      '# 신청자 명단',
      toRow(listHeader),
      ...listRows.map(toRow),
    ]

    const BOM = '﻿' // UTF-8 BOM for Excel compatibility
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="report_${eventId}.csv"`)
    return res.send(BOM + csvLines.join('\r\n'))
  } catch (err) {
    next(err)
  }
})

module.exports = router
