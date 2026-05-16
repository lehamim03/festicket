import { useRef, useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'

// ── 파티클 설정 ──────────────────────────────────────────
const PARTICLES = [
  { icon: '🎪', x: '7%',  y: '14%', size: 34, delay: 0.0, duration: 6.5, pf: 0.030 },
  { icon: '🎵', x: '86%', y: '18%', size: 26, delay: 1.5, duration: 9.0, pf: 0.045 },
  { icon: '🎟️', x: '4%',  y: '56%', size: 24, delay: 0.7, duration: 7.5, pf: 0.035 },
  { icon: '🎉', x: '13%', y: '75%', size: 32, delay: 2.8, duration: 5.8, pf: 0.020 },
  { icon: '✨', x: '44%', y: '9%',  size: 20, delay: 1.0, duration: 8.2, pf: 0.055 },
  { icon: '🎊', x: '90%', y: '67%', size: 32, delay: 0.3, duration: 6.8, pf: 0.025 },
  { icon: '🎶', x: '75%', y: '40%', size: 24, delay: 2.2, duration: 7.2, pf: 0.040 },
  { icon: '⭐', x: '62%', y: '80%', size: 18, delay: 2.6, duration: 9.8, pf: 0.038 },
  { icon: '🎸', x: '28%', y: '26%', size: 22, delay: 3.8, duration: 8.6, pf: 0.050 },
  { icon: '🌟', x: '53%', y: '68%', size: 16, delay: 1.9, duration: 10.2, pf: 0.022 },
]

// 파티클 컴포넌트: 외부 div = parallax, 내부 div = float 애니메이션
function Particle({ icon, x, y, size, delay, duration, pf, springX, springY }) {
  const px = useTransform(springX, [-1, 1], [-pf * 60, pf * 60])
  const py = useTransform(springY, [-1, 1], [-pf * 40, pf * 40])

  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: x, top: y, x: px, y: py }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 0.2, 0.15, 0.22, 0.18],
          scale:   [0.7, 1, 1.12, 0.98, 1.05],
          y:       [0, -18, 2, -12, 0],
          rotate:  [0, 6, -4, 8, 0],
        }}
        transition={{
          delay,
          duration,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.25, 0.5, 0.75, 1],
        }}
      >
        <span style={{ fontSize: size, display: 'block', lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' }}>
          {icon}
        </span>
      </motion.div>
    </motion.div>
  )
}

// ── Ripple 훅 ──────────────────────────────────────────
function useRipple() {
  const [ripples, setRipples] = useState([])
  const trigger = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = Date.now()
    setRipples(prev => [...prev, { x, y, id }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 900)
  }, [])
  return { ripples, trigger }
}

function Ripple({ ripples, color = 'rgba(255,255,255,0.35)' }) {
  return ripples.map(({ x, y, id }) => (
    <motion.span
      key={id}
      className="absolute rounded-full pointer-events-none"
      style={{ left: x - 60, top: y - 60, width: 120, height: 120, background: color }}
      initial={{ scale: 0, opacity: 0.7 }}
      animate={{ scale: 5, opacity: 0 }}
      transition={{ duration: 0.85, ease: [0.2, 0.8, 0.4, 1] }}
    />
  ))
}

// ── 애니메이션 variants ──────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.13, delayChildren: 0.05 },
  },
}
const itemVariants = {
  hidden:   { opacity: 0, y: 28, scale: 0.96 },
  visible:  {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}

// ── 메인 컴포넌트 ──────────────────────────────────────
export default function HeroSection({ eventCount = 0, user, stats = [] }) {
  const allStats = stats.length > 0 ? stats : [{ label: '행사 모집 중', value: `${eventCount}개` }]
  const [statIdx, setStatIdx] = useState(0)

  useEffect(() => {
    if (allStats.length <= 1) return
    const t = setInterval(() => setStatIdx(i => (i + 1) % allStats.length), 2500)
    return () => clearInterval(t)
  }, [allStats.length])
  const heroRef = useRef(null)

  // 마우스 위치 (–1 ~ 1 normalized)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const springX = useSpring(rawX, { stiffness: 55, damping: 18 })
  const springY = useSpring(rawY, { stiffness: 55, damping: 18 })

  // 배경 blob parallax
  const blob1X = useTransform(springX, [-1, 1], ['-6%', '6%'])
  const blob1Y = useTransform(springY, [-1, 1], ['-4%', '4%'])
  const blob2X = useTransform(springX, [-1, 1], ['5%', '-5%'])
  const blob2Y = useTransform(springY, [-1, 1], ['3%', '-3%'])

  const handleMouseMove = useCallback((e) => {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    rawX.set(((e.clientX - rect.left) / rect.width  - 0.5) * 2)
    rawY.set(((e.clientY - rect.top)  / rect.height - 0.5) * 2)
  }, [rawX, rawY])

  const handleMouseLeave = useCallback(() => {
    rawX.set(0)
    rawY.set(0)
  }, [rawX, rawY])

  const primary   = useRipple()
  const secondary = useRipple()

  return (
    <section
      ref={heroRef}
      className="hero-gradient relative rounded-4xl overflow-hidden mb-14 px-4 sm:px-8 py-16 sm:py-28 text-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── 배경 레이어 ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 움직이는 블롭 */}
        <motion.div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)',
            x: blob1X, y: blob1Y,
          }}
        />
        <motion.div
          className="absolute -bottom-32 -right-32 w-[700px] h-[700px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 65%)',
            x: blob2X, y: blob2Y,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%)' }}
        />

        {/* 격자 패턴 */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        {/* 닷 패턴 */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* ── 파티클 ── */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} springX={springX} springY={springY} />
      ))}

      {/* ── 콘텐츠 ── */}
      <motion.div
        className="relative z-10 max-w-2xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 라이브 배지 */}
        <motion.div variants={itemVariants}>
          <motion.div
            className="inline-flex items-center gap-2.5 text-gray-700 text-sm font-semibold px-6 py-3 rounded-full mb-8 overflow-hidden"
            style={{ minWidth: 220, justifyContent: 'center', background: 'rgba(255,255,255,0.5)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="relative overflow-hidden" style={{ width: 160, height: '1.25em' }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={statIdx}
                  className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {allStats[statIdx].value} {allStats[statIdx].label}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.div>
        </motion.div>

        {/* 헤드라인 */}
        <motion.h1
          variants={itemVariants}
          className="font-black text-gray-900 mb-5 leading-[1.12] tracking-tight"
        >
          <span className="text-2xl sm:text-3xl text-gray-900 font-bold" style={{ fontFamily: '"Freesentation", sans-serif' }}>캠퍼스의 모든 행사,</span>
          <br />
          <span
            className="text-5xl sm:text-7xl inline-block mt-0.5 font-black"
            style={{
              fontFamily: '"Freesentation", sans-serif',
              paddingBottom: '0.2em',
              lineHeight: 1.1,
              background: 'linear-gradient(90deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            한 곳에서
          </span>
        </motion.h1>

        {/* 서브텍스트 */}
        <motion.p
          variants={itemVariants}
          className="text-gray-500 text-base sm:text-lg mb-12 leading-relaxed"
        >
          대학 축제부터 동아리 모임까지
          <br className="sm:hidden" />
          {' '}신청부터 QR 체크인까지 한 번에
        </motion.p>

        {/* CTA 버튼들 */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 justify-center">

          {/* Primary 버튼 — gradient border on hover */}
          <motion.div
            className="relative group"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            {/* 글로우 보더 레이어 */}
            <div
              className="absolute -inset-[1.5px] rounded-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: 'linear-gradient(90deg, #fde68a, #f9a8d4, #c4b5fd, #93c5fd, #fde68a)',
                backgroundSize: '200% auto',
                animation: 'borderGradientFlow 3s linear infinite',
                filter: 'blur(1px)',
              }}
            />
            <div
              className="relative overflow-hidden rounded-2xl"
              onClick={primary.trigger}
            >
              <Link
                to={user ? '/events/create' : '/register'}
                className="relative inline-flex items-center justify-center gap-2 bg-primary-600 text-white font-bold px-8 py-4 rounded-2xl text-sm w-full sm:w-auto"
                style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}
              >
                <span className="relative z-10">
                  {user ? '+ 행사 만들기' : '무료로 시작하기'}
                </span>
                <motion.svg
                  className="w-4 h-4 relative z-10"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </motion.svg>
              </Link>
              <Ripple ripples={primary.ripples} color="rgba(99,102,241,0.15)" />
            </div>
          </motion.div>

          {/* Secondary 버튼 */}
          <motion.div
            className="relative overflow-hidden rounded-2xl"
            whileHover={{ scale: 1.04, backgroundColor: 'rgba(255,255,255,0.9)' }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            style={{
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(124,58,237,0.25)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.12)',
            }}
            onClick={secondary.trigger}
          >
            <a
              href="#events"
              className="relative inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 text-sm w-full"
              style={{ color: '#3C3084' }}
            >
              행사 둘러보기
              <motion.svg
                className="w-4 h-4"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            </a>
            <Ripple ripples={secondary.ripples} />
          </motion.div>
        </motion.div>

        {/* 피처 태그 */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-3 mt-12"
        >
          {[
            { label: 'QR 티켓', icon: '🎟️' },
            { label: '무료 행사', icon: '🎉' },
            { label: '실시간 체크인', icon: '⚡' },
            { label: '간편 신청', icon: '✅' },
          ].map(({ label, icon }, i) => (
            <motion.span
              key={label}
              className="inline-flex items-center gap-1.5 text-gray-600 text-xs font-medium px-3.5 py-1.5 rounded-full cursor-default"
              style={{
                background: 'rgba(255,255,255,0.25)',
                boxShadow: '0 2px 8px rgba(180,160,210,0.25)',
              }}
              initial={{ opacity: 0, scale: 0.75, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.55 + i * 0.09,
                type: 'spring',
                stiffness: 600,
                damping: 20,
                backgroundColor: { duration: 0.08 },
                color: { duration: 0.08 },
              }}
              whileHover={{
                scale: 1.1,
                backgroundColor: 'rgba(255,255,255,0.55)',
                transition: { duration: 0.08 },
              }}
              whileTap={{ scale: 0.95, transition: { duration: 0.05 } }}
            >
              <span>{icon}</span>
              {label}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
