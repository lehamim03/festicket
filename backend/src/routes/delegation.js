const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const audit = require('../utils/audit')
const { createNotifications } = require('../services/notificationService')

const router = express.Router()
const prisma = new PrismaClient()

const CERTIFIED = requireRole('CERTIFIED')

// GET /api/delegations/search?q= — 같은 학교 ATTENDEE 검색
router.get('/search', authMiddleware, CERTIFIED, async (req, res, next) => {
  try {
    const { q } = req.query
    if (!q || q.trim().length < 1) return res.json([])

    const users = await prisma.user.findMany({
      where: {
        schoolId: req.user.schoolId,
        role: 'ATTENDEE',
        deletedAt: null,
        id: { not: req.user.id },
        OR: [
          { name: { contains: q.trim(), mode: 'insensitive' } },
          { studentId: { contains: q.trim() } },
        ]
      },
      select: { id: true, name: true, email: true, studentId: true },
      take: 10,
    })
    res.json(users)
  } catch (err) { next(err) }
})

// GET /api/delegations/events-preview — 위임 시 이전될 행사 수 미리보기
router.get('/events-preview', authMiddleware, CERTIFIED, async (req, res, next) => {
  try {
    const now = new Date()
    const [draft, ended] = await Promise.all([
      prisma.event.count({ where: { hostId: req.user.id, status: 'DRAFT', deletedAt: null } }),
      prisma.event.count({ where: { hostId: req.user.id, status: 'PUBLISHED', deletedAt: null, endAt: { lte: now } } }),
    ])
    res.json({ draft, ended, total: draft + ended })
  } catch (err) { next(err) }
})

// POST /api/delegations — 즉시 위임 (행사 인수인계 포함)
router.post('/', authMiddleware, CERTIFIED, async (req, res, next) => {
  try {
    const { toUserId } = req.body
    if (!toUserId) return res.status(400).json({ message: '위임 대상을 선택해주세요.' })

    const fromUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, schoolId: true, organizationType: true }
    })

    const toUser = await prisma.user.findFirst({
      where: { id: toUserId, deletedAt: null }
    })
    if (!toUser) return res.status(404).json({ message: '대상 사용자를 찾을 수 없습니다.' })
    if (toUser.schoolId !== fromUser.schoolId) {
      return res.status(400).json({ message: '같은 학교 사용자에게만 위임할 수 있습니다.' })
    }
    if (toUser.role !== 'ATTENDEE') {
      return res.status(400).json({ message: '일반 사용자에게만 위임할 수 있습니다.' })
    }

    const now = new Date()
    // 진행 중 = PUBLISHED 이면서 아직 종료되지 않은 행사
    const publishedCount = await prisma.event.count({
      where: {
        hostId: req.user.id, status: 'PUBLISHED', deletedAt: null,
        OR: [{ endAt: null }, { endAt: { gt: now } }],
      },
    })
    if (publishedCount > 0) {
      return res.status(400).json({ message: `진행 중인 행사 ${publishedCount}건이 있어 위임할 수 없습니다.` })
    }

    // 이전 대상: DRAFT + 종료된 PUBLISHED
    const transferTotal = await prisma.event.count({
      where: {
        hostId: req.user.id, deletedAt: null,
        OR: [
          { status: 'DRAFT' },
          { status: 'PUBLISHED', endAt: { lte: now } },
        ],
      },
    })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'ATTENDEE', roleMemo: null }
      }),
      prisma.user.update({
        where: { id: toUserId },
        data: { role: 'CERTIFIED', roleMemo: `${fromUser.name}으로부터 위임`, organizationType: fromUser.organizationType }
      }),
      prisma.delegationRequest.create({
        data: { fromUserId: req.user.id, toUserId, schoolId: fromUser.schoolId }
      }),
      // 행사 인수인계: 초안 + 종료된 행사 후임자에게 이전
      prisma.event.updateMany({
        where: {
          hostId: req.user.id, deletedAt: null,
          OR: [
            { status: 'DRAFT' },
            { status: 'PUBLISHED', endAt: { lte: now } },
          ],
        },
        data: { hostId: toUserId },
      }),
    ])

    // 학교총관리자에게 알림
    const schoolAdmins = await prisma.user.findMany({
      where: { schoolId: fromUser.schoolId, role: 'SCHOOL_ADMIN', deletedAt: null },
      select: { id: true }
    })
    const notifyTargets = [toUserId, ...schoolAdmins.map(a => a.id)]
    const eventSuffix = transferTotal > 0 ? ` (행사 ${transferTotal}건 인수인계 포함)` : ''
    createNotifications({
      receiverIds: notifyTargets,
      type: 'DELEGATION_DONE',
      title: '권한 위임이 완료되었습니다',
      content: `${fromUser.name}님이 ${toUser.name}님에게 인증주최자 권한을 위임했습니다.${eventSuffix}`,
      relatedTargetId: toUserId,
    }).catch(e => console.error('[notify delegation]', e.message))

    audit(req.user.id, 'DELEGATION', 'USER', toUserId,
      `${fromUser.name} → ${toUser.name} 권한 위임${eventSuffix}`)

    res.json({
      message: `${toUser.name}님에게 권한이 위임되었습니다.${eventSuffix}`,
      transferredEvents: { total: transferTotal },
    })
  } catch (err) { next(err) }
})

module.exports = router
