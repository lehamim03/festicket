import { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { createEvent, uploadEventImage } from '../api/events'
import { useAuth } from '../hooks/useAuth'

// ── 카드 미리보기 ────────────────────────────────────────────────────────────
const PALETTES = [
  { from: '#6366f1', to: '#8b5cf6' },
  { from: '#f43f5e', to: '#fb923c' },
  { from: '#14b8a6', to: '#0ea5e9' },
  { from: '#f59e0b', to: '#84cc16' },
  { from: '#ec4899', to: '#a855f7' },
  { from: '#3b82f6', to: '#06b6d4' },
]
function EventPreviewCard({ form, imagePreview, openMode, palette }) {
  const startDate = form.startAt ? new Date(form.startAt) : new Date()
  const isValidDate = !isNaN(startDate)
  const day = isValidDate ? startDate.getDate() : '--'
  const month = isValidDate ? startDate.getMonth() + 1 : '--'
  const weekday = isValidDate ? startDate.toLocaleDateString('ko-KR', { weekday: 'short' }) : ''
  const time = isValidDate ? startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const capacity = Number(form.capacity) || 0
  const ratio = 0  // 미리보기에서는 신청자 없음

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card overflow-hidden">
      {/* 헤더 */}
      <div
        className="relative h-40 flex items-end p-5 overflow-hidden"
        style={{
          background: imagePreview
            ? '#111'
            : `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
        }}
      >
        {imagePreview && (
          <img
            src={imagePreview}
            alt="미리보기"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {imagePreview && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        )}

        {/* 날짜 블록 */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-3 py-2.5">
            <span className="text-4xl font-black text-white leading-none">{day}</span>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-white/90 leading-tight">{month}월</span>
              <span className="text-[11px] font-semibold text-white/70 leading-tight">{weekday}</span>
            </div>
          </div>
        </div>

        {/* 가격 뱃지 */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
          {openMode === 'scheduled' && (
            <span className="bg-amber-400/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
              예약 오픈
            </span>
          )}
          <span className="bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
            {form.isPaid
              ? form.price ? `${Number(form.price).toLocaleString()}원` : '유료'
              : '무료'}
          </span>
        </div>
      </div>

      {/* 내용 */}
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-[15px] line-clamp-1 mb-3">
          {form.title || '행사 제목'}
        </h3>

        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2 text-[13px] text-emerald-700 font-medium">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-1">{form.location || '장소 미정'}</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-amber-600 font-medium">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{month}월 {day}일 {time}</span>
          </div>
        </div>

        {/* 잔여석 프로그레스 */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-gray-400 font-medium">모집 현황</span>
            <span className="text-[11px] font-bold text-emerald-600">
              잔여 {capacity}석
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${ratio}%`,
                background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 이미지 업로드 존 ─────────────────────────────────────────────────────────
function ImageUploadZone({ imagePreview, onFile, uploading }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file) => {
    if (!file || !/image\/(jpeg|png|webp)/.test(file.type)) {
      alert('JPG, PNG, WEBP 형식만 지원합니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.')
      return
    }
    onFile(file)
  }, [onFile])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-colors overflow-hidden
        ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
      style={{ minHeight: '180px' }}
    >
      {imagePreview ? (
        <div className="relative">
          <img src={imagePreview} alt="미리보기" className="w-full h-48 object-cover rounded-xl" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
            <span className="text-white text-sm font-semibold">클릭하여 변경</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[180px] gap-2 text-gray-400">
          {uploading ? (
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
          <span className="text-sm font-medium text-gray-500">
            {uploading ? '업로드 중...' : '클릭하여 이미지 업로드'}
          </span>
          {!uploading && <span className="text-xs">JPG · PNG · WEBP</span>}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}

// ── 섹션 카드 ────────────────────────────────────────────────────────────────
function Section({ icon, title, children }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, desc, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      {children}
      {desc && <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{desc}</p>}
    </div>
  )
}

const RELEASE_INTERVALS = [5, 15, 30, 60]

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function EventCreate() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    startAt: '',
    endAt: '',
    registrationDeadline: '',
    capacity: 100,
    isPaid: false,
    price: '',
    releaseIntervalMinutes: 15,
    releaseDeadline: '',
    refundDeadlineAt: '',
    refundContact: '',
    imageUrl: '',
    openMode: 'immediate',
    publishAt: '',
  })
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const palette = useMemo(() => PALETTES[Math.floor(Math.random() * PALETTES.length)], [])

  const canCreate = user && ['CERTIFIED', 'SCHOOL_ADMIN', 'OPERATOR'].includes(user.role)

  const createMutation = useMutation({
    mutationFn: (payload) => createEvent(payload),
    onSuccess: (event) => navigate(`/events/${event.id}/manage`),
    onError: (err) => alert(err.response?.data?.message ?? '생성에 실패했습니다.'),
  })

  const draftMutation = useMutation({
    mutationFn: (payload) => createEvent({ ...payload, status: 'DRAFT' }),
    onSuccess: (event) => navigate(`/events/${event.id}/manage`),
    onError: (err) => alert(err.response?.data?.message ?? '초안 저장에 실패했습니다.'),
  })

  const handleImageFile = async (file) => {
    // 로컬 미리보기 즉시 표시
    const localUrl = URL.createObjectURL(file)
    setImagePreview(localUrl)

    // 서버 업로드
    setUploading(true)
    try {
      const { imageUrl } = await uploadEventImage(file)
      setForm(f => ({ ...f, imageUrl }))
    } catch {
      alert('이미지 업로드에 실패했습니다.')
      setImagePreview(null)
      setForm(f => ({ ...f, imageUrl: '' }))
    } finally {
      setUploading(false)
    }
  }

  const set = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const buildPayload = () => ({
    ...form,
    capacity: Number(form.capacity),
    price: form.isPaid ? Number(form.price) : null,
    releaseIntervalMinutes: Number(form.releaseIntervalMinutes),
    refundDeadlineAt: form.isPaid && form.refundDeadlineAt ? form.refundDeadlineAt : null,
    releaseDeadline: form.releaseDeadline || null,
    imageUrl: form.imageUrl || null,
    publishAt: form.openMode === 'scheduled' && form.publishAt ? form.publishAt : null,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (uploading) return alert('이미지 업로드가 완료될 때까지 기다려주세요.')
    if (!form.startAt || !form.endAt) return alert('시작/종료 시각을 입력해주세요.')
    if (form.openMode === 'scheduled' && !form.publishAt) return alert('오픈 시각을 입력해주세요.')
    createMutation.mutate(buildPayload())
  }

  const handleDraftSave = () => {
    if (uploading) return alert('이미지 업로드가 완료될 때까지 기다려주세요.')
    if (!form.title.trim()) return alert('행사명을 입력해주세요.')
    draftMutation.mutate(buildPayload())
  }

  if (!canCreate) {
    return (
      <div className="card p-12 text-center text-gray-600">
        행사 생성 권한이 없습니다. 인증사용자(CERTIFIED) 이상만 가능합니다.
      </div>
    )
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>
        <h1 className="text-2xl font-bold text-gray-900">새 행사 만들기</h1>
        <p className="text-sm text-gray-400 mt-1">우측에서 카드 미리보기를 실시간으로 확인하세요</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ── 왼쪽: 입력 폼 ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* 대표 이미지 */}
            <Section icon="🖼️" title="대표 이미지">
              <Field label="행사 이미지">
                <ImageUploadZone
                  imagePreview={imagePreview}
                  onFile={handleImageFile}
                  uploading={uploading}
                />
              </Field>
            </Section>

            {/* 기본 정보 */}
            <Section icon="📝" title="기본 정보">
              <Field label="행사명 *" hint={`${form.title.length}/50`}>
                <input
                  className="input"
                  required
                  maxLength={50}
                  placeholder="멋진 행사 이름을 지어보세요"
                  value={form.title}
                  onChange={set('title')}
                />
              </Field>
              <Field label="설명" hint={`${form.description.length}/500`}>
                <textarea
                  className="input min-h-[120px] resize-none"
                  maxLength={500}
                  placeholder="행사에 대한 자세한 설명을 적어주세요"
                  value={form.description}
                  onChange={set('description')}
                />
              </Field>
            </Section>

            {/* 일정 & 장소 */}
            <Section icon="📅" title="일정 & 장소">
              <Field label="장소">
                <input className="input" placeholder="예: 학생회관 대강당" value={form.location} onChange={set('location')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="시작 *">
                  <input type="datetime-local" className="input" value={form.startAt} onChange={set('startAt')} />
                </Field>
                <Field label="종료 *">
                  <input type="datetime-local" className="input" value={form.endAt} onChange={set('endAt')} />
                </Field>
              </div>
              <Field
                label="1차 신청마감"
                desc="대략적인 참가 인원 파악을 위한 마감입니다. 이 시각 이후에는 일반 신청을 받지 않으며, 잔여석은 취소표로 전환되어 릴리즈됩니다."
              >
                <input type="datetime-local" className="input" value={form.registrationDeadline} onChange={set('registrationDeadline')} />
              </Field>
              <Field
                label="2차 신청마감"
                desc="취소표 릴리즈가 종료되는 최종 마감입니다. 이 시각 이후에는 모든 신청이 불가합니다."
              >
                <input type="datetime-local" className="input" value={form.releaseDeadline} onChange={set('releaseDeadline')} />
              </Field>
            </Section>

            {/* 신청 설정 */}
            <Section icon="⚙️" title="신청 설정">
              <Field label="정원 *">
                <input type="number" min={1} className="input" required value={form.capacity} onChange={set('capacity')} />
              </Field>
              <Field label="취소표 릴리즈 주기">
                <div className="flex gap-2 flex-wrap">
                  {RELEASE_INTERVALS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, releaseIntervalMinutes: m }))}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        form.releaseIntervalMinutes === m
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m}분
                    </button>
                  ))}
                </div>
              </Field>
            </Section>

            {/* 유료 설정 */}
            <Section icon="💳" title="결제 설정">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, isPaid: !f.isPaid }))}
                  className={`w-10 h-6 rounded-full transition-colors relative ${form.isPaid ? 'bg-primary-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPaid ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">유료 행사</span>
              </label>

              {form.isPaid && (
                <div className="space-y-4 pt-2 border-t">
                  <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700">
                    <span className="shrink-0">ℹ️</span>
                    <span>학생회비 납부자 화이트리스트는 행사 생성 후 <strong>관리 페이지</strong>에서 등록할 수 있습니다.</span>
                  </div>
                  <Field label="가격 (원, 100원 이상) *">
                    <div className="relative">
                      <input
                        type="number"
                        min={100}
                        className="input pr-8"
                        placeholder="10000"
                        value={form.price}
                        onChange={set('price')}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                    </div>
                  </Field>
                  <Field
                    label="환불 마감"
                    desc="이 시각 이후 취소표를 구매한 참가자는 환불을 받을 수 없습니다. 노쇼 방지를 위해 1차 신청마감과 2차 신청마감 사이로 설정하는 것을 권장합니다."
                  >
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.refundDeadlineAt}
                      onChange={set('refundDeadlineAt')}
                    />
                  </Field>
                  <Field label="환불 마감 이후 문의처">
                    <input
                      className="input"
                      placeholder="예: host@univ.ac.kr / 010-1234-5678"
                      value={form.refundContact}
                      onChange={set('refundContact')}
                    />
                  </Field>
                </div>
              )}
            </Section>

            {/* 오픈 설정 */}
            <Section icon="🚀" title="오픈 설정">
              {form.isPaid && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700">
                  <span className="shrink-0">💡</span>
                  <span>화이트리스트 적용 행사의 경우 <strong>지정된 시간에 오픈</strong>을 사용하면, 오픈 전에 화이트리스트를 미리 등록해 두고 지정 시각부터 신청을 받을 수 있습니다.</span>
                </div>
              )}
              <Field label="행사 카드 공개 시점">
                <div className="flex gap-2">
                  {[
                    { mode: 'immediate', label: '⚡ 바로 오픈' },
                    { mode: 'scheduled', label: '🕐 지정된 시간에 오픈' },
                  ].map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, openMode: mode, publishAt: mode === 'immediate' ? '' : f.publishAt }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        form.openMode === mode
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.openMode === 'scheduled' && (
                  <div className="mt-3 space-y-1">
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.publishAt}
                      onChange={set('publishAt')}
                    />
                    <p className="text-xs text-gray-400">설정한 시각이 되면 행사 카드가 목록에 공개됩니다.</p>
                  </div>
                )}
              </Field>
            </Section>

            {/* 제출 */}
            <div className="flex gap-3 pb-8 flex-wrap">
              <button type="button" onClick={() => navigate(-1)} className="btn border border-gray-200 text-gray-600 flex-1">
                취소
              </button>
              <button
                type="button"
                onClick={handleDraftSave}
                disabled={draftMutation.isPending || createMutation.isPending || uploading}
                className="btn border border-amber-300 text-amber-700 hover:bg-amber-50 flex-1 disabled:opacity-60"
              >
                {draftMutation.isPending ? '저장 중...' : '초안으로 저장'}
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || draftMutation.isPending || uploading}
                className="btn btn-primary flex-[2] disabled:opacity-60"
              >
                {createMutation.isPending ? '생성 중...' : '바로 공개'}
              </button>
            </div>
          </div>

          {/* ── 오른쪽: 카드 미리보기 (sticky) ── */}
          <div className="w-full lg:w-[320px] shrink-0 lg:sticky top-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-gray-700">카드 미리보기</span>
                </div>
                <span className="text-[11px] text-gray-400">실시간 반영</span>
              </div>
              <EventPreviewCard form={form} imagePreview={imagePreview} openMode={form.openMode} palette={palette} />
              <p className="text-[11px] text-gray-400 text-center mt-3">
                행사 ID 기반 테마 색상이 자동 배정됩니다
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
