import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ConsultationType = 'FIRST_VISIT' | 'FOLLOWUP' | 'CHRONIC_DISEASE' | 'PRESCRIPTION'

interface Doctor {
  id: string
  full_name: string
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

interface Absence {
  start_date: string
  end_date: string
}

interface Consultation {
  consultation_date: string
  start_time: string
  end_time: string
  status: string
}

interface SelectedSlot {
  date: Date
  hour: number
  minute: number
}

export default function Schedules() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  const [showBookingForm, setShowBookingForm] = useState(false)

  const [bookingForm, setBookingForm] = useState({
    consultationType: 'FIRST_VISIT' as ConsultationType,
    patientFullName: '',
    patientGender: 'M',
    patientAge: '',
    patientProblem: '',
    documents: null as File[] | null
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const SLOT_HEIGHT = 60
  const HOURS_TO_SHOW = 12

  useEffect(() => {
    loadDoctors()
  }, [])

  useEffect(() => {
    if (selectedDoctor) {
      loadDoctorData()
    }
  }, [selectedDoctor, currentWeekStart])

  async function loadDoctors() {
  setLoading(true)
  setError('')

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'DOCTOR')           // ← najczęściej wystarczy ta linia
      // .eq('role', 'DOCTOR'::user_role)   // ← alternatywa bardziej ścisła
      // .ilike('role::text', 'DOCTOR')     // ← najbezpieczniejsza jeśli coś nie działa
      .order('full_name', { ascending: true })

    if (error) throw error

    console.log('Znalezieni lekarze:', data) // ← debug – koniecznie zostaw na początek

    const doctorsList = data || []

    setDoctors(doctorsList)

    if (doctorsList.length > 0) {
      setSelectedDoctor(doctorsList[0].id)
    } else {
      setError('Nie znaleziono lekarzy w systemie')
    }
  } catch (err: any) {
    console.error('Błąd podczas ładowania listy lekarzy:', err)
    setError('Problem z pobraniem listy lekarzy: ' + (err.message || 'nieznany błąd'))
  } finally {
    setLoading(false)
  }
}

 async function loadDoctorData() {
  if (!selectedDoctor) return

  try {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weekStartStr = currentWeekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    const [avail, abs, consults] = await Promise.all([
      supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', selectedDoctor),

      // 🔥 KLUCZOWA POPRAWKA – WARUNEK NACHODZENIA DAT
      supabase
        .from('doctor_absences')
        .select('*')
        .eq('doctor_id', selectedDoctor)
        .lte('start_date', weekEndStr)   // absencja zaczęła się PRZED końcem tygodnia
        .gte('end_date', weekStartStr),  // absencja kończy się PO początku tygodnia

      supabase
        .from('consultations')
        .select('*')
        .eq('doctor_id', selectedDoctor)
        .gte('consultation_date', weekStartStr)
        .lte('consultation_date', weekEndStr)
        .neq('status', 'CANCELLED')
    ])

    if (avail.error) console.error('Błąd dostępności:', avail.error)
    if (abs.error) console.error('Błąd absencji:', abs.error)
    if (consults.error) console.error('Błąd wizyt:', consults.error)

    console.log('ABSENCJE:', abs.data) // ← DEBUG – MUSI coś wypisać

    setAvailabilities(avail.data || [])
    setAbsences(abs.data || [])
    setConsultations(consults.data || [])
  } catch (err) {
    console.error('Krytyczny błąd w loadDoctorData:', err)
  }
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
    setSelectedSlots([])
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
    
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    const slots = getAvailableSlotsForDate(date)
    
    const inAvailableSlot = slots.some(slot => timeStr >= slot.start && timeStr < slot.end)
    if (!inAvailableSlot) return false

    const dateStr = date.toISOString().split('T')[0]
    const timeWithSeconds = `${timeStr}:00`
    
    const isBooked = consultations.some(c => {
      if (c.consultation_date !== dateStr) return false
      return c.start_time <= timeWithSeconds && c.end_time > timeWithSeconds
    })

    return !isBooked
  }

  function isSlotSelected(date: Date, hour: number, minute: number): boolean {
    return selectedSlots.some(
      s => s.date.toDateString() === date.toDateString() && s.hour === hour && s.minute === minute
    )
  }

  function handleSlotClick(date: Date, hour: number, minute: number) {
    const isPast = isPastDateTime(date, hour, minute)
    if (isPast) return

    if (!isSlotAvailable(date, hour, minute)) return

    const isSelected = isSlotSelected(date, hour, minute)

    if (isSelected) {
      setSelectedSlots(prev => prev.filter(
        s => !(s.date.toDateString() === date.toDateString() && s.hour === hour && s.minute === minute)
      ))
    } else {
      const newSlot = { date, hour, minute }
      
      if (selectedSlots.length === 0) {
        setSelectedSlots([newSlot])
      } else {
        const canAdd = canAddSlot(newSlot)
        if (canAdd) {
          setSelectedSlots(prev => [...prev, newSlot].sort((a, b) => {
            if (a.date.getTime() !== b.date.getTime()) {
              return a.date.getTime() - b.date.getTime()
            }
            const aMinutes = a.hour * 60 + a.minute
            const bMinutes = b.hour * 60 + b.minute
            return aMinutes - bMinutes
          }))
        } else {
          setError('Możesz dodać tylko sąsiednie sloty czasowe!')
          setTimeout(() => setError(''), 3000)
        }
      }
    }
  }

  function canAddSlot(newSlot: SelectedSlot): boolean {
    if (selectedSlots.length === 0) return true

    const allSlots = [...selectedSlots, newSlot].sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) {
        return a.date.getTime() - b.date.getTime()
      }
      const aMinutes = a.hour * 60 + a.minute
      const bMinutes = b.hour * 60 + b.minute
      return aMinutes - bMinutes
    })

    for (let i = 0; i < allSlots.length - 1; i++) {
      const current = allSlots[i]
      const next = allSlots[i + 1]

      if (current.date.toDateString() !== next.date.toDateString()) {
        return false
      }

      const currentMinutes = current.hour * 60 + current.minute
      const nextMinutes = next.hour * 60 + next.minute

      if (nextMinutes - currentMinutes !== 30) {
        return false
      }
    }

    return true
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

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (selectedSlots.length === 0) {
      setError('Wybierz przynajmniej jeden slot czasowy')
      return
    }

    if (!bookingForm.patientFullName || !bookingForm.patientAge) {
      setError('Wypełnij wszystkie wymagane pola')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Musisz być zalogowany')
      return
    }

    const sortedSlots = [...selectedSlots].sort((a, b) => {
      const aMinutes = a.hour * 60 + a.minute
      const bMinutes = b.hour * 60 + b.minute
      return aMinutes - bMinutes
    })

    const firstSlot = sortedSlots[0]
    const lastSlot = sortedSlots[sortedSlots.length - 1]

    const startTime = `${firstSlot.hour.toString().padStart(2, '0')}:${firstSlot.minute.toString().padStart(2, '0')}:00`
    const endHour = lastSlot.hour
    const endMinute = lastSlot.minute + 30
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`

    let documentsJson = null
    if (bookingForm.documents && bookingForm.documents.length > 0) {
      documentsJson = bookingForm.documents.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      }))
    }

    const { error: insertError } = await supabase
      .from('consultations')
      .insert([{
        doctor_id: selectedDoctor,
        patient_id: user.id,
        consultation_date: firstSlot.date.toISOString().split('T')[0],
        start_time: startTime,
        end_time: endTime,
        consultation_type: bookingForm.consultationType,
        status: 'SCHEDULED',
        patient_full_name: bookingForm.patientFullName,
        patient_gender: bookingForm.patientGender,
        patient_age: parseInt(bookingForm.patientAge),
        patient_problem: bookingForm.patientProblem,
        patient_notes: bookingForm.patientProblem,
        documents: documentsJson,
        in_cart: true,
        is_paid: false
      }])

    if (insertError) {
      setError(`Błąd rezerwacji: ${insertError.message}`)
      return
    }

    setSuccess('Konsultacja została dodana do koszyka!')
    setShowBookingForm(false)
    setSelectedSlots([])
    setBookingForm({
      consultationType: 'FIRST_VISIT',
      patientFullName: '',
      patientGender: 'M',
      patientAge: '',
      patientProblem: '',
      documents: null
    })
    loadDoctorData()
  }

  function getConsultationDuration(): number {
    return selectedSlots.length * 0.5
  }

  function getConsultationPrice(): number {
    return selectedSlots.length * 150
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const timeSlots = Array.from({ length: HOURS_TO_SHOW * 2 }, (_, i) => {
    const totalMinutes = (8 * 60) + (i * 30)
    const hour = Math.floor(totalMinutes / 60)
    const minute = totalMinutes % 60
    return { hour, minute }
  })

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
      <h1 className="text-3xl font-bold mb-6">Rezerwacja konsultacji</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <label className="block mb-2 font-semibold">Wybierz lekarza:</label>
        <select
          value={selectedDoctor}
          onChange={e => {
            setSelectedDoctor(e.target.value)
            setSelectedSlots([])
          }}
          className="w-full p-3 border rounded text-lg"
        >
          {doctors.map(doctor => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.full_name}
            </option>
          ))}
        </select>
      </div>

      {selectedSlots.length > 0 && (
        <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-lg">Wybrane sloty: {selectedSlots.length}</p>
              <p className="text-sm text-gray-600">
                Czas trwania: {getConsultationDuration()}h | Cena: {getConsultationPrice()} zł
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedSlots([])}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Wyczyść wybór
              </button>
              <button
                onClick={() => setShowBookingForm(true)}
                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Przejdź do rezerwacji
              </button>
            </div>
          </div>
        </div>
      )}

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
      </div>

      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
          <span>Dostępny slot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-400 border border-blue-600 rounded"></div>
          <span>Wybrany slot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span>Zajęty/niedostępny</span>
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
                {inAbsence && (
                  <div className="text-xs text-red-600 mt-1 font-bold">
                    NIEOBECNOŚĆ
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div>
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
  const selected = isSlotSelected(date, slot.hour, slot.minute)
  const isTodayDate = isToday(date)
  const isPast = isPastDateTime(date, slot.hour, slot.minute)

  return (
    <div
      key={dayIndex}
      // ↓↓↓ Blokujemy klikanie w dniu absencji ↓↓↓
      onClick={() => {
        if (inAbsence) return;           // nic nie robimy
        handleSlotClick(date, slot.hour, slot.minute);
      }}
      className={`relative border-r transition-colors ${
        isTodayDate ? 'bg-blue-50' : ''
      } ${
        // Cała kolumna czerwona przy absencji – najważniejsze
        inAbsence
          ? 'bg-red-50 hover:bg-red-100 cursor-not-allowed'
          : selected
            ? 'bg-blue-400 border-2 border-blue-600'
            : available && !isPast
              ? 'bg-green-200 hover:bg-green-300 cursor-pointer'
              : 'bg-gray-100'
      } ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
      style={{ height: `${SLOT_HEIGHT}px` }}
    >
      {selected && !inAbsence && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
          ✓
        </div>
      )}

      {/* Bardzo czytelny napis w środku komórki – opcjonalny, ale mocno polecany */}
      {inAbsence && (
        <div className="absolute inset-0 flex items-center justify-center text-red-700 text-xs font-bold opacity-70 pointer-events-none">
          LEKARZ NIEOBECNY
        </div>
      )}
    </div>
  )
})}
            </div>
          ))}
        </div>
      </div>

      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Formularz rezerwacji</h2>

            <form onSubmit={handleBooking}>
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <p className="font-semibold">Podsumowanie:</p>
                <p>Czas trwania: {getConsultationDuration()} godziny</p>
                <p>Cena: {getConsultationPrice()} zł</p>
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Typ konsultacji *</label>
                <select
                  value={bookingForm.consultationType}
                  onChange={e => setBookingForm(prev => ({ ...prev, consultationType: e.target.value as ConsultationType }))}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="FIRST_VISIT">Pierwsza wizyta</option>
                  <option value="FOLLOWUP">Wizyta kontrolna</option>
                  <option value="CHRONIC_DISEASE">Choroba przewlekła</option>
                  <option value="PRESCRIPTION">Recepta</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Imię i nazwisko *</label>
                <input
                  type="text"
                  value={bookingForm.patientFullName}
                  onChange={e => setBookingForm(prev => ({ ...prev, patientFullName: e.target.value }))}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-semibold">Płeć *</label>
                  <select
                    value={bookingForm.patientGender}
                    onChange={e => setBookingForm(prev => ({ ...prev, patientGender: e.target.value }))}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="M">Mężczyzna</option>
                    <option value="F">Kobieta</option>
                    <option value="OTHER">Inna</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-semibold">Wiek *</label>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    value={bookingForm.patientAge}
                    onChange={e => setBookingForm(prev => ({ ...prev, patientAge: e.target.value }))}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Informacje dla lekarza (opis problemu, objawy)</label>
                <textarea
                  value={bookingForm.patientProblem}
                  onChange={e => setBookingForm(prev => ({ ...prev, patientProblem: e.target.value }))}
                  className="w-full p-2 border rounded h-32"
                  placeholder="Opisz swoje dolegliwości, objawy..."
                />
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Dokumenty (wyniki badań, wypisy, skierowania)</label>
                <input
                  type="file"
                  multiple
                  onChange={e => setBookingForm(prev => ({ ...prev, documents: e.target.files ? Array.from(e.target.files) : null }))}
                  className="w-full p-2 border rounded"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                {bookingForm.documents && (
                  <div className="mt-2 text-sm text-gray-600">
                    Wybrane pliki: {bookingForm.documents.length}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Dodaj do koszyka
                </button>
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}