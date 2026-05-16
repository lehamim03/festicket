const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const audit = require('../utils/audit')

const router = express.Router()
const prisma = new PrismaClient()

// POST /api/v1/checkin — QR 체크인 (호스트만)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { qrCode } = req.body
    if (!qrCode) return res.status(400).json({ ok: false, reason: '유효하지 않은 QR' })

    const registration = await prisma.registration.findUnique({
      where: { id: qrCode },
      include: {
        user: { select: { name: true, email: true } },
        event: { select: { id: true, hostId: true, title: true } },
      },
    })

    if (!registration) return res.json({ ok: false, reason: '유효하지 않은 QR' })

    // SCHOOL_ADMIN / OPERATOR도 허용, 그 외는 호스트만
    const isHost = registration.event.hostId === req.user.id
    const isAdmin = req.user.role === 'OPERATOR' || req.user.role === 'SCHOOL_ADMIN'
    if (!isHost && !isAdmin) {
      return res.status(403).json({ ok: false, reason: '권한이 없습니다.' })
    }

    // 행사 일치 여부 먼저 확인
    if (registration.event.id !== req.body.eventId && req.body.eventId) {
      return res.json({ ok: false, reason: '이 행사의 티켓이 아닙니다.' })
    }

    if (registration.status === 'CHECKED_IN') return res.json({ ok: false, reason: '이미 체크인됨' })
    if (registration.status === 'CANCELLED') return res.json({ ok: false, reason: '취소된 티켓입니다.' })
    if (registration.status !== 'CONFIRMED') return res.json({ ok: false, reason: '유효하지 않은 티켓' })

    // 트랜잭션으로 중복 체크인 원자적 방지
    let alreadyDone = false
    await prisma.$transaction(async (tx) => {
      const current = await tx.registration.findUnique({
        where: { id: registration.id },
        select: { status: true },
      })
      if (current.status === 'CHECKED_IN') { alreadyDone = true; return }
      await tx.registration.update({
        where: { id: registration.id },
        data: { status: 'CHECKED_IN', checkedInAt: new Date() },
      })
    })

    if (alreadyDone) return res.json({ ok: false, reason: '이미 체크인됨' })
    audit(req.user.id, 'CHECKIN', 'REGISTRATION', registration.id, `${registration.user.name} · ${registration.event.title}`)
    res.json({ ok: true, user: registration.user })
  } catch (err) { next(err) }
})

// GET /api/v1/checkin/:eventId/stats — 체크인 현황 (호스트/관리자만)
router.get('/:eventId/stats', authMiddleware, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } })
    if (!event) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    const isHost = event.hostId === req.user.id
    const isAdmin = req.user.role === 'OPERATOR' || req.user.role === 'SCHOOL_ADMIN'
    if (!isHost && !isAdmin) return res.status(403).json({ message: '권한이 없습니다.' })

    const [total, checkedIn] = await Promise.all([
      prisma.registration.count({
        where: { eventId: req.params.eventId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      }),
      prisma.registration.count({
        where: { eventId: req.params.eventId, status: 'CHECKED_IN' },
      }),
    ])

    res.json({ total, checkedIn, remaining: total - checkedIn })
  } catch (err) { next(err) }
})

module.exports = router
