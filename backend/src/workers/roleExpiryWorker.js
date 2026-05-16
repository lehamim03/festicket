const { PrismaClient } = require('@prisma/client')
const { createNotifications } = require('../services/notificationService')

const prisma = new PrismaClient()

// D-7, D-3 임기 만료 임박 알림
async function notifyExpiringRoles() {
  try {
    const now = new Date()
    const targets = [
      { days: 7, type: 'ROLE_EXPIRY_D7', label: '7일' },
      { days: 3, type: 'ROLE_EXPIRY_D3', label: '3일' },
    ]

    for (const { days, type, label } of targets) {
      const from = new Date(now.getTime() + (days - 1) * 86400000)
      const to   = new Date(now.getTime() + days * 86400000)

      const users = await prisma.user.findMany({
        where: {
          role: 'CERTIFIED',
          roleExpiresAt: { gte: from, lt: to },
          deletedAt: null,
        },
        select: { id: true, name: true }
      })

      for (const user of users) {
        // Notification unique constraint이 중복 발송 방지
        createNotifications({
          receiverIds: [user.id],
          type,
          title: `인증주최자 권한이 ${label} 후 만료됩니다`,
          content: `임기가 ${label} 후 종료됩니다. 후임자에게 위임하거나 재신청해주세요.`,
          relatedTargetId: user.id,
        }).catch(e => console.error(`[RoleExpiryWorker] notify ${type}:`, e.message))
        console.log(`[RoleExpiryWorker] D-${days} 알림 userId=${user.id} (${user.name})`)
      }
    }
  } catch (err) {
    console.error('[RoleExpiryWorker] notifyExpiringRoles 오류:', err.message)
  }
}

// 학생회 CERTIFIED 유저 중 임기 만료된 사람 자동 강등
async function expireCertifiedRoles() {
  try {
    const now = new Date()
    const expired = await prisma.user.findMany({
      where: {
        role: 'CERTIFIED',
        roleExpiresAt: { lte: now },
        deletedAt: null,
      },
      select: { id: true, name: true }
    })

    if (expired.length === 0) return

    for (const user of expired) {
      const activeCount = await prisma.event.count({
        where: { hostId: user.id, status: 'PUBLISHED', deletedAt: null }
      })

      if (activeCount > 0) {
        createNotifications({
          receiverIds: [user.id],
          type: 'ROLE_EXPIRY_BLOCKED',
          title: '인증주최자 권한 만료 보류',
          content: `진행 중인 행사 ${activeCount}건이 있어 권한 만료가 보류되었습니다. 행사 종료 후 자동으로 해제됩니다.`,
          relatedTargetId: user.id,
        }).catch(e => console.error('[RoleExpiryWorker] notify blocked:', e.message))
        console.log(`[RoleExpiryWorker] 만료 보류 userId=${user.id} 진행중 행사 ${activeCount}건`)
        continue
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ATTENDEE', roleExpiresAt: null, roleMemo: null }
      })

      createNotifications({
        receiverIds: [user.id],
        type: 'ROLE_EXPIRED',
        title: '인증주최자 권한이 만료되었습니다',
        content: '임기가 종료되어 일반 사용자로 전환되었습니다. 계속 행사를 주최하려면 다시 신청해주세요.',
        relatedTargetId: user.id,
      }).catch(e => console.error('[RoleExpiryWorker] notify expired:', e.message))

      console.log(`[RoleExpiryWorker] 권한 만료 처리 userId=${user.id} (${user.name})`)
    }
  } catch (err) {
    console.error('[RoleExpiryWorker] 오류:', err.message)
  }
}

function start() {
  console.log('[RoleExpiryWorker] 시작')
  notifyExpiringRoles()
  expireCertifiedRoles()
  setInterval(notifyExpiringRoles, 60 * 60 * 1000)
  setInterval(expireCertifiedRoles, 60 * 60 * 1000)
}

module.exports = { start, expireCertifiedRoles }
