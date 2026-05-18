const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const audit = require('../utils/audit')

const router = express.Router()
const prisma = new PrismaClient()

const OPERATOR = requireRole('OPERATOR')

// GET /api/admin/stats — 플랫폼 전체 통계
router.get('/stats', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const [
      totalSchools,
      totalUsers,
      usersByRole,
      totalEvents,
      eventsByStatus,
      recentUsers,
      recentEvents,
      refundPending,
      refundFailed,
      pendingInquiries,
    ] = await Promise.all([
      prisma.school.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { role: true } }),
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.event.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { status: true } }),
      prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, role: true, createdAt: true, profileImageUrl: true, school: { select: { name: true } } },
      }),
      prisma.event.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, title: true, status: true, isPaid: true, createdAt: true,
          school: { select: { name: true } },
          host: { select: { name: true } },
          _count: { select: { registrations: true } },
        },
      }),
      prisma.registration.count({ where: { status: 'CANCELLATION_REQUESTED' } }),
      prisma.registration.count({ where: { status: 'REFUND_FAILED' } }),
      prisma.inquiry.count({ where: { status: 'PENDING' } }),
    ])

    const roles = Object.fromEntries(usersByRole.map(r => [r.role, r._count.role]))
    const statuses = Object.fromEntries(eventsByStatus.map(s => [s.status, s._count.status]))

    res.json({
      schools: totalSchools,
      users: { total: totalUsers, ...roles },
      events: { total: totalEvents, ...statuses },
      refundQueue: { pending: refundPending, failed: refundFailed },
      pendingInquiries,
      recentUsers,
      recentEvents,
    })
  } catch (err) { next(err) }
})

// GET /api/admin/users — 전체 유저 목록 (학교·역할·검색 필터)
router.get('/users', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { schoolId, role, search } = req.query
    const where = { deletedAt: null }
    if (schoolId) where.schoolId = schoolId
    if (role) where.role = role
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        emailVerified: true, studentId: true, roleMemo: true, createdAt: true,
        school: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    })
    res.json(users)
  } catch (err) { next(err) }
})

// GET /api/admin/schools/:schoolId/users — 학교 소속 유저 목록
router.get('/schools/:schoolId/users', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { schoolId } = req.params
    const { search } = req.query

    const school = await prisma.school.findFirst({ where: { id: schoolId, deletedAt: null } })
    if (!school) return res.status(404).json({ message: '학교를 찾을 수 없습니다.' })

    const users = await prisma.user.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        } : {})
      },
      select: {
        id: true, name: true, email: true, role: true,
        emailVerified: true, studentId: true, roleMemo: true, createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    })

    res.json({ school, users })
  } catch (err) { next(err) }
})

// GET /api/admin/users/:userId/registrations — 특정 유저의 전체 티켓 조회 (운영자)
router.get('/users/:userId/registrations', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const target = await prisma.user.findFirst({ where: { id: req.params.userId, deletedAt: null } })
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    const registrations = await prisma.registration.findMany({
      where: { userId: req.params.userId },
      include: {
        event: { select: { id: true, title: true, startAt: true, location: true, isPaid: true, school: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(registrations)
  } catch (err) { next(err) }
})

// PATCH /api/admin/users/:userId — 유저 정보 수정 (이메일·이메일인증·학번)
router.patch('/users/:userId', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { name, email, emailVerified, studentId } = req.body
    const target = await prisma.user.findFirst({ where: { id: req.params.userId, deletedAt: null } })
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    const data = {}
    const changes = []

    if (name !== undefined && name !== target.name) {
      data.name = name
      changes.push(`이름: ${target.name} → ${name}`)
    }
    if (email !== undefined && email !== target.email) {
      const exists = await prisma.user.findFirst({ where: { email, NOT: { id: target.id } } })
      if (exists) return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' })
      data.email = email
      changes.push(`이메일: ${target.email} → ${email}`)
    }
    if (emailVerified !== undefined && emailVerified !== target.emailVerified) {
      data.emailVerified = emailVerified
      changes.push(`이메일인증: ${target.emailVerified ? 'O' : 'X'} → ${emailVerified ? 'O' : 'X'}`)
    }
    if (studentId !== undefined && studentId !== target.studentId) {
      data.studentId = studentId || null
      changes.push(`학번: ${target.studentId ?? '-'} → ${studentId || '-'}`)
    }

    if (Object.keys(data).length === 0) return res.json({ message: '변경 사항이 없습니다.' })

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data,
      select: { id: true, name: true, email: true, role: true, emailVerified: true, studentId: true },
    })
    audit(req.user.id, 'EDIT_USER', 'USER', req.params.userId, `${target.name} · ${changes.join(', ')}`)
    res.json(updated)
  } catch (err) { next(err) }
})

// PUT /api/admin/users/:userId/role — 역할 변경 (운영자)
router.put('/users/:userId/role', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { role, memo, organizationType } = req.body
    const VALID_ROLES = ['ATTENDEE', 'CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR']

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: '유효하지 않은 역할입니다.' })
    }

    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, deletedAt: null }
    })
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        role,
        roleMemo: role === 'ATTENDEE' ? null : (memo?.trim() || null),
        organizationType: role === 'SCHOOL_ADMIN' ? (organizationType || null) : (role === 'ATTENDEE' ? null : undefined),
      },
      select: { id: true, name: true, email: true, role: true, roleMemo: true, organizationType: true }
    })
    const detail = memo?.trim()
      ? `${target.role} → ${role} (${target.name}) · ${memo.trim()}`
      : `${target.role} → ${role} (${target.name})`
    audit(req.user.id, 'CHANGE_ROLE', 'USER', req.params.userId, detail)
    res.json(updated)
  } catch (err) { next(err) }
})

// POST /api/admin/registrations/:id/cancel — 운영자 티켓 강제 취소
router.post('/registrations/:id/cancel', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { title: true, isPaid: true } }, user: { select: { name: true } } },
    })
    if (!registration) return res.status(404).json({ message: '티켓을 찾을 수 없습니다.' })
    if (registration.status !== 'CONFIRMED') {
      return res.status(400).json({ message: '신청 완료 상태인 티켓만 취소할 수 있습니다.' })
    }

    if (registration.event.isPaid && registration.paymentKey) {
      // 유료: 환불 큐에 등록
      const idempotencyKey = `${registration.id}-admin-cancel-${Date.now()}`
      await prisma.registration.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLATION_REQUESTED', cancelReason: '운영자 강제 취소', idempotencyKey },
      })
    } else {
      // 무료: 즉시 취소
      await prisma.registration.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED', cancelReason: '운영자 강제 취소' },
      })
    }

    audit(req.user.id, 'ADMIN_CANCEL', 'REGISTRATION', req.params.id,
      `${registration.user.name} · ${registration.event.title}`)
    res.json({ message: '취소되었습니다.' })
  } catch (err) { next(err) }
})

// GET /api/admin/cert-requests — 인증주최자 신청 전체 조회 (운영자)
router.get('/cert-requests', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { status, schoolId, search } = req.query
    const where = {}
    if (status) where.status = status
    if (schoolId) where.schoolId = schoolId
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { organization: { contains: search, mode: 'insensitive' } },
      ]
    }

    const requests = await prisma.certificationRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true } },
        school: { select: { id: true, name: true } },
        targetAdmin: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    res.json(requests)
  } catch (err) { next(err) }
})

// POST /api/admin/cert-requests/:id/approve — 운영자 직접 승인
router.post('/cert-requests/:id/approve', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { memo } = req.body
    if (!memo?.trim()) return res.status(400).json({ message: '승인 메모를 입력해주세요.' })

    const request = await prisma.certificationRequest.findFirst({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, role: true } } }
    })
    if (!request) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })
    if (request.status !== 'PENDING') return res.status(400).json({ message: '처리 중인 신청만 승인할 수 있습니다.' })

    const { createNotifications } = require('../services/notificationService')

    await prisma.$transaction([
      prisma.certificationRequest.update({
        where: { id: req.params.id },
        data: { status: 'APPROVED', reviewedById: req.user.id, reviewNote: memo.trim() }
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: {
          role: 'CERTIFIED',
          roleMemo: memo.trim(),
          organizationType: request.organizationType,
          roleExpiresAt: request.organizationType === 'STUDENT_COUNCIL' ? request.expiresAt : null,
        }
      })
    ])

    createNotifications({
      receiverIds: [request.userId],
      type: 'CERT_APPROVED',
      title: '인증주최자 신청이 승인되었습니다',
      content: memo.trim(),
      relatedTargetId: request.id,
    }).catch(e => console.error('[notify cert approve]', e.message))

    audit(req.user.id, 'CHANGE_ROLE', 'USER', request.userId,
      `ATTENDEE → CERTIFIED (${request.user.name}) · 운영자 직접 승인`)
    res.json({ message: '승인되었습니다.' })
  } catch (err) { next(err) }
})

// POST /api/admin/cert-requests/:id/reject — 운영자 직접 거절
router.post('/cert-requests/:id/reject', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ message: '거절 사유를 입력해주세요.' })

    const request = await prisma.certificationRequest.findFirst({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true } } }
    })
    if (!request) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })
    if (request.status !== 'PENDING') return res.status(400).json({ message: '처리 중인 신청만 거절할 수 있습니다.' })

    const { createNotifications } = require('../services/notificationService')

    await prisma.certificationRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED', reviewedById: req.user.id, reviewNote: reason.trim() }
    })

    createNotifications({
      receiverIds: [request.userId],
      type: 'CERT_REJECTED',
      title: '인증주최자 신청이 거절되었습니다',
      content: reason.trim().slice(0, 100),
      relatedTargetId: request.id,
    }).catch(e => console.error('[notify cert reject]', e.message))

    audit(req.user.id, 'REJECT_CERT', 'USER', request.userId,
      `${request.user.name} 인증 신청 거절 · ${reason.trim()}`)
    res.json({ message: '거절되었습니다.' })
  } catch (err) { next(err) }
})

// GET /api/admin/audit-logs — 감사 로그 조회 (운영자)
router.get('/audit-logs', authMiddleware, OPERATOR, async (req, res, next) => {
  try {
    const { action, targetType, adminId, limit = 100 } = req.query
    const take = Math.min(Number(limit) || 100, 500)
    const where = {}
    if (action) where.action = action
    if (targetType) where.targetType = targetType
    if (adminId) where.adminId = adminId

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        admin: { select: { id: true, name: true, email: true, role: true } },
      },
    })
    res.json(logs)
  } catch (err) { next(err) }
})

module.exports = router
