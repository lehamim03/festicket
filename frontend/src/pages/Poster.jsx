import EventCard from '../components/EventCard'

const MOCK_EVENTS = [
  {
    id: 'id0',
    title: '2026 봄 대학 축제',
    location: '중앙광장',
    startAt: new Date('2026-05-20T18:00:00').toISOString(),
    capacity: 300,
    isPaid: false,
    price: null,
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=200&fit=crop',
    status: 'OPEN',
    scope: 'PUBLIC',
    _count: { registrations: 241, waitlist: 0 },
    host: { isVerifiedHost: true },
    school: null,
  },
  {
    id: 'id2',
    title: '동아리 봄 공연',
    location: '소극장',
    startAt: new Date('2026-05-25T15:00:00').toISOString(),
    capacity: 100,
    isPaid: true,
    price: 5000,
    imageUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=200&fit=crop',
    status: 'OPEN',
    scope: 'PUBLIC',
    _count: { registrations: 78, waitlist: 0 },
    host: { isVerifiedHost: false },
    school: null,
  },
  {
    id: 'id4',
    title: '취업 특강: 이력서 클리닉',
    location: '강의동 301호',
    startAt: new Date('2026-06-01T14:00:00').toISOString(),
    capacity: 50,
    isPaid: false,
    price: null,
    imageUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=400&h=200&fit=crop',
    status: 'OPEN',
    scope: 'SCHOOL',
    _count: { registrations: 49, waitlist: 3 },
    host: { isVerifiedHost: true },
    school: { name: '국민대학교' },
  },
]

export default function Poster() {
  return (
    <>
      <style>{`
        @media print {
          @page { size: 930mm 1000mm; margin: 0; }
          body * { visibility: hidden; }
          #poster-root, #poster-root * { visibility: visible; }
          #poster-root { position: fixed; top: 0; left: 0; }
        }
      `}</style>

      <div id="poster-root" style={{
        width: '930px',
        height: '1000px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #e9e5ff 50%, #f0e9ff 100%)',
        fontFamily: '"Freesentation", -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 32px',
        gap: '9px',
        boxSizing: 'border-box',
        position: 'relative',
      }}>

        {/* 배경 블롭 */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-100px', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* ── 헤더 ── */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', marginBottom: '6px', position: 'relative', top: '-8px' }}>
            <img src="/logo6.png" alt="festicket" style={{ height: '44px', objectFit: 'contain' }} />
            <span style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', letterSpacing: '-1px' }}>페스티켓</span>
          </div>
          <h1 style={{ fontSize: '46px', fontWeight: '900', lineHeight: 1.1, margin: '0 0 4px', letterSpacing: '-2px', background: 'linear-gradient(90deg,#7c3aed,#6366f1,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            캠퍼스의 모든 행사, 한 곳에서
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>대학 축제부터 동아리 모임까지 · 신청부터 QR 체크인까지 한 번에</p>
        </div>

        {/* ── 행사 카드 3개 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', position: 'relative', zIndex: 10 }}>
          {MOCK_EVENTS.map(event => <EventCard key={event.id} event={event} />)}
        </div>

        {/* ── 주요 기능 5개 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px', position: 'relative', zIndex: 10 }}>
          {[
            { badge: '운영', color: '#3b82f6', title: '행사 관리', items: ['행사 생성 및 수정', 'QR 티켓 발급', '실시간 체크인'] },
            { badge: '참여', color: '#10b981', title: '간편 참여', items: ['행사 둘러보기', '클릭 한 번 신청', 'QR로 입장'] },
            { badge: '결제', color: '#f59e0b', title: '유료 결제', items: ['Toss Payments', '자동 환불 처리', '무료·유료 통합'] },
            { badge: '가격', color: '#8b5cf6', title: '화이트리스트', items: ['대상별 가격 차등', '초청 명단 관리', '권한 기반 접근'] },
            { badge: '행정', color: '#f43f5e', title: '행정 파일', items: ['증빙보고서 다운로드', '행정파일 자동생성', '참가자 명단 출력'] },
          ].map((f, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.7)', borderTop: `3px solid ${f.color}`, borderRadius: '12px', padding: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                <div style={{ background: f.color, color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', flexShrink: 0, lineHeight: 1 }}>{f.badge}</div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>{f.title}</span>
              </div>
              {f.items.map((item, j) => (
                <div key={j} style={{ fontSize: '10px', color: '#475569', marginBottom: '3px', display: 'flex', gap: '4px' }}>
                  <span style={{ color: f.color }}>●</span>{item}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── 사용 화면 4개 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', position: 'relative', zIndex: 10 }}>
          {[
            {
              title: '행사 목록', color: '#3730a3', height: '130px',
              body: (
                <div style={{ padding: '6px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
                  {[['봄 축제','무료','#6366f1'],['동아리 공연','5,000원','#f43f5e'],['취업 특강','무료','#10b981']].map(([t,p,c],j)=>(
                    <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'4px 5px', marginBottom:'3px', background:'white', borderRadius:'4px', fontSize:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}><div style={{ width:'6px',height:'6px',borderRadius:'1px',background:c }} />{t}</div>
                      <span style={{ color:'#64748b' }}>{p}</span>
                    </div>
                  ))}
                </div>
              ),
              desc: '행사 둘러보기',
            },
            {
              title: '행사 신청', color: '#3730a3', height: '130px',
              body: (
                <div style={{ padding: '6px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:'8px', fontWeight:'bold', color:'#1e293b' }}>2026 봄 대학 축제</div>
                    <span style={{ fontSize:'6px', fontWeight:'bold', background:'#dcfce7', color:'#16a34a', padding:'1px 4px', borderRadius:'3px' }}>무료</span>
                  </div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <div style={{ fontSize:'7px', color:'#64748b' }}>📅 5월 20일 18:00</div>
                    <div style={{ fontSize:'7px', color:'#64748b' }}>📍 중앙광장</div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                      <span style={{ fontSize:'6px', color:'#94a3b8' }}>241 / 300명</span>
                      <span style={{ fontSize:'6px', color:'#10b981', fontWeight:'bold' }}>잔여 59석</span>
                    </div>
                    <div style={{ height:'3px', background:'#e2e8f0', borderRadius:'2px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:'80%', background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:'2px' }} />
                    </div>
                  </div>
                  <div style={{ background:'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius:'4px', padding:'4px', textAlign:'center', marginTop:'auto' }}>
                    <span style={{ fontSize:'8px', fontWeight:'bold', color:'white' }}>지금 신청하기</span>
                  </div>
                </div>
              ),
              desc: '간편 신청',
            },
            {
              title: '🎟️ 내 티켓', color: '#3730a3', height: '130px',
              body: (
                <div style={{ padding: '6px', display:'flex', gap:'6px' }}>
                  <div style={{ flex:1, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:'6px', padding:'8px' }}>
                    <div style={{ fontSize:'8px', fontWeight:'bold', color:'white', marginBottom:'3px' }}>봄 대학 축제</div>
                    <div style={{ fontSize:'7px', color:'rgba(255,255,255,0.75)', marginBottom:'2px' }}>📍 중앙광장</div>
                    <div style={{ fontSize:'7px', color:'rgba(255,255,255,0.75)' }}>📅 5월 20일 18:00</div>
                    <div style={{ borderTop:'1.5px dashed rgba(255,255,255,0.4)', margin:'6px 0' }} />
                    <div style={{ fontSize:'7px', color:'rgba(255,255,255,0.6)' }}>홍길동 · 1매</div>
                  </div>
                  <div style={{ background:'white', borderRadius:'6px', padding:'5px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="2" width="16" height="16" rx="2" fill="#6366f1"/>
                      <rect x="4" y="4" width="12" height="12" rx="1" fill="white"/>
                      <rect x="6" y="6" width="8" height="8" rx="1" fill="#6366f1"/>
                      <rect x="26" y="2" width="16" height="16" rx="2" fill="#6366f1"/>
                      <rect x="28" y="4" width="12" height="12" rx="1" fill="white"/>
                      <rect x="30" y="6" width="8" height="8" rx="1" fill="#6366f1"/>
                      <rect x="2" y="26" width="16" height="16" rx="2" fill="#6366f1"/>
                      <rect x="4" y="28" width="12" height="12" rx="1" fill="white"/>
                      <rect x="6" y="30" width="8" height="8" rx="1" fill="#6366f1"/>
                      <rect x="20" y="2" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="26" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="32" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="38" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="20" y="26" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="20" y="32" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="26" y="32" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="32" y="26" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="38" y="38" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="20" y="38" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="32" y="38" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="20" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="2" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                      <rect x="8" y="20" width="4" height="4" rx="1" fill="#6366f1"/>
                    </svg>
                  </div>
                </div>
              ),
              desc: 'QR 티켓',
            },
            {
              title: '⚡ QR 체크인', color: '#3730a3', height: '130px',
              body: (
                <div style={{ padding: '6px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ border:'2px dashed #6366f1', borderRadius:'6px', padding:'14px', textAlign:'center', marginBottom:'4px' }}>
                    <div style={{ fontSize:'20px', marginBottom:'2px' }}>📷</div>
                    <div style={{ fontSize:'7px', color:'#64748b' }}>QR 스캔</div>
                  </div>
                  <div style={{ background:'#eef2ff', borderRadius:'4px', padding:'3px', textAlign:'center' }}>
                    <span style={{ fontSize:'8px', color:'#6366f1', fontWeight:'bold' }}>✓ 체크인 완료</span>
                  </div>
                </div>
              ),
              desc: '실시간 체크인',
            },
          ].map((s, i) => (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'100%', height: s.height, background:'#f8fafc', borderRadius:'10px', border:'1px solid #e2e8f0', overflow:'hidden', display:'flex', flexDirection:'column', flex: 1 }}>
                <div style={{ background: s.color, padding:'7px 10px' }}>
                  <div style={{ fontSize:'10px', fontWeight:'bold', color:'white' }}>{s.title}</div>
                </div>
                {s.body}
              </div>
              <div style={{ fontSize:'11px', fontWeight:'700', color:'#1e293b' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ── 아키텍처 다이어그램 ── */}
        <div style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.6)', borderRadius: '14px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b', marginBottom: '12px', letterSpacing: '0.5px' }}>ARCHITECTURE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', justifyContent: 'center' }}>

            {/* 사용자 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#f1f5f9', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
              <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '600' }}>사용자</span>
            </div>

            {/* 화살표 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', margin: '0 6px', marginBottom: '14px' }}>
              <div style={{ height: '1.5px', width: '32px', background: '#6366f1' }} />
              <span style={{ fontSize: '7px', color: '#94a3b8' }}>HTTPS</span>
            </div>

            {/* 프론트엔드 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: '10px', padding: '8px 10px', minWidth: '80px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: '800', color: 'white', marginBottom: '2px' }}>React SPA</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.75)' }}>TailwindCSS</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '2px' }}>AWS Amplify</div>
              </div>
              <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '600' }}>Frontend</span>
            </div>

            {/* 화살표 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', margin: '0 6px', marginBottom: '14px' }}>
              <div style={{ height: '1.5px', width: '32px', background: '#6366f1' }} />
              <span style={{ fontSize: '7px', color: '#94a3b8' }}>REST API</span>
            </div>

            {/* 백엔드 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ background: 'linear-gradient(135deg,#0ea5e9,#3b82f6)', borderRadius: '10px', padding: '8px 10px', minWidth: '90px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: '800', color: 'white', marginBottom: '2px' }}>Express.js</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.75)' }}>Node.js · Prisma</div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.6)', marginTop: '2px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '2px' }}>API Gateway</div>
              </div>
              <span style={{ fontSize: '8px', color: '#64748b', fontWeight: '600' }}>Backend</span>
            </div>

            {/* 화살표 → 분기 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '0 6px', marginBottom: '14px' }}>
              <div style={{ height: '1.5px', width: '28px', background: '#10b981' }} />
              <div style={{ height: '1.5px', width: '28px', background: '#f59e0b' }} />
              <div style={{ height: '1.5px', width: '28px', background: '#8b5cf6' }} />
            </div>

            {/* 우측 서비스들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {/* Supabase */}
              <div style={{ display: 'flex', gap: '5px' }}>
                <div style={{ background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: '8px', padding: '5px 8px', minWidth: '80px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#10b981' }}>Supabase</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>PostgreSQL</div>
                </div>
                <div style={{ background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: '8px', padding: '5px 8px', minWidth: '66px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#10b981' }}>Storage</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>이미지</div>
                </div>
              </div>
              {/* 인증 + 결제 */}
              <div style={{ display: 'flex', gap: '5px' }}>
                <div style={{ background: '#fefce8', border: '1.5px solid #f59e0b', borderRadius: '8px', padding: '5px 8px', minWidth: '80px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#f59e0b' }}>Kakao OAuth</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>JWT 인증</div>
                </div>
                <div style={{ background: '#fdf4ff', border: '1.5px solid #8b5cf6', borderRadius: '8px', padding: '5px 8px', minWidth: '66px', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', fontWeight: '800', color: '#8b5cf6' }}>Toss</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>결제</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}
