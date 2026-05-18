const express = require('express')
const { PrismaClient } = require('@prisma/client')
const authMiddleware = require('../middleware/auth')
const multer = require('multer')

const router = express.Router({ mergeParams: true })
const prisma = new PrismaClient()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

async function canManageWhitelist(userId, event) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false
  if (user.role === 'OPERATOR') return true
  if (user.role === 'SCHOOL_ADMIN' && user.schoolId === event.schoolId) return true
  if (event.hostId === userId) return true
  const coHost = await prisma.eventCoHost.findFirst({ where: { eventId: event.id, userId } })
  if (coHost) return true
  return false
}

// GET /:eventId/whitelist — 화이트리스트 조회 (UC-W05)
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.params
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    if (!(await canManageWhitelist(req.user.id, event))) {
      return res.status(403).json({ message: '권한이 없습니다.' })
    }

    const whitelist = await prisma.eventWhitelist.findUnique({
      where: { eventId },
      include: { entries: { orderBy: { createdAt: 'asc' } } },
    })

    if (!whitelist) return res.json(null)

    // 학번으로 같은 학교 사용자 이름 조회
    const users = await prisma.user.findMany({
      where: {
        studentId: { in: whitelist.entries.map(e => e.studentId) },
        schoolId: event.schoolId,
      },
      select: { studentId: true, name: true },
    })
    const nameMap = Object.fromEntries(users.map(u => [u.studentId, u.name]))

    res.json({
      ...whitelist,
      entries: whitelist.entries.map(e => ({ ...e, userName: nameMap[e.studentId] ?? null })),
    })
  } catch (err) {
    next(err)
  }
})

// POST /:eventId/whitelist — 화이트리스트 생성 (UC-W01)
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.params
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    if (!(await canManageWhitelist(req.user.id, event))) {
      return res.status(403).json({ message: '권한이 없습니다.' })
    }

    const existing = await prisma.eventWhitelist.findUnique({ where: { eventId } })
    if (existing) return res.status(409).json({ message: '이미 화이트리스트가 존재합니다.' })

    const whitelist = await prisma.eventWhitelist.create({
      data: { eventId },
      include: { entries: true },
    })

    res.status(201).json(whitelist)
  } catch (err) {
    next(err)
  }
})

// POST /:eventId/whitelist/entries — 학번 개별 추가 (UC-W02)
router.post('/entries', authMiddleware, async (req, res, next) => {
  try {
    const { eventId } = req.params
    const { studentId } = req.body
    if (!studentId) return res.status(400).json({ message: 'studentId가 필요합니다.' })

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    if (!(await canManageWhitelist(req.user.id, event))) {
      return res.status(403).json({ message: '권한이 없습니다.' })
    }

    const whitelist = await prisma.eventWhitelist.findUnique({ where: { eventId } })
    if (!whitelist) return res.status(404).json({ message: '화이트리스트가 없습니다. 먼저 생성해주세요.' })

    const entry = await prisma.whitelistEntry.create({
      data: { whitelistId: whitelist.id, studentId: String(studentId) },
    })

    res.status(201).json(entry)
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: '이미 등록된 학번입니다.' })
    }
    next(err)
  }
})

// POST /:eventId/whitelist/upload — 학번 일괄 업로드 txt/csv (UC-W03)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    const { eventId } = req.params
    if (!req.file) return res.status(400).json({ message: '파일이 필요합니다.' })

    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    if (!(await canManageWhitelist(req.user.id, event))) {
      return res.status(403).json({ message: '권한이 없습니다.' })
    }

    const whitelist = await prisma.eventWhitelist.findUnique({ where: { eventId } })
    if (!whitelist) return res.status(404).json({ message: '화이트리스트가 없습니다. 먼저 생성해주세요.' })

    // BR-W06: 행당 학번 1개 또는 콤마 구분
    const text = req.file.buffer.toString('utf-8')
    const studentIds = text
      .split(/[\r\n,]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    const existingEntries = await prisma.whitelistEntry.findMany({
      where: { whitelistId: whitelist.id },
      select: { studentId: true },
    })
    const existingSet = new Set(existingEntries.map(e => e.studentId))
    const toInsert = [...new Set(studentIds)].filter(id => !existingSet.has(id))

    if (toInsert.length > 0) {
      await prisma.whitelistEntry.createMany({
        data: toInsert.map(studentId => ({ whitelistId: whitelist.id, studentId })),
        skipDuplicates: true,
      })
    }

    res.json({
      total: studentIds.length,
      added: toInsert.length,
      skipped: studentIds.length - toInsert.length,
    })
  } catch (err) {
    next(err)
  }
})

// DELETE /:eventId/whitelist/entries/:entryId — 항목 삭제 (UC-W04)
router.delete('/entries/:entryId', authMiddleware, async (req, res, next) => {
  try {
    const { eventId, entryId } = req.params
    const event = await prisma.event.findUnique({ where: { id: eventId } })
    if (!event || event.deletedAt) return res.status(404).json({ message: '행사를 찾을 수 없습니다.' })

    if (!(await canManageWhitelist(req.user.id, event))) {
      return res.status(403).json({ message: '권한이 없습니다.' })
    }

    const whitelist = await prisma.eventWhitelist.findUnique({ where: { eventId } })
    if (!whitelist) return res.status(404).json({ message: '화이트리스트가 없습니다.' })

    const entry = await prisma.whitelistEntry.findFirst({
      where: { id: entryId, whitelistId: whitelist.id },
    })
    if (!entry) return res.status(404).json({ message: '항목을 찾을 수 없습니다.' })

    await prisma.whitelistEntry.delete({ where: { id: entryId } })
    res.json({ message: '삭제되었습니다.' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
