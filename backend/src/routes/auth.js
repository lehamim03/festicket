const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomUUID, randomBytes } = require('crypto')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
const authMiddleware = require('../middleware/auth')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/mailer')
const supabase = require('../services/supabase')

const router = express.Router()
const prisma = new PrismaClient()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    allowed.includes(ext) ? cb(null, true) : cb(new Error('JPG·PNG·WEBP만 가능합니다.'))
  }
})

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true, legacyHeaders: false,
})
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: '회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.' },
  standardHeaders: true, legacyHeaders: false,
})
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: '요청이 너무 많습니다. 1시간 후 다시 시도해주세요.' },
  standardHeaders: true, legacyHeaders: false,
})

// POST /api/auth/register — 회원가입
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { name, email, password, studentId } = req.body
    if (!name || !email || !password || !studentId) {
      return res.status(400).json({ message: '모든 필드를 입력해주세요.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      if (!existing.deletedAt) {
        return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' })
      }
      const daysSince = (Date.now() - new Date(existing.deletedAt).getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) {
        const remaining = Math.ceil(7 - daysSince)
        return res.status(409).json({ message: `탈퇴 후 7일이 지나야 재가입할 수 있습니다. (${remaining}일 남음)` })
      }
      // 7일 경과 시 기존 레코드 이메일 익명화 (FK 참조 유지, 이메일 중복 방지)
      await prisma.user.update({ where: { id: existing.id }, data: { email: `deleted_${existing.id}@deleted` } })
    }

    // 이메일 도메인으로 학교 자동 매칭
    const domain = email.split('@')[1]
    const school = await prisma.school.findUnique({ where: { domain } })

    const existingStudent = await prisma.user.findFirst({ where: { studentId, schoolId: school?.id || null } })
    if (existingStudent) return res.status(409).json({ message: '이미 등록된 학번입니다.' })

    if (!school) {
      return res.status(400).json({ message: '등록되지 않은 학교 이메일입니다.' })
    }

    const hashed = await bcrypt.hash(password, 10)
    const verifyToken = randomUUID()
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const user = await prisma.user.create({
      data: {
        name, email, password: hashed,
        studentId: studentId || null,
        schoolId: school?.id || null,
        verifyToken, verifyTokenExpiry
      },
      select: { id: true, name: true, email: true, role: true, studentId: true, schoolId: true, school: { select: { name: true } } }
    })

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`
    sendVerificationEmail({ to: email, name, verifyUrl }).catch(console.error)

    res.status(201).json({ ...user, message: '가입 완료! 이메일의 인증 링크를 클릭해주세요.' })
  } catch (err) { next(err) }
})

// GET /api/auth/verify-email?token=xxx — 이메일 인증
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query
    if (!token) return res.status(400).json({ message: '유효하지 않은 링크입니다.' })

    const user = await prisma.user.findUnique({ where: { verifyToken: token } })
    if (!user) return res.status(400).json({ message: '유효하지 않거나 만료된 링크입니다.' })
    if (user.verifyTokenExpiry && user.verifyTokenExpiry < new Date()) {
      return res.status(400).json({ message: '만료된 인증 링크입니다. 재발송 버튼을 클릭해주세요.' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null }
    })
    res.json({ message: '이메일 인증이 완료되었습니다.' })
  } catch (err) { next(err) }
})

// POST /api/auth/resend-verification — 인증 메일 재발송 (로그인 불필요, 이메일로 요청)
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : req.user ? await prisma.user.findUnique({ where: { id: req.user.id } }) : null
    if (!user) return res.json({ message: '인증 메일을 재발송했습니다.' }) // 보안상 존재 여부 미노출
    if (user.emailVerified) return res.status(400).json({ message: '이미 인증된 이메일입니다.' })

    const verifyToken = randomUUID()
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyTokenExpiry, emailVerified: false } })

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`
    await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl })
    res.json({ message: '인증 메일을 재발송했습니다.' })
  } catch (err) { next(err) }
})

// POST /api/auth/login — 로그인
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })
    }
    if (user.deletedAt) {
      return res.status(401).json({ message: '탈퇴한 계정입니다.' })
    }
    if (!user.emailVerified) {
      const tokenExpired = !user.verifyTokenExpiry || new Date(user.verifyTokenExpiry) < new Date()
      return res.status(403).json({ message: '이메일 인증이 필요합니다.', needsVerification: true, tokenExpired, email: user.email })
    }
    const schoolData = user.schoolId
      ? await prisma.school.findUnique({ where: { id: user.schoolId }, select: { id: true, name: true, domain: true, adminContact: true } })
      : null
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, emailVerified: user.emailVerified, schoolId: user.schoolId, studentId: user.studentId ?? null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, schoolId: user.schoolId, school: schoolData, isKakaoUser: !!user.kakaoId } })
  } catch (err) { next(err) }
})

// GET /api/auth/me — 내 정보 조회
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, emailVerified: true,
        studentId: true, schoolId: true, kakaoId: true, roleMemo: true, roleExpiresAt: true,
        organizationType: true, profileImageUrl: true, adminContact: true,
        school: { select: { id: true, name: true, domain: true } }
      }
    })

    // 학교 관리자 연락처 목록 (ATTENDEE/CERTIFIED에게 플로팅 버튼용)
    const schoolAdminContacts = user.schoolId ? await prisma.user.findMany({
      where: { schoolId: user.schoolId, role: 'SCHOOL_ADMIN', deletedAt: null, adminContact: { not: null } },
      select: { id: true, name: true, roleMemo: true, adminContact: true }
    }) : []

    res.json({ ...user, isKakaoUser: !!user.kakaoId, schoolAdminContacts })
  } catch (err) { next(err) }
})

// GET /api/auth/check-student-id?studentId=xxx — 학번 중복 확인
router.get('/check-student-id', authMiddleware, async (req, res, next) => {
  try {
    const { studentId } = req.query
    if (!studentId) return res.json({ available: true })
    const existing = await prisma.user.findUnique({ where: { studentId } })
    const available = !existing || existing.id === req.user.id
    res.json({ available })
  } catch (err) { next(err) }
})

// PUT /api/auth/me — 개인정보 수정
router.put('/me', authMiddleware, async (req, res, next) => {
  try {
    const { name, email, studentId, currentPassword, newPassword } = req.body
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })

    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' })
    }

    if (studentId && studentId !== user.studentId) {
      const existing = await prisma.user.findUnique({ where: { studentId } })
      if (existing) return res.status(409).json({ message: '이미 등록된 학번입니다.' })
    }

    let hashedPassword
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: '현재 비밀번호를 입력하세요.' })
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) return res.status(401).json({ message: '현재 비밀번호가 올바르지 않습니다.' })
      hashedPassword = await bcrypt.hash(newPassword, 10)
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || undefined,
        email: email || undefined,
        studentId: studentId !== undefined ? (studentId || null) : undefined,
        password: hashedPassword || undefined
      },
      select: { id: true, name: true, email: true, role: true, studentId: true }
    })
    res.json(updated)
  } catch (err) { next(err) }
})

// POST /api/auth/forgot-password — 비밀번호 재설정 메일 발송
router.post('/forgot-password', passwordLimiter, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: '이메일을 입력하세요.' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.json({ message: '입력한 이메일로 재설정 링크를 발송했습니다.' })

    const resetToken = randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry: resetExpiry },
    })

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch(console.error)

    res.json({ message: '입력한 이메일로 재설정 링크를 발송했습니다.' })
  } catch (err) { next(err) }
})

// POST /api/auth/reset-password — 새 비밀번호 저장
router.post('/reset-password', passwordLimiter, async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: '토큰과 새 비밀번호를 입력하세요.' })
    if (password.length < 8) return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' })

    const user = await prisma.user.findUnique({ where: { resetToken: token } })
    if (!user) return res.status(400).json({ message: '유효하지 않은 링크입니다.' })
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ message: '만료된 링크입니다. 다시 요청해주세요.' })
    }

    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    })

    res.json({ message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.' })
  } catch (err) { next(err) }
})

// DELETE /api/auth/me — 회원탈퇴 (soft delete)
router.delete('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })

    // BR-U07: 학교총관리자는 탈퇴 불가
    if (user.role === 'SCHOOL_ADMIN') {
      return res.status(403).json({ message: '학교총관리자는 운영자에게 탈퇴 요청이 필요합니다.' })
    }

    // BR-U08: 인증사용자는 진행 중 행사(PUBLISHED) 0건일 때만 탈퇴 가능
    if (user.role === 'CERTIFIED') {
      const activeEventCount = await prisma.event.count({
        where: { hostId: user.id, status: 'PUBLISHED', deletedAt: null },
      })
      if (activeEventCount > 0) {
        return res.status(403).json({
          message: `진행 중인 행사 ${activeEventCount}건이 있어 탈퇴할 수 없습니다. 행사를 먼저 종료하거나 삭제해주세요.`,
        })
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { deletedAt: new Date() }
    })
    res.json({ message: '탈퇴가 완료되었습니다.' })
  } catch (err) { next(err) }
})

// POST /api/auth/profile-image — 프로필 이미지 업로드
router.post('/profile-image', authMiddleware, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: '이미지 파일이 필요합니다. (JPG·PNG·WEBP, 최대 3MB)' })

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
    const storagePath = `profiles/${req.user.id}${ext}`

    const { error } = await supabase.storage
      .from('event-images')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      })

    if (error) return res.status(500).json({ message: '이미지 업로드에 실패했습니다.' })

    const { data: { publicUrl } } = supabase.storage
      .from('event-images')
      .getPublicUrl(storagePath)

    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

    await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImageUrl: cacheBustedUrl }
    })

    res.json({ profileImageUrl: cacheBustedUrl })
  } catch (err) { next(err) }
})

// DELETE /api/auth/profile-image — 프로필 이미지 삭제
router.delete('/profile-image', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { profileImageUrl: true }
    })

    if (user?.profileImageUrl) {
      const storagePath = user.profileImageUrl.split('/event-images/')[1]?.split('?')[0]
      if (storagePath) {
        await supabase.storage.from('event-images').remove([storagePath])
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImageUrl: null }
    })

    res.json({ message: '프로필 이미지가 삭제되었습니다.' })
  } catch (err) { next(err) }
})

module.exports = router
