import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_COLOR = {
  CONFIRMED:   'bg-primary-500',
  CHECKED_IN:  'bg-green-500',
  PENDING_PAYMENT: 'bg-amber-400',
  CANCELLATION_REQUESTED: 'bg-orange-400',
  CANCELLED:   'bg-gray-300',
  EXPIRED:     'bg-gray-300',
}

const STATUS_LABEL = {
  CONFIRMED: '신청 완료',
  CHECKED_IN: '입장 완료',
  PENDING_PAYMENT: '결제 대기',
  CANCELLATION_REQUESTED: '환불 처리 중',
  CANCELLED: '취소됨',
  EXPIRED: '만료',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function TicketCalendar({ registrations = [] }) {
  const navigate = useNavigate()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  // 행사 날짜별 그룹핑
  const eventsByDate = {}
  registrations.forEach(reg => {
    if (!reg.event?.startAt) return
    const d = new Date(reg.event.startAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!eventsByDate[key]) eventsByDate[key] = []
    eventsByDate[key].push(reg)
  })

  // 달력 날짜 계산
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedKey = selectedDate ? `${year}-${month}-${selectedDate}` : null
  const selectedEvents = selectedKey ? (eventsByDate[selectedKey] ?? []) : []

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-900">{year}년 {month + 1}월</h2>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const key = `${year}-${month}-${day}`
          const dayEvents = eventsByDate[key] ?? []
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const isSelected = selectedDate === day
          const isSunday = (idx % 7) === 0
          const isSaturday = (idx % 7) === 6

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={`relative flex flex-col items-center py-1.5 rounded-xl transition ${
                isSelected ? 'bg-primary-100' : 'hover:bg-gray-50'
              }`}
            >
              <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                isToday ? 'bg-primary-600 text-white' :
                isSunday ? 'text-red-400' :
                isSaturday ? 'text-blue-400' :
                'text-gray-700'
              }`}>
                {day}
              </span>
              {/* 이벤트 도트 */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[28px]">
                  {dayEvents.slice(0, 3).map((reg, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[reg.status] ?? 'bg-gray-300'}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 선택한 날짜 행사 목록 */}
      {selectedDate && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400">{month + 1}월 {selectedDate}일 행사</p>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">신청한 행사가 없습니다.</p>
          ) : (
            selectedEvents.map(reg => (
              <button
                key={reg.id}
                onClick={() => navigate(`/events/${reg.event.id}`)}
                className="w-full text-left flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-primary-200 transition"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[reg.status] ?? 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{reg.event.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(reg.event.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    &nbsp;·&nbsp;{STATUS_LABEL[reg.status] ?? reg.status}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-50">
        {[
          { color: 'bg-primary-500', label: '신청 완료' },
          { color: 'bg-green-500', label: '입장 완료' },
          { color: 'bg-amber-400', label: '결제 대기' },
          { color: 'bg-gray-300', label: '취소/만료' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
