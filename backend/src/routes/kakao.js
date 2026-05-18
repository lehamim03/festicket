const express = require('express')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const { randomUUID } = require('crypto')
const { PrismaClient } = require('@prisma/client')
const { sendVerificationEmail } = require('../services/mailer')

const router = express.Router()
const prisma = new PrismaClient()

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token'
const KAKAO_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me'

function isSchoolEmail(email) {
  const domain = email.split('@')[1]
  if (!domain) return false
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] === 'ac' && parts[i + 1] === 'kr') return true
  }
  return parts[parts.length - 1] === 'edu'
}

// GET /api/auth/kakao — Kakao 인증 페이지로 리다이렉트
router.get('/', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    response_type: 'code',
  })
  res.redirect(`${KAKAO_AUTH_URL}?${params}`)
})

// GET /api/auth/kakao/callback — Kakao 인증 코드 수신 및 처리
router.get('/callback', async (req, res) => {
  const { code, error } = req.query

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=kakao_denied`)
  }

  try {
    // 1. 인증 코드 → 액세스 토큰
    const params = {
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY,
      redirect_uri: process.env.KAKAO_REDIRECT_URI,
      code,
    }
    if (process.env.KAKAO_CLIENT_SECRET) params.client_secret = process.env.KAKAO_CLIENT_SECRET
    const body = new URLSearchParams(params).toString()
    const tokenRes = await axios.post(KAKAO_TOKEN_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    })

    const { access_token } = tokenRes.data

    // 2. 액세스 토큰 → 프로필
    const profileRes = await axios.get(KAKAO_PROFILE_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const kakaoId = String(profileRes.data.id)
    const kakaoName = profileRes.data.kakao_account?.profile?.nickname || '사용자'

    // 3. 기존 유저 확인
    const existingUser = await prisma.user.findUnique({ where: { kakaoId } })

    if (existingUser) {
      // 기존 유저 → JWT 발급 후 바로 로그인
      const schoolData = existingUser.schoolId
        ? await prisma.school.findUnique({ where: { id: existingUser.schoolId }, select: { id: true, name: true, domain: true, adminContact: true } })
        : null

      const token = jwt.sign(
        { id: existingUser.id, email: existingUser.email, role: existingUser.role, emailVerified: existingUser.emailVerified, schoolId: existingUser.schoolId, studentId: existingUser.studentId ?? null },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      )

      const userJson = encodeURIComponent(JSON.stringify({
        id: existingUser.id, name: existingUser.name, email: existingUser.email,
        role: existingUser.role, emailVerified: existingUser.emailVerified,
        schoolId: existingUser.schoolId, school: schoolData, isKakaoUser: true,
      }))

      return res.redirect(`${process.env.FRONTEND_URL}/auth/kakao/callback?token=${token}&user=${userJson}`)
    }

    // 4. 신규 유저 → 임시 토큰 발급 후 추가 정보 입력 페이지로
    const tempToken = jwt.sign(
      { kakaoId, kakaoName },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    )

    return res.redirect(`${process.env.FRONTEND_URL}/register/kakao?tempToken=${tempToken}`)
  } catch (err) {
    console.error('Kakao callback error:', err.response?.data || err.message)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=kakao_failed`)
  }
})

// POST /api/auth/kakao/complete — 학교 이메일 입력 후 최종 가입
router.post('/complete', async (req, res, next) => {
  try {
    const { tempToken, email, studentId, name } = req.body

    if (!tempToken || !email || !studentId) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다.' })
    }

    let payload
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET)
    } catch {
      return res.status(400).json({ message: '인증 세션이 만료되었습니다. 다시 시도해주세요.' })
    }

    if (!payload.kakaoId) {
      return res.status(400).json({ message: '유효하지 않은 요청입니다.' })
    }

    if (!isSchoolEmail(email)) {
      return res.status(400).json({ message: '학교 이메일(.ac.kr 또는 .edu)만 가입할 수 있습니다.' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' })

    const domain = email.split('@')[1]
    const school = await prisma.school.findUnique({ where: { domain } })

    if (!school) {
      return res.status(400).json({ message: '등록되지 않은 학교 이메일입니다.' })
    }

    const existingStudent = await prisma.user.findFirst({ where: { studentId, schoolId: school.id } })
    if (existingStudent) return res.status(409).json({ message: '이미 등록된 학번입니다.' })

    const verifyToken = randomUUID()
    const verifyTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const user = await prisma.user.create({
      data: {
        name: name || payload.kakaoName,
        email,
        password: null,
        kakaoId: payload.kakaoId,
        studentId: studentId || null,
        schoolId: school?.id || null,
        verifyToken,
        verifyTokenExpiry,
      },
      select: { id: true, name: true, email: true, role: true, emailVerified: true, schoolId: true, school: { select: { name: true } } }
    })

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`
    sendVerificationEmail({ to: email, name: user.name, verifyUrl }).catch(console.error)

    res.status(201).json({ ...user, message: '가입 완료! 이메일의 인증 링크를 클릭해주세요.' })
  } catch (err) { next(err) }
})

module.exports = router
