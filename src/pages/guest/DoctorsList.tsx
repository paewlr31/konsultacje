import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

interface Doctor {
  id: string
  full_name: string
  created_at: string
  is_banned: boolean
  doctor_type: string | null
}

export default function DoctorsList() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
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
      console.error("Błąd pobierania lekarzy:", error)
      setError("Nie udało się pobrać listy lekarzy.")
    } else {
      setDoctors(data)
    }
    setLoading(false)
  }

  return (
    <div className="p-8 min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-2">Lista lekarzy</h1>
      <p className="text-lg text-slate-400 mb-6">
        Każdy może zobaczyć listę lekarzy, niezależnie od logowania.
      </p>

      {loading && <p>Ładowanie lekarzy...</p>}
      {error && <p className="text-red-500">{error}</p>}

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {doctors.length === 0 && !loading && <p>Brak dostępnych lekarzy.</p>}
        {doctors.map((doc) => (
          <div
            key={doc.id}
            className="p-6 rounded-xl bg-white shadow hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold">{doc.full_name}</h2>
            {doc.doctor_type && <p className="text-gray-600 mt-1">Specjalizacja: {doc.doctor_type}</p>}
            <p className="text-gray-500 text-sm">Dołączył: {new Date(doc.created_at).toLocaleDateString()}</p>
            {doc.is_banned && <p className="text-red-500 font-medium mt-1">Zablokowany</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
