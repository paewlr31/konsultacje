import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ConsultationType = 'FIRST_VISIT' | 'FOLLOWUP' | 'CHRONIC_DISEASE' | 'PRESCRIPTION' | 'CONSULTATION' | 'CHECKUP' | 'EMERGENCY'

interface Consultation {
  id: string
  doctor_id: string
  consultation_date: string
  start_time: string
  end_time: string
  consultation_type: ConsultationType
  status: string
  patient_full_name: string
  patient_gender: string
  patient_age: number
  patient_problem: string
  patient_notes: string
  documents: any
  price: number
  is_paid: boolean
  in_cart: boolean
  created_at: string
  doctor?: {
    full_name: string
  }
}

export default function MyAppointments() {
  const [cartItems, setCartItems] = useState<Consultation[]>([])
  const [paidAppointments, setPaidAppointments] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<'cart' | 'appointments'>('cart')
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [cart, paid] = await Promise.all([
      supabase
        .from('consultations')
        .select('*, doctor:profiles!consultations_doctor_id_fkey(full_name)')
        .eq('patient_id', user.id)
        .eq('in_cart', true)
        .eq('is_paid', false)
        .neq('status', 'CANCELLED')
        .order('consultation_date')
        .order('start_time'),
      supabase
        .from('consultations')
        .select('*, doctor:profiles!consultations_doctor_id_fkey(full_name)')
        .eq('patient_id', user.id)
        .or('is_paid.eq.true,status.eq.CANCELLED')
        .order('consultation_date', { ascending: false })
        .order('start_time', { ascending: false })
    ])

    setCartItems(cart.data || [])
    setPaidAppointments(paid.data || [])
    setLoading(false)
  }

  async function handleRemoveFromCart(consultationId: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę konsultację z koszyka?')) return

    setError('')
    setSuccess('')

    const { error: deleteError } = await supabase
      .from('consultations')
      .delete()
      .eq('id', consultationId)

    if (deleteError) {
      setError(`Błąd: ${deleteError.message}`)
      return
    }

    setSuccess('Konsultacja została usunięta z koszyka')
    loadData()
  }

  async function handleCancelAppointment(consultationId: string) {
    if (!confirm('Czy na pewno chcesz odwołać tę wizytę?')) return

    setError('')
    setSuccess('')

    const { error: updateError } = await supabase
      .from('consultations')
      .update({ status: 'CANCELLED' })
      .eq('id', consultationId)

    if (updateError) {
      setError(`Błąd: ${updateError.message}`)
      return
    }

    setSuccess('Wizyta została odwołana. Slot jest teraz dostępny dla innych pacjentów.')
    loadData()
  }

  async function handlePayment() {
  setError('')
  setSuccess('')

  if (cartItems.length === 0) {
    setError('Koszyk jest pusty')
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    setError('Brak zalogowanego użytkownika')
    return
  }

  // Pobieramy tylko ID wszystkich pozycji w koszyku
  const consultationIds = cartItems.map(item => item.id)

  const { error: updateError } = await supabase
    .from('consultations')
    .update({
      is_paid: true,
      in_cart: false,
      status: 'SCHEDULED'
      // NIE MUSISZ przekazywać nic więcej!
    })
    .in('id', consultationIds)                  // ← aktualizacja wielu rekordów naraz
    .eq('patient_id', user.id)                   // dodatkowe zabezpieczenie – tylko własne rekordy

  if (updateError) {
    console.error('Błąd płatności:', updateError)
    setError(`Błąd płatności: ${updateError.message}`)
    return
  }

  setSuccess(`Płatność zakończona! Opłacono ${cartItems.length} konsultacji.`)
  setShowPaymentModal(false)
  setActiveTab('appointments')
  loadData()
}

  function getConsultationTypeLabel(type: ConsultationType): string {
    const labels: Record<ConsultationType, string> = {
      FIRST_VISIT: 'Pierwsza wizyta',
      FOLLOWUP: 'Wizyta kontrolna',
      CHRONIC_DISEASE: 'Choroba przewlekła',
      PRESCRIPTION: 'Recepta',
      CONSULTATION: 'Konsultacja',
      CHECKUP: 'Badanie',
      EMERGENCY: 'Nagły wypadek'
    }
    return labels[type] || type
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      SCHEDULED: 'Zaplanowana',
      CANCELLED: 'Odwołana',
      COMPLETED: 'Zakończona'
    }
    return labels[status] || status
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      SCHEDULED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      COMPLETED: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function formatTime(timeStr: string): string {
    return timeStr.slice(0, 5)
  }

  function calculateDuration(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    return ((endH * 60 + endM) - (startH * 60 + startM)) / 60
  }

  function getTotalCartPrice(): number {
    return cartItems.reduce((sum, item) => sum + (item.price || 0), 0)
  }

  function isPastAppointment(consultation: Consultation): boolean {
    const now = new Date()
    const appointmentTime = new Date(`${consultation.consultation_date}T${consultation.end_time}`)
    return appointmentTime < now
  }

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
      <h1 className="text-3xl font-bold mb-6">Moje wizyty</h1>

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
            onClick={() => setActiveTab('cart')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'cart'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Koszyk ({cartItems.length})
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-6 py-3 font-semibold ${
              activeTab === 'appointments'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            Moje wizyty ({paidAppointments.length})
          </button>
        </div>
      </div>

      {activeTab === 'cart' && (
        <div>
          {cartItems.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <p className="text-xl text-gray-500 mb-4">Koszyk jest pusty</p>
              <p className="text-gray-400">Dodaj konsultacje z harmonogramu lekarzy</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-lg mb-6 flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">
                    Liczba konsultacji w koszyku: {cartItems.length}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    Łączna cena: {getTotalCartPrice().toFixed(2)} zł
                  </p>
                </div>
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-lg font-semibold"
                >
                  Przejdź do płatności
                </button>
              </div>

              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold">{item.doctor?.full_name}</h3>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {getConsultationTypeLabel(item.consultation_type)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Data</p>
                            <p className="font-semibold">{formatDate(item.consultation_date)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Godzina</p>
                            <p className="font-semibold">
                              {formatTime(item.start_time)} - {formatTime(item.end_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Czas trwania</p>
                            <p className="font-semibold">
                              {calculateDuration(item.start_time, item.end_time)} godz.
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Cena</p>
                            <p className="font-semibold text-lg text-green-600">
                              {item.price.toFixed(2)} zł
                            </p>
                          </div>
                        </div>

                        {item.patient_problem && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-600">Informacje dla lekarza</p>
                            <p className="text-sm bg-gray-50 p-2 rounded">{item.patient_problem}</p>
                          </div>
                        )}

                        {item.documents && (
                          <div>
                            <p className="text-sm text-gray-600">
                              📎 Załączono dokumenty: {item.documents.length}
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'appointments' && (
        <div>
          {paidAppointments.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <p className="text-xl text-gray-500 mb-4">Brak wizyt</p>
              <p className="text-gray-400">Zarezerwowane i opłacone wizyty pojawią się tutaj</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paidAppointments.map(item => {
                const isPast = isPastAppointment(item)
                const isCancelled = item.status === 'CANCELLED'

                return (
                  <div
                    key={item.id}
                    className={`bg-white p-6 rounded-lg shadow border-l-4 ${
                      isCancelled
                        ? 'border-red-500 opacity-60'
                        : isPast
                        ? 'border-gray-400 opacity-75'
                        : 'border-green-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold">{item.doctor?.full_name}</h3>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                            {getConsultationTypeLabel(item.consultation_type)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          {isPast && !isCancelled && (
                            <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                              Przeszła
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Data</p>
                            <p className="font-semibold">{formatDate(item.consultation_date)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Godzina</p>
                            <p className="font-semibold">
                              {formatTime(item.start_time)} - {formatTime(item.end_time)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Czas trwania</p>
                            <p className="font-semibold">
                              {calculateDuration(item.start_time, item.end_time)} godz.
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Cena zapłacona</p>
                            <p className="font-semibold text-lg text-green-600">
                              {item.price.toFixed(2)} zł
                            </p>
                          </div>
                        </div>

                        {item.patient_problem && (
                          <div className="mb-3">
                            <p className="text-sm text-gray-600">Informacje dla lekarza</p>
                            <p className="text-sm bg-gray-50 p-2 rounded">{item.patient_problem}</p>
                          </div>
                        )}

                        {item.documents && (
                          <div>
                            <p className="text-sm text-gray-600">
                              📎 Załączono dokumenty: {item.documents.length}
                            </p>
                          </div>
                        )}
                      </div>

                      {!isCancelled && !isPast && (
                        <button
                          onClick={() => handleCancelAppointment(item.id)}
                          className="ml-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Odwołaj wizytę
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Potwierdzenie płatności</h2>

            <div className="mb-6">
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600 mb-2">Liczba konsultacji:</p>
                <p className="text-2xl font-bold">{cartItems.length}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Łączna kwota do zapłaty:</p>
                <p className="text-3xl font-bold text-blue-600">
                  {getTotalCartPrice().toFixed(2)} zł
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                To jest symulacja płatności. Po kliknięciu "Potwierdź płatność" wszystkie
                konsultacje z koszyka zostaną oznaczone jako opłacone i potwierdzone.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePayment}
                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                Potwierdź płatność
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}