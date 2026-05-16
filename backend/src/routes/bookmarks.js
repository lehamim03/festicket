const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')

const router = express.Router()
const prisma = new PrismaClient()

// POST /api/bookmarks/:eventId — 즐겨찾기 토글
router.post('/:eventId', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.params
    const userId = req.user.id

    const existing = await prisma.eventBookmark.findUnique({
      where: { userId_eventId: { userId, eventId } }
    })

    if (existing) {
      await prisma.eventBookmark.delete({ where: { userId_eventId: { userId, eventId } } })
      return res.json({ bookmarked: false })
    }

    const event = await prisma.event.findFirst({ where: { id: eventId, deletedAt: null } })
    if (!event) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    await prisma.eventBookmark.create({ data: { id: `bm_${Date.now()}_${userId.slice(-4)}`, userId, eventId } })
    res.json({ bookmarked: true })
  } catch (err) { next(err) }
})

// GET /api/bookmarks — 내 즐겨찾기 목록
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const bookmarks = await prisma.eventBookmark.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true, title: true, startAt: true, endAt: true,
            location: true, status: true, isPaid: true, price: true,
            capacity: true, imageUrl: true,
            host: { select: { id: true, name: true } },
            school: { select: { id: true, name: true } },
            _count: { select: { registrations: true } },
          }
        }
      }
    })
    res.json(bookmarks.filter(b => b.event).map(b => ({ ...b.event, bookmarkedAt: b.createdAt })))
  } catch (err) { next(err) }
})

// GET /api/bookmarks/ids — 내 즐겨찾기 eventId 목록 (빠른 상태 확인용)
router.get('/ids', authMiddleware, async (req, res, next) => {
  try {
    const bookmarks = await prisma.eventBookmark.findMany({
      where: { userId: req.user.id },
      select: { eventId: true }
    })
    res.json(bookmarks.map(b => b.eventId))
  } catch (err) { next(err) }
})

module.exports = router
