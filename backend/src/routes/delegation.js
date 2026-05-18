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

// POST /api/delegations — 즉시 위임
router.post('/', authMiddleware, CERTIFIED, async (req, res, next) => {
  try {
    const { toUserId } = req.body
    if (!toUserId) return res.status(400).json({ message: '위임 대상을 선택해주세요.' })

    const fromUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, schoolId: true }
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

    const activeEvents = await prisma.event.count({
      where: { hostId: req.user.id, status: 'PUBLISHED', deletedAt: null }
    })
    if (activeEvents > 0) {
      return res.status(400).json({ message: `진행 중인 행사 ${activeEvents}건이 있어 위임할 수 없습니다.` })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'ATTENDEE', roleMemo: null }
      }),
      prisma.user.update({
        where: { id: toUserId },
        data: { role: 'CERTIFIED', roleMemo: `${fromUser.name}으로부터 위임` }
      }),
      prisma.delegationRequest.create({
        data: { fromUserId: req.user.id, toUserId, schoolId: fromUser.schoolId }
      }),
    ])

    // 학교총관리자에게 알림
    const schoolAdmins = await prisma.user.findMany({
      where: { schoolId: fromUser.schoolId, role: 'SCHOOL_ADMIN', deletedAt: null },
      select: { id: true }
    })
    const notifyTargets = [toUserId, ...schoolAdmins.map(a => a.id)]
    createNotifications({
      receiverIds: notifyTargets,
      type: 'DELEGATION_DONE',
      title: '권한 위임이 완료되었습니다',
      content: `${fromUser.name}님이 ${toUser.name}님에게 인증주최자 권한을 위임했습니다.`,
      relatedTargetId: toUserId,
    }).catch(e => console.error('[notify delegation]', e.message))

    audit(req.user.id, 'DELEGATION', 'USER', toUserId,
      `${fromUser.name} → ${toUser.name} 권한 위임`)

    res.json({ message: `${toUser.name}님에게 권한이 위임되었습니다.` })
  } catch (err) { next(err) }
})

module.exports = router
