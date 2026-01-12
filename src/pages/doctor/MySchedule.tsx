import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ConsultationType = 'FIRST_VISIT' | 'FOLLOWUP' | 'CHRONIC_DISEASE' | 'PRESCRIPTION' | 'CONSULTATION' | 'CHECKUP' | 'EMERGENCY'

interface Consultation {
  id: string
  consultation_date: string
  start_time: string
  end_time: string
  consultation_type: ConsultationType
  status: string
  patient_id: string | null
  patient_notes: string | null
  documents: any
  patient?: {
    full_name: string
  }
}

interface Absence {
  id: string
  start_date: string
  end_date: string
  reason: string
}

interface TimeSlot {
  start: string
  end: string
}

interface Availability {
  id: string
  is_recurring: boolean
  start_date: string | null
  end_date: string | null
  days_of_week: number[] | null
  specific_date: string | null
  time_slots: TimeSlot[]
}

export default function MySchedule() {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredConsultation, setHoveredConsultation] = useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(12)//tutaj jest poczatkowa godizna widoku (wierszami)

  const SLOT_HEIGHT = 60
  const HOURS_TO_SHOW = 6
  const SLOT_DURATION = 30

  useEffect(() => {
    loadData()
  }, [currentWeekStart])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const [consults, abs, avail] = await Promise.all([
      supabase
        .from('consultations')
        .select('*, patient:profiles!consultations_patient_id_fkey(full_name)')
        .eq('doctor_id', user.id)
        .gte('consultation_date', currentWeekStart.toISOString().split('T')[0])
        .lte('consultation_date', weekEnd.toISOString().split('T')[0])
        .neq('status', 'CANCELLED')   // ← dodaj ten wiersz
        .order('consultation_date')
        .order('start_time'),
      supabase
        .from('doctor_absences')
        .select('*')
        .eq('doctor_id', user.id)
        .or(`and(start_date.lte.${weekEnd.toISOString().split('T')[0]},end_date.gte.${currentWeekStart.toISOString().split('T')[0]})`),
      supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', user.id)
    ])

    setConsultations(consults.data || [])
    setAbsences(abs.data || [])
    setAvailabilities(avail.data || [])
    setLoading(false)
  }

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  function navigateWeek(direction: number) {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentWeekStart(newDate)
  }

  function isDateInAbsence(date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    return absences.some(abs => dateStr >= abs.start_date && dateStr <= abs.end_date)
  }

  function getAvailableSlotsForDate(date: Date): TimeSlot[] {
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()
    const slots: TimeSlot[] = []

    availabilities.forEach(avail => {
      if (avail.is_recurring) {
        if (
          avail.start_date &&
          avail.end_date &&
          dateStr >= avail.start_date &&
          dateStr <= avail.end_date &&
          avail.days_of_week?.includes(dayOfWeek)
        ) {
          slots.push(...avail.time_slots)
        }
      } else {
        if (avail.specific_date === dateStr) {
          slots.push(...avail.time_slots)
        }
      }
    })

    return slots
  }

  function isSlotAvailable(date: Date, hour: number, minute: number): boolean {
  if (isDateInAbsence(date)) return false

  const dateStr = date.toISOString().split('T')[0]
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}:00`

  // ⛔ jeśli JEST AKTYWNA konsultacja → slot zajęty
  const hasActiveConsultation = consultations.some(c => {
    return (
      c.consultation_date === dateStr &&
      c.status !== 'CANCELLED' &&
      c.start_time <= timeStr &&
      c.end_time > timeStr
    )
  })

  if (hasActiveConsultation) return false

  // ✅ sprawdzamy dostępność lekarza
  const slots = getAvailableSlotsForDate(date)
  return slots.some(slot => timeStr >= slot.start && timeStr < slot.end)
}


  function getConsultationsForSlot(date: Date, hour: number, minute: number): Consultation[] {
    const dateStr = date.toISOString().split('T')[0]
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`
    
    return consultations.filter(c => {
      if (c.consultation_date !== dateStr) return false
      return c.start_time <= timeStr && c.end_time > timeStr
    })
  }

  function getConsultationHeight(consultation: Consultation): number {
    const [startH, startM] = consultation.start_time.split(':').map(Number)
    const [endH, endM] = consultation.end_time.split(':').map(Number)
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)
    return (durationMinutes / SLOT_DURATION) * SLOT_HEIGHT
  }

  function isConsultationStart(consultation: Consultation, hour: number, minute: number): boolean {
    const [h, m] = consultation.start_time.split(':').map(Number)
    return h === hour && m === minute
  }

  function isPastDateTime(date: Date, hour: number, minute: number): boolean {
    const now = new Date()
    const slotTime = new Date(date)
    slotTime.setHours(hour, minute, 0, 0)
    return slotTime < now
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  function getCurrentTimePosition(): number | null {
    const now = new Date()
    const today = isToday(currentWeekStart) ? currentWeekStart : null
    
    if (!today) {
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + i)
        return d
      })
      const todayInWeek = weekDays.find(d => isToday(d))
      if (!todayInWeek) return null
    }

    const hours = now.getHours()
    const minutes = now.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const firstSlotMinutes = scrollOffset * SLOT_DURATION
    const relativeMinutes = totalMinutes - firstSlotMinutes
    
    if (relativeMinutes < 0 || relativeMinutes > HOURS_TO_SHOW * 60) return null
    
    return (relativeMinutes / SLOT_DURATION) * SLOT_HEIGHT
  }

  function getDayConsultationCount(date: Date): number {
    const dateStr = date.toISOString().split('T')[0]
    return consultations.filter(c => c.consultation_date === dateStr && c.status !== 'CANCELLED').length
  }

  function getConsultationColor(type: string): string {  // ← string zamiast ConsultationType
  const colors: Record<string, string> = {
    FIRST_VISIT: 'bg-indigo-500',
    FOLLOWUP: 'bg-yellow-500',
    CHRONIC_DISEASE: 'bg-purple-500',
    PRESCRIPTION: 'bg-teal-500',
    CONSULTATION: 'bg-blue-500',
    CHECKUP: 'bg-green-500',
    EMERGENCY: 'bg-red-500'
  };
  return colors[type] || 'bg-gray-500';
}

function getConsultationColorBorder(type: string): string {
  const borders: Record<string, string> = {
    FIRST_VISIT: 'border-indigo-600',
    FOLLOWUP: 'border-yellow-600',
    CHRONIC_DISEASE: 'border-purple-600',
    PRESCRIPTION: 'border-teal-600',
    CONSULTATION: 'border-blue-600',
    CHECKUP: 'border-green-600',
    EMERGENCY: 'border-red-600'
  };
  return borders[type] || 'border-gray-600';
}

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const timeSlots = Array.from({ length: HOURS_TO_SHOW * 2 }, (_, i) => {
    const totalMinutes = (scrollOffset + i) * SLOT_DURATION
    const hour = Math.floor(totalMinutes / 60) % 24
    const minute = totalMinutes % 60
    return { hour, minute }
  })

  const currentTimePos = getCurrentTimePosition()

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Ładowanie...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Mój harmonogram</h1>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ← Poprzedni tydzień
            </button>
            <button
              onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Dzisiaj
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Następny tydzień →
            </button>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setScrollOffset(Math.max(0, scrollOffset - 12))}
              disabled={scrollOffset === 0}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              ↑ Wcześniej
            </button>
            <button
              onClick={() => setScrollOffset(Math.min(36, scrollOffset + 12))}
              disabled={scrollOffset >= 36}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              ↓ Później
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Konsultacja</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Badanie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Kontrola</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Nagły wypadek</span>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="grid grid-cols-8 border-b bg-gray-50">
          <div className="p-2 border-r font-semibold text-center">Godzina</div>
          {weekDays.map((date, i) => {
            const inAbsence = isDateInAbsence(date)
            const isTodayDate = isToday(date)
            
            return (
              <div
                key={i}
                className={`p-2 border-r font-semibold text-center ${
                  isTodayDate ? 'bg-blue-100' : ''
                } ${inAbsence ? 'bg-red-100' : ''}`}
              >
                <div>{['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'][date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                <div className="text-sm text-gray-600">
                  {date.getDate()}.{(date.getMonth() + 1).toString().padStart(2, '0')}
                </div>
                {!inAbsence && (
                  <div className="text-xs text-blue-600 mt-1">
                    {getDayConsultationCount(date)} wizyt
                  </div>
                )}
                {inAbsence && (
                  <div className="text-xs text-red-600 mt-1 font-bold">
                    NIEOBECNOŚĆ
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="relative">
          {currentTimePos !== null && (
            <div
              className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
              style={{ top: `${currentTimePos}px` }}
            >
              <div className="absolute -top-2 left-0 w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          )}

          {timeSlots.map((slot, slotIndex) => (
            <div key={slotIndex} className="grid grid-cols-8 border-b">
              <div
                className="p-2 border-r bg-gray-50 text-sm text-center font-medium"
                style={{ height: `${SLOT_HEIGHT}px` }}
              >
                {slot.hour.toString().padStart(2, '0')}:{slot.minute.toString().padStart(2, '0')}
              </div>

              {weekDays.map((date, dayIndex) => {
                const inAbsence = isDateInAbsence(date)
                const available = isSlotAvailable(date, slot.hour, slot.minute)
                const isTodayDate = isToday(date)
                const isPast = isPastDateTime(date, slot.hour, slot.minute)
                const dayConsultations = getConsultationsForSlot(date, slot.hour, slot.minute)

                return (
                  <div
                    key={dayIndex}
                    className={`relative border-r ${
                      isTodayDate ? 'bg-blue-50' : ''
                    } ${inAbsence ? 'bg-red-50' : ''} ${
                      available && !inAbsence ? 'bg-green-50' : ''
                    } ${isPast ? 'opacity-50' : ''}`}
                    style={{ height: `${SLOT_HEIGHT}px` }}
                  >
                    {dayConsultations.map(consultation => {
                      if (!isConsultationStart(consultation, slot.hour, slot.minute)) return null

                      const height = getConsultationHeight(consultation)
                      const isPastConsult = new Date(`${consultation.consultation_date}T${consultation.end_time}`) < new Date()

                      return (
                        <div
                          key={consultation.id}
                          className={`absolute inset-x-1 ${getConsultationColor(
                            consultation.consultation_type
                          )} ${
                            isPastConsult ? 'opacity-40' : ''
                          } text-white p-2 rounded text-xs border-2 ${getConsultationColorBorder(
                            consultation.consultation_type
                          )} cursor-pointer z-20`}
                          style={{ height: `${height - 4}px` }}
                          onMouseEnter={() => setHoveredConsultation(consultation.id)}
                          onMouseLeave={() => setHoveredConsultation(null)}
                        >
                          <div className="font-semibold truncate">
                            {consultation.patient?.full_name || 'Brak pacjenta'}
                          </div>
                          <div className="text-xs opacity-90">
                            {consultation.start_time.slice(0, 5)} - {consultation.end_time.slice(0, 5)}
                          </div>

                          {hoveredConsultation === consultation.id && (
                            <div className="absolute left-full ml-2 top-0 bg-gray-900 text-white p-3 rounded shadow-lg z-30 w-64">
                              <div className="font-bold mb-2">
                                {consultation.patient?.full_name || 'Brak pacjenta'}
                              </div>
                              <div className="text-sm space-y-1">
                                <div>
                                  <strong>Typ:</strong>{' '}
                          {consultation.consultation_type === 'FIRST_VISIT' && 'Pierwsza wizyta'}
                          {consultation.consultation_type === 'FOLLOWUP' && 'Wizyta kontrolna'}
                          {consultation.consultation_type === 'CHRONIC_DISEASE' && 'Choroba przewlekła'}
                          {consultation.consultation_type === 'PRESCRIPTION' && 'Recepta'}
                          {consultation.consultation_type === 'CONSULTATION' && 'Konsultacja'}
                          {consultation.consultation_type === 'CHECKUP' && 'Badanie'}
                          {consultation.consultation_type === 'EMERGENCY' && 'Nagły wypadek'}


                                </div>
                                <div>
                                  <strong>Status:</strong> {consultation.status}
                                </div>
                                {consultation.patient_notes && (
                                  <div>
                                    <strong>Notatki:</strong> {consultation.patient_notes}
                                  </div>
                                )}
                                {consultation.documents && (
                                  <div>
                                    <strong>Dokumenty:</strong> Tak
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}