const express = require('express')
const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const authMiddleware = require('../middleware/auth')
const { requireRole } = authMiddleware
const { confirmPayment, cancelPayment } = require('../services/toss')
const audit = require('../utils/audit')
const { sendRegistrationConfirmEmail } = require('../services/mailer')

const prisma = new PrismaClient()

// ─── Payment Router (/api/v1/payments) ───────────────────────────────────────

const paymentRouter = express.Router()

// POST /prepare — 결제 준비, orderId 발급 + PENDING_PAYMENT 생성 (UC-P01)
paymentRouter.post('/prepare', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.body
    const userId = req.user.id

    const [event, user] = await Promise.all([
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ])

    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })
    if (event.status !== 'PUBLISHED') return res.status(400).json({ message: '신청 가능한 행사가 아닙니다.' })
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return res.status(400).json({ message: '신청 마감된 행사입니다.' })
    }
    if (!event.isPaid) return res.status(400).json({ message: '무료 행사는 이 엔드포인트를 사용할 수 없습니다.' })

    // BR-W03: 화이트리스트 학번이면 무료 신청 처리
    if (user.studentId) {
      const isOnWhitelist = await prisma.eventWhitelist.findFirst({
        where: { eventId, entries: { some: { studentId: user.studentId } } },
      })
      if (isOnWhitelist) {
        return res.status(400).json({ message: '학생회비 납부자로 등록되어 있습니다. 무료로 신청해주세요.', isWhitelisted: true })
      }
    }

    // BR-02: 동일 학교 사용자만 신청 가능
    if (user.schoolId !== event.schoolId) {
      return res.status(403).json({ message: '본인 학교 행사만 신청할 수 있습니다.' })
    }

    // BR-08: 활성 신청 없음 확인
    const activeReg = await prisma.registration.findFirst({
      where: {
        eventId,
        userId,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'REFUND_FAILED', 'CHECKED_IN'] },
      },
    })
    if (activeReg) return res.status(409).json({ message: '이미 신청한 행사입니다.' })

    // 정원 확인 + PENDING_PAYMENT 생성 (트랜잭션, BR-33)
    const registration = await prisma.$transaction(async (tx) => {
      const activeCount = await tx.registration.count({
        where: {
          eventId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLATION_REQUESTED', 'REFUND_FAILED', 'CHECKED_IN'] },
        },
      })
      if (activeCount >= event.capacity) {
        const err = new Error('CAPACITY_EXCEEDED')
        err.statusCode = 409
        throw err
      }
      const orderId = crypto.randomUUID()
      return tx.registration.create({
        data: { eventId, userId, status: 'PENDING_PAYMENT', orderId },
      })
    })

    res.json({
      orderId: registration.orderId,
      amount: event.price,
      eventTitle: event.title,
      registrationId: registration.id,
    })
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ message: '정원이 마감되었습니다.' })
    next(err)
  }
})

// POST /confirm — 토스 결제 승인 처리 (UC-P01, step 6-8)
paymentRouter.post('/confirm', authMiddleware, async (req, res, next) => {
  try {
    const { paymentKey, orderId, amount } = req.body
    const userId = req.user.id

    const registration = await prisma.registration.findUnique({
      where: { orderId },
      include: {
        event: true,
        user: { select: { name: true, email: true } },
      },
    })

    if (!registration) return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    if (registration.userId !== userId) return res.status(403).json({ message: '권한이 없습니다.' })
    if (registration.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ message: '결제 대기 상태가 아닙니다.' })
    }
    if (registration.event.price !== amount) {
      return res.status(400).json({ message: '결제 금액이 일치하지 않습니다.' })
    }

    await confirmPayment({ paymentKey, orderId, amount })

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'CONFIRMED', paymentKey, paidAmount: amount, paidAt: new Date() },
    })

    audit(userId, 'PAYMENT_CONFIRM', 'REGISTRATION', updated.id, `${registration.event.title} · ${amount.toLocaleString()}원`)
    sendRegistrationConfirmEmail({
      to: registration.user.email, name: registration.user.name,
      event: registration.event, registrationId: updated.id,
    }).catch(e => console.error('[mail]', e.message))
    res.json({ message: '결제가 완료되었습니다.', registrationId: updated.id })
  } catch (err) {
    const tossCode = err.response?.data?.code
    if (tossCode) return res.status(400).json({ message: '결제 승인 실패', code: tossCode })
    next(err)
  }
})

// POST /cancel-pending — 결제 진행 중 취소 (UC-P02, failUrl 처리)
paymentRouter.post('/cancel-pending', authMiddleware, async (req, res, next) => {
  try {
    const { orderId } = req.body
    const userId = req.user.id

    const registration = await prisma.registration.findUnique({ where: { orderId } })
    if (!registration) return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    if (registration.userId !== userId) return res.status(403).json({ message: '권한이 없습니다.' })
    if (registration.status !== 'PENDING_PAYMENT') {
      return res.status(400).json({ message: '결제 대기 상태가 아닙니다.' })
    }

    // 토스에서 실제 결제가 일어나지 않은 상태이므로 환불 처리 불필요
    await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'EXPIRED' },
    })

    res.json({ message: '결제가 취소되었습니다.' })
  } catch (err) {
    next(err)
  }
})

// GET /history — 내 결제/환불 이력 조회 (UC-P07)
paymentRouter.get('/history', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id

    const registrations = await prisma.registration.findMany({
      where: {
        userId,
        status: { notIn: ['PENDING_PAYMENT', 'EXPIRED'] },
        event: { isPaid: true },
      },
      include: {
        event: { select: { title: true, startAt: true, endAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(
      registrations.map((r) => ({
        id: r.id,
        eventTitle: r.event.title,
        eventStartAt: r.event.startAt,
        status: r.status,
        paidAmount: r.paidAmount,
        paidAt: r.paidAt,
        refundedAmount: r.refundedAmount,
        refundedAt: r.refundedAt,
        createdAt: r.createdAt,
      }))
    )
  } catch (err) {
    next(err)
  }
})

// ─── Registration Router (/api/v1/registrations) ─────────────────────────────

const registrationRouter = express.Router()

// POST /:id/cancel — 신청 취소 및 환불 (UC-P03, 2-Phase)
registrationRouter.post('/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { event: true },
    })

    if (!registration) return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    if (registration.userId !== userId) return res.status(403).json({ message: '권한이 없습니다.' })
    if (registration.status !== 'CONFIRMED') {
      return res.status(400).json({ message: '취소할 수 없는 상태입니다.' })
    }
    if (new Date() > registration.event.endAt) {
      const contact = [registration.event.contactEmail, registration.event.contactPhone]
        .filter(Boolean)
        .join(' / ')
      return res.status(400).json({ message: `행사가 종료되었습니다. 행사 문의: ${contact}` })
    }
    // 화이트리스트 무료 신청: paymentKey 없음 → 토스 호출 없이 바로 취소
    if (!registration.paymentKey) {
      await prisma.registration.update({
        where: { id },
        data: { status: 'CANCELLED', refundedAt: new Date() },
      })
      audit(userId, 'CANCEL_FREE_WHITELIST', 'REGISTRATION', id, registration.event.title)
      return res.json({ message: '신청이 취소되었습니다.' })
    }

    // BR-P01: 환불 마감 시각 체크 (일반사용자는 마감 이후 환불 불가)
    if (registration.event.refundDeadlineAt && new Date() > registration.event.refundDeadlineAt) {
      const contact = [registration.event.contactEmail, registration.event.contactPhone]
        .filter(Boolean)
        .join(' / ')
      return res.status(400).json({
        message: `환불 마감 시각이 지났습니다. 행사 이메일/번호로 문의하세요. ${contact}`,
      })
    }

    const idempotencyKey = `${registration.id}-cancel-${Date.now()}`

    // Phase 1: CANCELLATION_REQUESTED + 멱등키 저장 (BR-14: 자리 유지)
    await prisma.registration.update({
      where: { id },
      data: { status: 'CANCELLATION_REQUESTED', idempotencyKey },
    })

    // Phase 2: 토스 결제 취소 API 호출
    try {
      await cancelPayment({
        paymentKey: registration.paymentKey,
        cancelReason: '사용자 신청 취소',
        idempotencyKey,
      })

      await prisma.registration.update({
        where: { id },
        data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
      })

      audit(userId, 'CANCEL_PAID', 'REGISTRATION', id, registration.event.title)
      res.json({ message: '환불이 완료되었습니다.' })
    } catch (tossErr) {
      const tossCode = tossErr.response?.data?.code

      if (tossCode === 'ALREADY_CANCELED') {
        await prisma.registration.update({
          where: { id },
          data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
        })
        audit(userId, 'CANCEL_PAID', 'REGISTRATION', id, registration.event.title)
        return res.json({ message: '환불이 완료되었습니다.' })
      }

      // 일시적 실패 → CANCELLATION_REQUESTED 유지, 환불 큐에서 재시도
      await prisma.registration.update({
        where: { id },
        data: { retryCount: 0, nextRetryAt: new Date(Date.now() + 60000) },
      })
      res.json({ message: '환불 요청이 접수되었습니다. 처리 중입니다.' })
    }
  } catch (err) {
    next(err)
  }
})

// ─── Admin Refund Router (/api/v1/admin) ─────────────────────────────────────

const adminRefundRouter = express.Router()

// GET /refund-queue — 환불 큐 현황 조회 (운영자)
adminRefundRouter.get('/refund-queue', authMiddleware, requireRole('OPERATOR'), async (req, res, next) => {
  try {
    const queue = await prisma.registration.findMany({
      where: { status: { in: ['CANCELLATION_REQUESTED', 'REFUND_FAILED'] } },
      include: {
        event: { select: { id: true, title: true, deletedAt: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(queue)
  } catch (err) {
    next(err)
  }
})

// POST /refund-queue/:id/retry — 환불 큐 수동 재시도 (운영자)
adminRefundRouter.post('/refund-queue/:id/retry', authMiddleware, requireRole('OPERATOR'), async (req, res, next) => {
  try {
    const { id } = req.params

    const registration = await prisma.registration.findUnique({ where: { id } })
    if (!registration) return res.status(404).json({ message: '신청 정보를 찾을 수 없습니다.' })
    if (!['CANCELLATION_REQUESTED', 'REFUND_FAILED'].includes(registration.status)) {
      return res.status(400).json({ message: '재시도 가능한 상태가 아닙니다.' })
    }

    const idempotencyKey = `${registration.id}-cancel-${Date.now()}`
    await prisma.registration.update({
      where: { id },
      data: { status: 'CANCELLATION_REQUESTED', idempotencyKey, nextRetryAt: null },
    })

    try {
      await cancelPayment({
        paymentKey: registration.paymentKey,
        cancelReason: registration.cancelReason || '운영자 수동 환불',
        idempotencyKey,
      })

      await prisma.registration.update({
        where: { id },
        data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
      })

      audit(req.user.id, 'REFUND_RETRY', 'REGISTRATION', id, `운영자 수동 환불 완료`)
      res.json({ message: '환불이 완료되었습니다.' })
    } catch (tossErr) {
      const tossCode = tossErr.response?.data?.code

      if (tossCode === 'ALREADY_CANCELED') {
        await prisma.registration.update({
          where: { id },
          data: { status: 'CANCELLED', refundedAmount: registration.paidAmount, refundedAt: new Date() },
        })
        audit(req.user.id, 'REFUND_RETRY', 'REGISTRATION', id, `운영자 수동 환불 완료 (이미 취소됨)`)
        return res.json({ message: '환불이 완료되었습니다.' })
      }

      await prisma.registration.update({
        where: { id },
        data: { status: 'REFUND_FAILED', retryCount: { increment: 1 } },
      })
      return res.status(502).json({ message: '환불 재시도 실패', code: tossCode })
    }
  } catch (err) {
    next(err)
  }
})

module.exports = { paymentRouter, registrationRouter, adminRefundRouter }
