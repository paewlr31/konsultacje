import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

interface Doctor {
  id: string
  full_name: string
  created_at: string
  is_banned: boolean
  doctor_type: string | null
}

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
}

export default function DoctorsList() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)

  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [reviewsCount, setReviewsCount] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, created_at, is_banned, doctor_type")
      .eq("role", "DOCTOR")
      .order("full_name", { ascending: true })

    if (error) {
      console.error(error)
      setError("Nie udało się pobrać listy lekarzy.")
    } else {
      setDoctors(data)
    }
    setLoading(false)
  }

  const fetchDoctorReviews = async (doctor: Doctor) => {
    setSelectedDoctor(doctor)
    setLoading(true)

    const { data, error } = await supabase
      .from("consultation_reviews")
      .select("id, rating, comment, created_at")
      .eq("doctor_id", doctor.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setError("Nie udało się pobrać opinii.")
      setLoading(false)
      return
    }

    setReviews(data)
    setReviewsCount(data.length)

    if (data.length > 0) {
      const avg =
        data.reduce((sum, r) => sum + r.rating, 0) / data.length
      setAvgRating(Number(avg.toFixed(1)))
    } else {
      setAvgRating(null)
    }

    setLoading(false)
  }

  const handleBack = () => {
    setSelectedDoctor(null)
    setReviews([])
    setAvgRating(null)
    setReviewsCount(0)
  }

  // ===============================
  // 🔙 SZCZEGÓŁY LEKARZA
  // ===============================
  if (selectedDoctor) {
    return (
      <div className="p-8 min-h-screen bg-slate-50">
        <button
          onClick={handleBack}
          className="mb-6 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          ← Wróć do listy lekarzy
        </button>

        <div className="bg-white p-6 rounded-xl shadow">
          <h1 className="text-3xl font-bold">
            {selectedDoctor.full_name}
          </h1>

          {selectedDoctor.doctor_type && (
            <p className="text-gray-600 mt-1">
              Specjalizacja: {selectedDoctor.doctor_type}
            </p>
          )}

          <p className="text-gray-500 text-sm mt-1">
            Dołączył:{" "}
            {new Date(selectedDoctor.created_at).toLocaleDateString()}
          </p>

          {selectedDoctor.is_banned && (
            <p className="text-red-500 font-medium mt-2">
              Konto zablokowane
            </p>
          )}

          <div className="mt-6 border-t pt-4">
            <h2 className="text-2xl font-semibold mb-2">
              Opinie pacjentów
            </h2>

            <p className="text-lg">
              ⭐ Średnia ocena:{" "}
              <span className="font-bold">
                {avgRating ?? "Brak ocen"}
              </span>
            </p>

            <p className="text-gray-500 mb-4">
              Liczba opinii: {reviewsCount}
            </p>

            {loading && <p>Ładowanie opinii...</p>}

            {!loading && reviews.length === 0 && (
              <p className="text-gray-500">
                Ten lekarz nie ma jeszcze opinii.
              </p>
            )}

            <div className="space-y-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 border rounded-lg bg-slate-50"
                >
                  <p className="font-semibold">
                    Ocena: ⭐ {rev.rating}/5
                  </p>

                  {rev.comment && (
                    <p className="mt-1">{rev.comment}</p>
                  )}

                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(rev.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===============================
  // 📋 LISTA LEKARZY
  // ===============================
  return (
    <div className="p-8 min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-2">Lista lekarzy</h1>
      <p className="text-lg text-slate-400 mb-6">
        Każdy może zobaczyć listę lekarzy, niezależnie od logowania.
      </p>

      {loading && <p>Ładowanie lekarzy...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {doctors.length === 0 && !loading && (
          <p>Brak dostępnych lekarzy.</p>
        )}

        {doctors.map((doc) => (
          <div
            key={doc.id}
            onClick={() => fetchDoctorReviews(doc)}
            className="p-6 rounded-xl bg-white shadow hover:shadow-lg transition cursor-pointer"
          >
            <h2 className="text-xl font-semibold">{doc.full_name}</h2>

            {doc.doctor_type && (
              <p className="text-gray-600 mt-1">
                Specjalizacja: {doc.doctor_type}
              </p>
            )}

            <p className="text-gray-500 text-sm">
              Dołączył:{" "}
              {new Date(doc.created_at).toLocaleDateString()}
            </p>

            {doc.is_banned && (
              <p className="text-red-500 font-medium mt-1">
                Zablokowany
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
