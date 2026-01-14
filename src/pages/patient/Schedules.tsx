import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

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
  id: string
  consultation_date: string
  start_time: string
  end_time: string
  status: string
  consultation_type: ConsultationType
  patient_id: string
}

interface SelectedSlot {
  date: Date
  hour: number
  minute: number
}

interface Notification {
  id: string
  message: string
  timestamp: string
  doctorName: string
}

interface ConsultationReview {
  id: string
  consultation_id: string
  rating: number
  comment: string
  created_at: string
}

export default function Schedules() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()))
  const [currentTimeStart, setCurrentTimeStart] = useState<number>(6) // Początkowa godzina widoku (00:00)
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [reviews, setReviews] = useState<ConsultationReview[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([])
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isBanned, setIsBanned] = useState<boolean>(false)

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

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Stan dla modalnego okna z oceną
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    comment: ''
  })

  

  const SLOT_HEIGHT = 60
  const HOURS_TO_SHOW = 6 // Pokazujemy 6 godzin na raz

  useEffect(() => {
    loadCurrentUser()
    loadDoctors()
  }, [])

  useEffect(() => {
    if (selectedDoctor) {
      loadDoctorData()
    }
  }, [selectedDoctor, currentWeekStart])

async function loadCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    setCurrentUserId(user.id)

    // ← tutaj poprawne miejsce
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error("Błąd pobierania profilu:", error)
      return
    }

    if (profile) {
      setIsBanned(!!profile.is_banned)
    }
  }
}

  useEffect(() => {
    let channel: RealtimeChannel

    const setupRealtimeSubscription = async () => {
      channel = supabase.channel('schedule-updates')

      channel
        .on('broadcast', { event: 'schedule-change' }, (payload) => {
          const { doctor_id, doctor_name, message, timestamp } = payload.payload

          if (doctor_id === selectedDoctor) {
            const newNotification: Notification = {
              id: Date.now().toString(),
              message: message,
              timestamp: timestamp,
              doctorName: doctor_name || 'Nieznany lekarz'
            }

            setNotifications(prev => [newNotification, ...prev].slice(0, 10))
            setShowNotifications(true)
            loadDoctorData()
          }
        })
        .subscribe()
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedDoctor])

  async function loadDoctors() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'DOCTOR')
        .order('full_name', { ascending: true })

      if (error) throw error

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
    if (!selectedDoctor || !currentUserId) return

    try {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekStartStr = currentWeekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const [avail, abs, consults, reviewsData] = await Promise.all([
        supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', selectedDoctor),

        supabase
          .from('doctor_absences')
          .select('*')
          .eq('doctor_id', selectedDoctor)
          .lte('start_date', weekEndStr)
          .gte('end_date', weekStartStr),

        supabase
          .from('consultations')
          .select('*')
          .eq('doctor_id', selectedDoctor)
          .eq('patient_id', currentUserId) // Tylko konsultacje zalogowanego pacjenta
          .gte('consultation_date', weekStartStr)
          .lte('consultation_date', weekEndStr)
          .neq('status', 'CANCELLED'),

        supabase
          .from('consultation_reviews')
          .select('*')
          .eq('patient_id', currentUserId)
      ])

      if (avail.error) console.error('Błąd dostępności:', avail.error)
      if (abs.error) console.error('Błąd absencji:', abs.error)
      if (consults.error) console.error('Błąd wizyt:', consults.error)
      if (reviewsData.error) console.error('Błąd opinii:', reviewsData.error)

      setAvailabilities(avail.data || [])
      setAbsences(abs.data || [])
      setConsultations(consults.data || [])
      setReviews(reviewsData.data || [])
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

  function navigateTime(direction: number) {
    const newStart = currentTimeStart + direction * HOURS_TO_SHOW
    if (newStart >= 0 && newStart <= 24 - HOURS_TO_SHOW) {
      setCurrentTimeStart(newStart)
    }
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

  function getConsultationAtSlot(date: Date, hour: number, minute: number): Consultation | null {
    const dateStr = date.toISOString().split('T')[0]
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`
    
    return consultations.find(c => {
      if (c.consultation_date !== dateStr) return false
      return c.start_time <= timeStr && c.end_time > timeStr
    }) || null
  }

  function isConsultationPast(consultation: Consultation): boolean {
    const consultDate = new Date(consultation.consultation_date + 'T' + consultation.end_time)
    return consultDate < new Date()
  }

  function hasReview(consultationId: string): boolean {
    return reviews.some(r => r.consultation_id === consultationId)
  }

  function isSlotSelected(date: Date, hour: number, minute: number): boolean {
    return selectedSlots.some(
      s => s.date.toDateString() === date.toDateString() && s.hour === hour && s.minute === minute
    )
  }

  function handleSlotClick(date: Date, hour: number, minute: number) {
    // Sprawdź czy to konsultacja pacjenta
    const consultation = getConsultationAtSlot(date, hour, minute)
    
    if (consultation && consultation.patient_id === currentUserId) {
      // Jeśli konsultacja się odbyła, pokaż modal z oceną
      if (isConsultationPast(consultation)) {
        setSelectedConsultation(consultation)
        setShowReviewModal(true)
        
        // Załaduj istniejącą opinię jeśli jest
        const existingReview = reviews.find(r => r.consultation_id === consultation.id)
        if (existingReview) {
          setReviewForm({
            rating: existingReview.rating,
            comment: existingReview.comment || ''
          })
        } else {
          setReviewForm({
            rating: 5,
            comment: ''
          })
        }
        return
      }
    }

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
  let endHour = lastSlot.hour
  let endMinute = lastSlot.minute + 30
  if (endMinute >= 60) {
    endMinute = 0
    endHour += 1
  }
  const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`

  try {
    // 1️⃣ Wstawiamy konsultację w bazie
    const { data: insertedData, error: insertError } = await supabase
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
        in_cart: true,
        is_paid: false
      }])
      .select() // ważne, aby otrzymać id wstawionej konsultacji

    if (insertError || !insertedData || insertedData.length === 0) {
      setError(`Błąd rezerwacji: ${insertError?.message || 'nieznany błąd'}`)
      return
    }

    const consultationId = insertedData[0].id

    // 2️⃣ Upload dokumentów do Storage jeśli są
    if (bookingForm.documents && bookingForm.documents.length > 0) {
      const uploadedDocs = []

      for (const file of bookingForm.documents) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${file.name}`
       const filePath = `${user.id}/consultations/${consultationId}/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('consultation-documents')
          .upload(filePath, file)

        if (uploadError) {
          console.error('Błąd uploadu pliku', file.name, uploadError)
          setError(`Nie udało się przesłać pliku: ${file.name}`)
          continue
        }

        uploadedDocs.push({
          name: file.name,
          path: data?.path || filePath,
          type: file.type,
          size: file.size
        })
      }

      // 3️⃣ Zapisujemy info o dokumentach w kolumnie `documents` konsultacji
      const { error: updateError } = await supabase
        .from('consultations')
        .update({ documents: uploadedDocs })
        .eq('id', consultationId)

      if (updateError) {
        console.error('Błąd zapisu dokumentów w DB', updateError)
        setError('Konsultacja została utworzona, ale dokumenty nie zostały zapisane poprawnie')
      }
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
  } catch (err: any) {
    console.error('Błąd podczas rezerwacji:', err)
    setError(err.message || 'Nieznany błąd')
  }
}


  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedConsultation) return

    setError('')
    setSuccess('')

    // Sprawdź czy opinia już istnieje
    const existingReview = reviews.find(r => r.consultation_id === selectedConsultation.id)

    try {
      if (existingReview) {
        // Aktualizuj istniejącą opinię
        const { error: updateError } = await supabase
          .from('consultation_reviews')
          .update({
            rating: reviewForm.rating,
            comment: reviewForm.comment
          })
          .eq('id', existingReview.id)

        if (updateError) throw updateError

        setSuccess('Opinia została zaktualizowana!')
      } else {
        // Dodaj nową opinię
        const { error: insertError } = await supabase
          .from('consultation_reviews')
          .insert([{
            consultation_id: selectedConsultation.id,
            patient_id: currentUserId,
            doctor_id: selectedDoctor,
            rating: reviewForm.rating,
            comment: reviewForm.comment
          }])

        if (insertError) throw insertError

        setSuccess('Opinia została dodana!')
      }

      // Odśwież dane
      await loadDoctorData()
      
      // Zamknij modal po 2 sekundach
      setTimeout(() => {
        setShowReviewModal(false)
        setSelectedConsultation(null)
        setSuccess('')
      }, 2000)

    } catch (err: any) {
      console.error('Błąd podczas zapisywania opinii:', err)
      setError('Nie udało się zapisać opinii: ' + (err.message || 'nieznany błąd'))
    }
  }

  function getConsultationDuration(): number {
    return selectedSlots.length * 0.5
  }

  function getConsultationPrice(): number {
    return selectedSlots.length * 150
  }

  function getConsultationTypeLabel(type: ConsultationType): string {
    const labels: Record<ConsultationType, string> = {
      'FIRST_VISIT': 'Pierwsza wizyta',
      'FOLLOWUP': 'Wizyta kontrolna',
      'CHRONIC_DISEASE': 'Choroba przewlekła',
      'PRESCRIPTION': 'Recepta'
    }
    return labels[type] || type
  }

  function getConsultationTypeColor(type: ConsultationType): string {
    const colors: Record<ConsultationType, string> = {
      'FIRST_VISIT': 'bg-yellow-400',
      'FOLLOWUP': 'bg-blue-400',
      'CHRONIC_DISEASE': 'bg-purple-400',
      'PRESCRIPTION': 'bg-green-400'
    }
    return colors[type] || 'bg-gray-400'
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const timeSlots = Array.from({ length: HOURS_TO_SHOW * 2 }, (_, i) => {
    const totalMinutes = (currentTimeStart * 60) + (i * 30)
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
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold">Rezerwacja konsultacji</h1>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          >
            🔔 Powiadomienia
            {notifications.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold">Powiadomienia</h3>
                <button
                  onClick={() => setNotifications([])}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Wyczyść wszystkie
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Brak nowych powiadomień
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded">
                          {notif.doctorName}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notif.timestamp).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
        
        {/* Przyciski nawigacji czasu */}
        <div className="flex gap-2">
          <button
            onClick={() => navigateTime(-1)}
            disabled={currentTimeStart === 0}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ↑ Wcześniej
          </button>
          <span className="px-4 py-2 bg-gray-100 rounded font-semibold">
            {currentTimeStart.toString().padStart(2, '0')}:00 - {(currentTimeStart + HOURS_TO_SHOW).toString().padStart(2, '0')}:00
          </span>
          <button
            onClick={() => navigateTime(1)}
            disabled={currentTimeStart >= 24 - HOURS_TO_SHOW}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ↓ Później
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
          <div className="w-4 h-4 bg-yellow-400 rounded"></div>
          <span>Twoja konsultacja</span>
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
                const consultation = getConsultationAtSlot(date, slot.hour, slot.minute)
                const isMyConsultation = consultation && consultation.patient_id === currentUserId
                const isPastConsultation = consultation && isConsultationPast(consultation)
                const consultationHasReview = consultation && hasReview(consultation.id)

                let bgColor = 'bg-gray-100'
                let hoverClass = ''
                let cursorClass = ''

                if (inAbsence) {
                  bgColor = 'bg-red-50'
                  hoverClass = 'hover:bg-red-100'
                  cursorClass = 'cursor-not-allowed'
                } else if (isMyConsultation) {
                  // Konsultacja pacjenta - kolor zależy od typu
                  const typeColor = getConsultationTypeColor(consultation.consultation_type)
                  bgColor = typeColor
                  if (isPastConsultation) {
                    bgColor += ' opacity-60' // Wyszarzona (zmniejszona nieprzezroczystość)
                    cursorClass = 'cursor-pointer'
                    hoverClass = 'hover:opacity-80'
                  }
                } else if (selected) {
                  bgColor = 'bg-blue-400 border-2 border-blue-600'
                } else if (available && !isPast) {
                  bgColor = 'bg-green-200'
                  hoverClass = 'hover:bg-green-300'
                  cursorClass = 'cursor-pointer'
                } else if (isPast) {
                  bgColor = 'bg-gray-100 opacity-50'
                  cursorClass = 'cursor-not-allowed'
                }

                if (isTodayDate && !isMyConsultation && !selected) {
                  bgColor = bgColor.replace('bg-', 'bg-blue-50 ')
                }
                

                return (
                  <div
                    key={dayIndex}
                    onClick={() => handleSlotClick(date, slot.hour, slot.minute)}
                    className={`relative border-r transition-all ${bgColor} ${hoverClass} ${cursorClass}`}
                    style={{ height: `${SLOT_HEIGHT}px` }}
                  >
                    {selected && !inAbsence && !isMyConsultation && (
                      <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
                        ✓
                      </div>
                    )}

                    {isMyConsultation && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs font-bold p-1">
                        <div>{getConsultationTypeLabel(consultation.consultation_type)}</div>
                        <div className="text-[10px] mt-1">
                          {consultation.start_time.slice(0, 5)} - {consultation.end_time.slice(0, 5)}
                        </div>
                        {isPastConsultation && (
                          <div className="text-[10px] mt-1 bg-black bg-opacity-30 px-1 rounded">
                            {consultationHasReview ? '⭐ Oceniono' : '👆 Kliknij aby ocenić'}
                          </div>
                        )}
                      </div>
                    )}

                    {inAbsence && !isMyConsultation && (
                      <div className="absolute inset-0 flex items-center justify-center text-red-700 text-xs font-bold opacity-70 pointer-events-none">
                        NIEOBECNY
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Modal rezerwacji */}
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
  <label className="block mb-2 font-semibold">
    Dokumenty (wyniki badań, wypisy, skierowania)
  </label>
  <input
    type="file"
    multiple
    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
    onChange={(e) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      const maxSizeMB = 10

      // Walidacja typów i rozmiaru
      const validFiles: File[] = []
      const errors: string[] = []

      files.forEach(file => {
        if (!['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
          errors.push(`${file.name} - niedozwolony typ pliku`)
        } else if (file.size > maxSizeMB * 1024 * 1024) {
          errors.push(`${file.name} - plik za duży (max ${maxSizeMB}MB)`)
        } else {
          validFiles.push(file)
        }
      })

      if (errors.length > 0) alert(errors.join('\n'))

      setBookingForm(prev => ({
        ...prev,
        documents: prev.documents ? [...prev.documents, ...validFiles] : validFiles
      }))

      // Wyczyść input, aby można było dodać te same pliki ponownie
      e.target.value = ''
    }}
    className="w-full p-2 border rounded"
  />

  {bookingForm.documents && bookingForm.documents.length > 0 && (
    <div className="mt-2 text-sm text-gray-600">
      <p>Wybrane pliki ({bookingForm.documents.length}):</p>
      <ul className="mt-1">
        {bookingForm.documents.map((file, idx) => (
          <li key={idx} className="flex items-center justify-between mt-1">
            <span>{file.name}</span>
            <button
              type="button"
              className="text-red-500 ml-2 hover:underline"
              onClick={() => {
                setBookingForm(prev => ({
                  ...prev,
                  documents: prev.documents?.filter((_, i) => i !== idx) || null
                }))
              }}
            >
              Usuń
            </button>
          </li>
        ))}
      </ul>
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

      {/* Modal oceny konsultacji */}
{showReviewModal && selectedConsultation && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg p-6 max-w-lg w-full relative">

      {/* krzyżyk zamykania – warto mieć zawsze */}
      <button
        onClick={() => {
          setShowReviewModal(false)
          setSelectedConsultation(null)
          setError('')
          setSuccess('')
        }}
        className="absolute top-3 right-4 text-gray-500 hover:text-gray-700 text-2xl"
      >
        ×
      </button>

      <h2 className="text-2xl font-bold mb-4">
        {hasReview(selectedConsultation.id) ? 'Edytuj opinię' : 'Oceń konsultację'}
      </h2>

      {isBanned ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded text-red-800 mb-6">
          <p className="font-semibold text-lg mb-2">Twoje konto jest zablokowane</p>
          <p className="text-sm">
            Nie możesz obecnie dodawać ani edytować opinii.
          </p>
        </div>
      ) : (
        <>
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-4 p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">Data:</p>
            <p className="font-semibold">{selectedConsultation.consultation_date}</p>
            <p className="text-sm text-gray-600 mt-2">Godzina:</p>
            <p className="font-semibold">
              {selectedConsultation.start_time.slice(0, 5)} - {selectedConsultation.end_time.slice(0, 5)}
            </p>
            <p className="text-sm text-gray-600 mt-2">Typ:</p>
            <p className="font-semibold">{getConsultationTypeLabel(selectedConsultation.consultation_type)}</p>
          </div>

          <form onSubmit={handleSubmitReview}>
            <div className="mb-4">
              <label className="block mb-2 font-semibold">Ocena *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setReviewForm(prev => ({ ...prev, rating }))}
                    className={`text-3xl transition-all ${
                      rating <= reviewForm.rating
                        ? 'text-yellow-400 scale-110'
                        : 'text-gray-300'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {reviewForm.rating === 1 && 'Bardzo źle'}
                {reviewForm.rating === 2 && 'Źle'}
                {reviewForm.rating === 3 && 'Średnio'}
                {reviewForm.rating === 4 && 'Dobrze'}
                {reviewForm.rating === 5 && 'Doskonale'}
              </p>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-semibold">Opinia (opcjonalnie)</label>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                className="w-full p-3 border rounded h-32"
                placeholder="Podziel się swoją opinią o konsultacji..."
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                {hasReview(selectedConsultation.id) ? 'Zaktualizuj opinię' : 'Dodaj opinię'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedConsultation(null)
                  setError('')
                  setSuccess('')
                }}
                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Anuluj
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  </div>
)}
    </div>
  )
}