const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const { createNotifications } = require('../services/notificationService')

const router = express.Router()
const prisma = new PrismaClient()

// POST /api/cert-requests — 인증주최자 신청
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { message, organization, contact, organizationType, expiresAt } = req.body
    if (!organization?.trim()) return res.status(400).json({ message: '소속 단체/직책을 입력해주세요.' })
    if (!contact?.trim()) return res.status(400).json({ message: '연락처를 입력해주세요.' })
    if (!['STUDENT_COUNCIL', 'CLUB'].includes(organizationType)) {
      return res.status(400).json({ message: '구분을 선택해주세요.' })
    }
    if (organizationType === 'STUDENT_COUNCIL') {
      if (!expiresAt) return res.status(400).json({ message: '학생회는 임기 만료일을 입력해주세요.' })
      const expiresDate = new Date(expiresAt)
      if (isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
        return res.status(400).json({ message: '만료일은 오늘 이후 날짜여야 합니다.' })
      }
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, role: true, schoolId: true }
    })

    if (user.role !== 'ATTENDEE') {
      return res.status(400).json({ message: '일반 사용자만 신청할 수 있습니다.' })
    }
    if (!user.schoolId) {
      return res.status(400).json({ message: '소속 학교가 없으면 신청할 수 없습니다.' })
    }

    const existing = await prisma.certificationRequest.findFirst({
      where: { userId: req.user.id, status: 'PENDING' }
    })
    if (existing) {
      return res.status(409).json({ message: '이미 처리 중인 신청이 있습니다.' })
    }

    const schoolAdmin = await prisma.user.findFirst({
      where: { schoolId: user.schoolId, role: 'SCHOOL_ADMIN', deletedAt: null }
    })
    if (!schoolAdmin) {
      return res.status(400).json({ message: '소속 학교에 관리자가 없습니다. 운영자에게 문의해주세요.' })
    }

    const request = await prisma.certificationRequest.create({
      data: {
        userId: req.user.id,
        schoolId: user.schoolId,
        message: message?.trim() || null,
        organization: organization?.trim() || null,
        contact: contact?.trim() || null,
        organizationType,
        expiresAt: organizationType === 'STUDENT_COUNCIL' ? new Date(expiresAt) : null,
      }
    })

    createNotifications({
      receiverIds: [schoolAdmin.id],
      type: 'CERT_REQUEST',
      title: '인증주최자 신청이 접수되었습니다',
      content: `${user.name}님이 인증주최자 신청을 했습니다.`,
      relatedTargetId: request.id,
    }).catch(e => console.error('[notify cert]', e.message))

    res.status(201).json(request)
  } catch (err) { next(err) }
})

// GET /api/cert-requests/mine — 내 신청 현황
router.get('/mine', authMiddleware, async (req, res, next) => {
  try {
    const requests = await prisma.certificationRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, status: true, message: true, organization: true, contact: true,
        organizationType: true, expiresAt: true, reviewNote: true, createdAt: true,
        reviewedBy: { select: { name: true } }
      }
    })
    res.json(requests)
  } catch (err) { next(err) }
})

// DELETE /api/cert-requests/:id — 신청 취소
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const request = await prisma.certificationRequest.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!request) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })
    if (request.status !== 'PENDING') return res.status(400).json({ message: '처리 중인 신청만 취소할 수 있습니다.' })

    await prisma.certificationRequest.delete({ where: { id: req.params.id } })
    res.json({ message: '신청이 취소되었습니다.' })
  } catch (err) { next(err) }
})

module.exports = router
