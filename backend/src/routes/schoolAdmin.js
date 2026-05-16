const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const audit = require('../utils/audit')
const { createNotifications } = require('../services/notificationService')

const router = express.Router()
const prisma = new PrismaClient()

const SCHOOL_ADMIN = requireRole('SCHOOL_ADMIN')
const ALLOWED_ROLES = ['ATTENDEE', 'CERTIFIED']

// GET /api/school-admin/users — 내 학교 유저 목록
router.get('/users', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    const { search } = req.query

    const [school, users] = await Promise.all([
      prisma.school.findFirst({ where: { id: schoolId, deletedAt: null }, select: { id: true, name: true, domain: true, address: true, adminContact: true } }),
      prisma.user.findMany({
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
    ])

    if (!school) return res.status(404).json({ message: '학교를 찾을 수 없습니다.' })

    res.json({ school, users })
  } catch (err) { next(err) }
})

// GET /api/school-admin/users/:userId/registrations — 특정 유저의 티켓 조회 (학교 행사만)
router.get('/users/:userId/registrations', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    const target = await prisma.user.findFirst({ where: { id: req.params.userId, deletedAt: null } })
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    const registrations = await prisma.registration.findMany({
      where: { userId: req.params.userId, event: { schoolId } },
      include: {
        event: { select: { id: true, title: true, startAt: true, location: true, isPaid: true, school: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(registrations)
  } catch (err) { next(err) }
})

// PUT /api/school-admin/users/:userId/role — 역할 변경 (ATTENDEE/CERTIFIED 범위)
router.put('/users/:userId/role', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    const { role, memo } = req.body
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: '학교 관리자는 일반/인증주최자 역할만 변경할 수 있습니다.' })
    }

    const target = await prisma.user.findFirst({
      where: { id: req.params.userId, deletedAt: null }
    })
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    if (target.schoolId !== schoolId) return res.status(403).json({ message: '다른 학교의 사용자입니다.' })
    if (!ALLOWED_ROLES.includes(target.role)) {
      return res.status(403).json({ message: '해당 사용자의 역할은 변경할 수 없습니다.' })
    }

    // BR-A03: CERTIFIED → ATTENDEE 강등 시 진행 중 행사 0건 확인
    if (target.role === 'CERTIFIED' && role === 'ATTENDEE') {
      const activeEventCount = await prisma.event.count({
        where: { hostId: target.id, status: 'PUBLISHED', deletedAt: null },
      })
      if (activeEventCount > 0) {
        return res.status(400).json({
          message: `진행 중인 행사 ${activeEventCount}건이 있어 권한 해제가 불가합니다. 행사를 먼저 종료하거나 삭제해주세요.`,
        })
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data: { role, roleMemo: role === 'ATTENDEE' ? null : (memo?.trim() || null) },
      select: { id: true, name: true, email: true, role: true, roleMemo: true }
    })
    const detail = memo?.trim()
      ? `${target.role} → ${role} (${target.name}) · ${memo.trim()}`
      : `${target.role} → ${role} (${target.name})`
    audit(req.user.id, 'CHANGE_ROLE', 'USER', req.params.userId, detail)
    res.json(updated)
  } catch (err) { next(err) }
})

// PUT /api/school-admin/contact — 학교 연락처 설정
router.put('/contact', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    const { adminContact } = req.body
    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: { adminContact: adminContact?.trim() || null },
      select: { id: true, adminContact: true }
    })
    audit(req.user.id, 'UPDATE_SCHOOL_CONTACT', 'SCHOOL', schoolId,
      adminContact?.trim() ? `연락처 설정: ${adminContact.trim()}` : '연락처 삭제')
    res.json(updated)
  } catch (err) { next(err) }
})

// GET /api/school-admin/cert-requests — 인증 신청 목록 (PENDING)
router.get('/cert-requests', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    const requests = await prisma.certificationRequest.findMany({
      where: { schoolId, status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true, createdAt: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    res.json(requests)
  } catch (err) { next(err) }
})

// POST /api/school-admin/cert-requests/:id/approve — 승인
router.post('/cert-requests/:id/approve', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    const { memo } = req.body
    if (!memo?.trim()) return res.status(400).json({ message: '승인 메모를 입력해주세요.' })

    const request = await prisma.certificationRequest.findFirst({
      where: { id: req.params.id, schoolId },
      include: { user: { select: { id: true, name: true, role: true } } }
    })
    if (!request) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })
    if (request.status !== 'PENDING') return res.status(400).json({ message: '처리 중인 신청만 승인할 수 있습니다.' })
    if (request.user.role !== 'ATTENDEE') return res.status(400).json({ message: '일반 사용자만 승인할 수 있습니다.' })

    await prisma.$transaction([
      prisma.certificationRequest.update({
        where: { id: req.params.id },
        data: { status: 'APPROVED', reviewedById: req.user.id, reviewNote: memo?.trim() || null }
      }),
      prisma.user.update({
        where: { id: request.userId },
        data: {
          role: 'CERTIFIED',
          roleMemo: memo?.trim() || null,
          organizationType: request.organizationType,
          roleExpiresAt: request.organizationType === 'STUDENT_COUNCIL' ? request.expiresAt : null,
        }
      })
    ])

    createNotifications({
      receiverIds: [request.userId],
      type: 'CERT_APPROVED',
      title: '인증주최자 신청이 승인되었습니다',
      content: memo?.trim() || '인증주최자로 승인되었습니다. 이제 행사를 만들 수 있습니다.',
      relatedTargetId: request.id,
    }).catch(e => console.error('[notify cert approve]', e.message))

    audit(req.user.id, 'CHANGE_ROLE', 'USER', request.userId,
      `ATTENDEE → CERTIFIED (${request.user.name}) · 인증 신청 승인`)
    res.json({ message: '승인되었습니다.' })
  } catch (err) { next(err) }
})

// POST /api/school-admin/cert-requests/:id/reject — 거절
router.post('/cert-requests/:id/reject', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ message: '거절 사유를 입력해주세요.' })

    const request = await prisma.certificationRequest.findFirst({
      where: { id: req.params.id, schoolId },
      include: { user: { select: { id: true, name: true } } }
    })
    if (!request) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })
    if (request.status !== 'PENDING') return res.status(400).json({ message: '처리 중인 신청만 거절할 수 있습니다.' })

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

// GET /api/school-admin/audit-logs — 자교 감사 로그 조회
router.get('/audit-logs', authMiddleware, SCHOOL_ADMIN, async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId
    if (!schoolId) return res.status(403).json({ message: '소속 학교가 없습니다.' })

    // 자교 소속 유저들의 adminId로 필터
    const schoolUserIds = await prisma.user.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true }
    }).then(users => users.map(u => u.id))

    const logs = await prisma.auditLog.findMany({
      where: { adminId: { in: schoolUserIds } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        admin: { select: { id: true, name: true, email: true, role: true } }
      }
    })
    res.json(logs)
  } catch (err) { next(err) }
})

module.exports = router
