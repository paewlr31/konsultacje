import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  id: string
  start_date: string
  end_date: string
  reason: string
}

interface Consultation {
  id: string
  consultation_date: string
  start_time: string
  end_time: string
  status: string
  patient_id: string | null
}

export default function ManageSchedule() {
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [absences, setAbsences] = useState<Absence[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'availability' | 'absence'>('availability')

  const [availForm, setAvailForm] = useState({
    isRecurring: false,
    startDate: '',
    endDate: '',
    daysOfWeek: [] as number[],
    specificDate: '',
    timeSlots: [{ start: '08:00', end: '12:00' }] as TimeSlot[]
  })

  const [absenceForm, setAbsenceForm] = useState({
    startDate: '',
    endDate: '',
    reason: ''
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [avail, abs] = await Promise.all([
      supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('doctor_absences')
        .select('*')
        .eq('doctor_id', user.id)
        .order('start_date', { ascending: false })
    ])

    setAvailabilities(avail.data || [])
    setAbsences(abs.data || [])
    setLoading(false)
  }

  function resetAvailForm() {
    setAvailForm({
      isRecurring: false,
      startDate: '',
      endDate: '',
      daysOfWeek: [],
      specificDate: '',
      timeSlots: [{ start: '08:00', end: '12:00' }]
    })
  }

  function resetAbsenceForm() {
    setAbsenceForm({
      startDate: '',
      endDate: '',
      reason: ''
    })
  }

  async function handleAddAvailability(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (availForm.isRecurring) {
      if (!availForm.startDate || !availForm.endDate || availForm.daysOfWeek.length === 0) {
        setError('Wypełnij wszystkie pola dla dostępności cyklicznej')
        return
      }
      if (availForm.startDate > availForm.endDate) {
        setError('Data rozpoczęcia musi być wcześniejsza niż data zakończenia')
        return
      }
    } else {
      if (!availForm.specificDate) {
        setError('Wybierz datę dla dostępności jednorazowej')
        return
      }
    }

    for (const slot of availForm.timeSlots) {
      if (!slot.start || !slot.end) {
        setError('Wypełnij wszystkie przedziały czasowe')
        return
      }
      if (slot.start >= slot.end) {
        setError('Godzina rozpoczęcia musi być wcześniejsza niż godzina zakończenia')
        return
      }
    }

    const overlaps = await checkAvailabilityOverlap()
    if (overlaps) {
      setError('Ta dostępność nakłada się z istniejącą dostępnością lub absencją')
      return
    }

    const payload: any = {
      doctor_id: user.id,
      is_recurring: availForm.isRecurring,
      time_slots: availForm.timeSlots
    }

    if (availForm.isRecurring) {
      payload.start_date = availForm.startDate
      payload.end_date = availForm.endDate
      payload.days_of_week = availForm.daysOfWeek
    } else {
      payload.specific_date = availForm.specificDate
    }

    const { error: insertError } = await supabase
      .from('doctor_availability')
      .insert([payload])

    if (insertError) {
      setError(`Błąd: ${insertError.message}`)
      return
    }

    setSuccess('Dostępność została dodana')
    resetAvailForm()
    loadData()
  }

  async function checkAvailabilityOverlap(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const datesToCheck = availForm.isRecurring
      ? generateDatesFromRecurring(availForm.startDate, availForm.endDate, availForm.daysOfWeek)
      : [availForm.specificDate]

    for (const date of datesToCheck) {
      const { data: abs } = await supabase
        .from('doctor_absences')
        .select('*')
        .eq('doctor_id', user.id)
        .lte('start_date', date)
        .gte('end_date', date)

      if (abs && abs.length > 0) return true

      const dayOfWeek = new Date(date).getDay()
      const { data: avails } = await supabase
        .from('doctor_availability')
        .select('*')
        .eq('doctor_id', user.id)

      if (avails) {
        for (const av of avails) {
          if (av.is_recurring) {
            if (
              av.start_date &&
              av.end_date &&
              date >= av.start_date &&
              date <= av.end_date &&
              av.days_of_week?.includes(dayOfWeek)
            ) {
              if (timeSlotsOverlap(availForm.timeSlots, av.time_slots)) {
                return true
              }
            }
          } else {
            if (av.specific_date === date) {
              if (timeSlotsOverlap(availForm.timeSlots, av.time_slots)) {
                return true
              }
            }
          }
        }
      }
    }

    return false
  }

  function generateDatesFromRecurring(start: string, end: string, daysOfWeek: number[]): string[] {
    const dates: string[] = []
    const current = new Date(start)
    const endDate = new Date(end)

    while (current <= endDate) {
      if (daysOfWeek.includes(current.getDay())) {
        dates.push(current.toISOString().split('T')[0])
      }
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  function timeSlotsOverlap(slots1: TimeSlot[], slots2: TimeSlot[]): boolean {
    for (const s1 of slots1) {
      for (const s2 of slots2) {
        if (s1.start < s2.end && s1.end > s2.start) {
          return true
        }
      }
    }
    return false
  }

  async function handleDeleteAvailability(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę dostępność?')) return

    const { error } = await supabase
      .from('doctor_availability')
      .delete()
      .eq('id', id)

    if (error) {
      setError(`Błąd: ${error.message}`)
      return
    }

    setSuccess('Dostępność została usunięta')
    loadData()
  }

  async function handleAddAbsence(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!absenceForm.startDate || !absenceForm.endDate) {
      setError('Wypełnij wszystkie pola')
      return
    }

    if (absenceForm.startDate > absenceForm.endDate) {
      setError('Data rozpoczęcia musi być wcześniejsza niż data zakończenia')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const conflicts = await checkAbsenceConflicts()
    if (conflicts.length > 0) {
      if (!confirm(`Ta absencja koliduje z ${conflicts.length} zaplanowanymi wizytami. Czy chcesz je odwołać i kontynuować?`)) {
        return
      }

      for (const consultation of conflicts) {
        await supabase
          .from('consultations')
          .update({ status: 'CANCELLED' })
          .eq('id', consultation.id)
      }
    }

    const { error: insertError } = await supabase
      .from('doctor_absences')
      .insert([{
        doctor_id: user.id,
        start_date: absenceForm.startDate,
        end_date: absenceForm.endDate,
        reason: absenceForm.reason
      }])

    if (insertError) {
      setError(`Błąd: ${insertError.message}`)
      return
    }

    setSuccess(
      conflicts.length > 0
        ? `Absencja została dodana. Odwołano ${conflicts.length} wizyt.`
        : 'Absencja została dodana'
    )
    resetAbsenceForm()
    loadData()
  }

  async function checkAbsenceConflicts(): Promise<Consultation[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from('consultations')
      .select('*')
      .eq('doctor_id', user.id)
      .gte('consultation_date', absenceForm.startDate)
      .lte('consultation_date', absenceForm.endDate)
      .neq('status', 'CANCELLED')

    return data || []
  }

  async function handleDeleteAbsence(id: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę absencję?')) return

    const { error } = await supabase
      .from('doctor_absences')
      .delete()
      .eq('id', id)

    if (error) {
      setError(`Błąd: ${error.message}`)
      return
    }

    setSuccess('Absencja została usunięta')
    loadData()
  }

  function toggleDayOfWeek(day: number) {
    setAvailForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day].sort()
    }))
  }

  function addTimeSlot() {
    setAvailForm(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { start: '08:00', end: '12:00' }]
    }))
  }

  function removeTimeSlot(index: number) {
    setAvailForm(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index)
    }))
  }

  function updateTimeSlot(index: number, field: 'start' | 'end', value: string) {
    setAvailForm(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    }))
  }

  const daysOfWeekNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']

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
      <h1 className="text-3xl font-bold mb-6">Zarządzanie harmonogramem</h1>

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

      <div className="mb-6">
        <div className="flex gap-4 border-b">
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'availability'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Dostępność
          </button>
          <button
            onClick={() => setActiveTab('absence')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'absence'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Absencje
          </button>
        </div>
      </div>

      {activeTab === 'availability' && (
        <div>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold mb-4">Dodaj dostępność</h2>

            <form onSubmit={handleAddAvailability}>
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={availForm.isRecurring}
                    onChange={e => {
                      setAvailForm(prev => ({ ...prev, isRecurring: e.target.checked }))
                      setError('')
                    }}
                    className="w-5 h-5"
                  />
                  <span className="font-semibold">Dostępność cykliczna</span>
                </label>
              </div>

              {availForm.isRecurring ? (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block mb-2 font-semibold">Data rozpoczęcia</label>
                      <input
                        type="date"
                        value={availForm.startDate}
                        onChange={e => setAvailForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full p-2 border rounded"
                        required
                      />
                    </div>
                    <div>
                      <label className="block mb-2 font-semibold">Data zakończenia</label>
                      <input
                        type="date"
                        value={availForm.endDate}
                        onChange={e => setAvailForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full p-2 border rounded"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 font-semibold">Dni tygodnia</label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeekNames.map((name, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDayOfWeek(idx)}
                          className={`px-4 py-2 rounded ${
                            availForm.daysOfWeek.includes(idx)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block mb-2 font-semibold">Data</label>
                  <input
                    type="date"
                    value={availForm.specificDate}
                    onChange={e => setAvailForm(prev => ({ ...prev, specificDate: e.target.value }))}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Przedziały czasowe</label>
                {availForm.timeSlots.map((slot, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={e => updateTimeSlot(idx, 'start', e.target.value)}
                      className="p-2 border rounded"
                      required
                    />
                    <span>-</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={e => updateTimeSlot(idx, 'end', e.target.value)}
                      className="p-2 border rounded"
                      required
                    />
                    {availForm.timeSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(idx)}
                        className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTimeSlot}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  + Dodaj przedział
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Dodaj dostępność
                </button>
                <button
                  type="button"
                  onClick={resetAvailForm}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Wyczyść
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Lista dostępności</h2>

            {availabilities.length === 0 ? (
              <p className="text-gray-500">Brak zdefiniowanych dostępności</p>
            ) : (
              <div className="space-y-4">
                {availabilities.map(avail => (
                  <div key={avail.id} className="border rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold mb-2">
                          {avail.is_recurring ? '🔄 Cykliczna' : '📅 Jednorazowa'}
                        </div>
                        {avail.is_recurring ? (
                          <div className="text-sm space-y-1">
                            <div>
                              Od: {avail.start_date} do: {avail.end_date}
                            </div>
                            <div>
                              Dni:{' '}
                              {avail.days_of_week?.map(d => daysOfWeekNames[d]).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm">
                            Data: {avail.specific_date}
                          </div>
                        )}
                        <div className="text-sm mt-2">
                          <strong>Godziny:</strong>
                          <div className="ml-4">
                            {avail.time_slots.map((slot, idx) => (
                              <div key={idx}>
                                {slot.start} - {slot.end}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAvailability(avail.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'absence' && (
        <div>
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold mb-4">Dodaj absencję</h2>

            <form onSubmit={handleAddAbsence}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-semibold">Data rozpoczęcia</label>
                  <input
                    type="date"
                    value={absenceForm.startDate}
                    onChange={e => setAbsenceForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-2 font-semibold">Data zakończenia</label>
                  <input
                    type="date"
                    value={absenceForm.endDate}
                    onChange={e => setAbsenceForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 font-semibold">Powód (opcjonalnie)</label>
                <input
                  type="text"
                  value={absenceForm.reason}
                  onChange={e => setAbsenceForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder="np. urlop, szkolenie..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Dodaj absencję
                </button>
                <button
                  type="button"
                  onClick={resetAbsenceForm}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Wyczyść
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Lista absencji</h2>

            {absences.length === 0 ? (
              <p className="text-gray-500">Brak zaplanowanych absencji</p>
            ) : (
              <div className="space-y-4">
                {absences.map(absence => (
                  <div key={absence.id} className="border rounded p-4 bg-red-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold mb-2">
                          {absence.start_date} - {absence.end_date}
                        </div>
                        {absence.reason && (
                          <div className="text-sm text-gray-700">
                            Powód: {absence.reason}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAbsence(absence.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}