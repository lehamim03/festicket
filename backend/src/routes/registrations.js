const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const audit = require('../utils/audit')
const { sendRegistrationConfirmEmail } = require('../services/mailer')

const router = express.Router()
const prisma = new PrismaClient()

const ACTIVE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'REFUND_FAILED', 'CHECKED_IN']

// POST / — 무료 행사 신청 (UC-08)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.body
    if (!eventId) return res.status(400).json({ message: 'eventId가 필요합니다.' })

    const userId = req.user.id

    const [event, user] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, schoolId: true, studentId: true } }),
    ])

    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    if (event.status !== 'PUBLISHED') return res.status(400).json({ message: '신청 가능한 행사가 아닙니다.' })
    const now = new Date()
    // 2차 신청마감(releaseDeadline) 이후 모든 신청 차단. 없으면 startAt-30min 폴백
    const releaseDeadline = event.releaseDeadline
      ?? new Date(event.startAt.getTime() - 30 * 60_000)
    if (now > releaseDeadline) {
      return res.status(400).json({ message: '신청이 마감되었습니다.' })
    }
    if (now > event.startAt) {
      return res.status(400).json({ message: '행사가 이미 시작되었습니다.' })
    }
    // BR-02: 본인 학교 행사만 신청 가능
    if (user.schoolId !== event.schoolId) {
      return res.status(403).json({ message: '본인 학교 행사만 신청할 수 있습니다.' })
    }

    // BR-W03: 유료 행사 — 화이트리스트에 등록된 학번이면 무료 신청 허용
    if (event.isPaid) {
      const isOnWhitelist = user.studentId
        ? await prisma.eventWhitelist.findFirst({
            where: {
              eventId,
              entries: { some: { studentId: user.studentId } },
            },
          })
        : null
      if (!isOnWhitelist) {
        return res.status(400).json({ message: '유료 행사는 결제 도메인을 통해 신청해야 합니다.' })
      }
    }

    // BR-08: 활성 신청 1건 제한
    const activeReg = await prisma.registration.findFirst({
      where: { eventId, userId, status: { in: ACTIVE_STATUSES } },
    })
    if (activeReg) return res.status(409).json({ message: '이미 신청한 행사입니다.' })



    // BR-40: 정원 점검 + INSERT (트랜잭션)
    try {
      const registration = await prisma.$transaction(async (tx) => {
        const activeCount = await tx.registration.count({
          where: { eventId, status: { in: ACTIVE_STATUSES } },
        })

        // BR-17 Option A: 취소표 릴리즈 기능이 설정된 경우, lastReleaseAt 이후
        // 발생한 CANCELLED/EXPIRED 자리는 다음 릴리즈까지 사용 불가로 처리
        let lockedCount = 0
        if (event.releaseIntervalMinutes) {
          const since = event.lastReleaseAt ?? new Date(0)
          lockedCount = await tx.registration.count({
            where: {
              eventId,
              status: { in: ['CANCELLED', 'EXPIRED'] },
              updatedAt: { gt: since },
            },
          })
        }

        if (activeCount + lockedCount >= event.capacity) {
          const err = new Error('CAPACITY_EXCEEDED')
          err.statusCode = 409
          throw err
        }
        return tx.registration.create({
          data: { eventId, userId, status: 'CONFIRMED' },
        })
      })

      audit(userId, 'REGISTER', 'REGISTRATION', registration.id, event.title)
      sendRegistrationConfirmEmail({
        to: user.email, name: user.name, event, registrationId: registration.id,
      }).catch(e => console.error('[mail]', e.message))
      res.status(201).json({
        registrationId: registration.id,
        status: registration.status,
        // BR-30~32: 신청 완료 안내
        notice: {
          channels: '장소 또는 시간이 변경될 경우, 카카오톡 알림 또는 푸시 알림으로 발송됩니다.',
          refundInfo: '이 행사는 무료이므로 환불 대상이 아닙니다.',
        },
      })
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({ message: '정원이 마감되었습니다.' })
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
})

// POST /:id/cancel-free — 무료 신청 취소 (UC-11)
router.post('/:id/cancel-free', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { event: true },
    })
    if (!registration) return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    if (registration.userId !== userId) return res.status(403).json({ message: '권한이 없습니다.' })
    if (registration.event.isPaid) {
      return res.status(400).json({ message: '유료 행사는 결제 도메인을 통해 취소해야 합니다.' })
    }
    if (registration.status !== 'CONFIRMED') {
      return res.status(400).json({ message: '취소할 수 없는 상태입니다.' })
    }
    if (new Date() > registration.event.endAt) {
      return res.status(400).json({ message: '종료된 행사는 취소할 수 없습니다.' })
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    audit(userId, 'CANCEL_FREE', 'REGISTRATION', id, registration.event.title)
    res.json({ registrationId: updated.id, status: updated.status })
  } catch (err) {
    next(err)
  }
})

// GET /me — 내 신청 조회 (UC-13)
// ?archived=true → CANCELLED/EXPIRED/CHECKED_IN/REFUND_FAILED
// 기본(false) → PENDING_PAYMENT/CONFIRMED 활성만
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id
    const archived = req.query.archived === 'true'

    const statusFilter = archived
      ? ['CANCELLED', 'EXPIRED', 'CHECKED_IN', 'REFUND_FAILED']
      : ['PENDING_PAYMENT', 'CONFIRMED']

    const registrations = await prisma.registration.findMany({
      where: { userId, status: { in: statusFilter } },
      include: {
        event: {
          select: {
            id: true, title: true, location: true, startAt: true, endAt: true,
            isPaid: true, price: true, refundContact: true, refundDeadlineAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(registrations)
  } catch (err) {
    next(err)
  }
})

module.exports = router
