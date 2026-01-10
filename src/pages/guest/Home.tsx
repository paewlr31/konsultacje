import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Pobranie sesji
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchRole(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else {
        setRole(null)
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (data?.role) setRole(data.role)
    setLoading(false)
  }

  if (loading) return <p className="text-center mt-20">Ładowanie...</p>

  if (!session) return <GuestHome />
  if (role === "PATIENT") return <PatientHome />
  if (role === "DOCTOR") return <DoctorHome />
  if (role === "ADMIN") return <AdminHome />

  return <GuestHome />
}

/* -------------------------- KOMONENTY DLA KAŻDEJ ROLI -------------------------- */

function GuestHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Hero
        title="Twoja wizyta u specjalisty"
        subtitle="szybciej niż kiedykolwiek"
        description="Bez kolejek telefonicznych. Bez stresu. Najlepsi lekarze w Twoim mieście – terminy nawet na dziś."
        primaryCTA={{ text: "Umów wizytę teraz", href: "/rezerwacja" }}
        secondaryCTA={{ text: "Zobacz specjalistów →", href: "/doctors" }}
      />
      <Stats stats={[
        { value: "+2400", label: "Lekarzy w systemie", color: "blue-600" },
        { value: "98%", label: "Pacjentów poleca", color: "indigo-600" },
        { value: "~14 min", label: "Średni czas rezerwacji", color: "blue-600" },
      ]} />
      <CTASection cta={{ text: "Zarezerwuj termin", href: "/rezerwacja" }} />
    </div>
  )
}

function PatientHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <Hero
        title="Twoje wizyty w jednym miejscu"
        subtitle="zarządzaj terminami łatwo i szybko"
        description="Sprawdź swoje nadchodzące wizyty i umów nowe wizyty u najlepszych specjalistów."
        primaryCTA={{ text: "Moje wizyty", href: "/appointments" }}
        secondaryCTA={{ text: "Nowa rezerwacja", href: "/schedules" }}
      />
      <Stats stats={[
        { value: "5", label: "Nadchodzące wizyty", color: "green-600" },
        { value: "98%", label: "Pacjentów poleca", color: "indigo-600" },
        { value: "~10 min", label: "Średni czas rezerwacji", color: "green-600" },
      ]} />
      <CTASection cta={{ text: "Umów wizytę", href: "/schedules" }} />
    </div>
  )
}

function DoctorHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      <Hero
        title="Twój harmonogram"
        subtitle="zarządzaj wizytami pacjentów"
        description="Zobacz dzisiejsze wizyty, edytuj harmonogram i kontroluj dostępność dla pacjentów."
        primaryCTA={{ text: "Mój harmonogram", href: "/my-schedule" }}
        secondaryCTA={{ text: "Zarządzaj grafikiem", href: "/manage-schedule" }}
      />
      <Stats stats={[
        { value: "12", label: "Wizyty dzisiaj", color: "yellow-600" },
        { value: "150", label: "Pacjentów w systemie", color: "indigo-600" },
        { value: "~15 min", label: "Średni czas wizyty", color: "yellow-600" },
      ]} />
      <CTASection cta={{ text: "Zarządzaj wizytami", href: "/manage-schedule" }} />
    </div>
  )
}

function AdminHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Hero
        title="Panel administracyjny"
        subtitle="zarządzaj użytkownikami i lekarzami"
        description="Dodawaj nowych lekarzy, kontroluj konta użytkowników i ustawienia systemu."
        primaryCTA={{ text: "Zarządzaj użytkownikami", href: "/admin/users" }}
        secondaryCTA={{ text: "Dodaj lekarza", href: "/admin/create-doctor" }}
      />
      <Stats stats={[
        { value: "500", label: "Pacjentów w systemie", color: "purple-600" },
        { value: "200", label: "Lekarzy w systemie", color: "indigo-600" },
        { value: "5", label: "Administratorzy", color: "purple-600" },
      ]} />
      <CTASection cta={{ text: "Ustawienia systemu", href: "/admin/persistence" }} />
    </div>
  )
}

/* -------------------------- WSPÓLNE KOMPONENTY -------------------------- */

function Hero({ title, subtitle, description, primaryCTA, secondaryCTA }: any) {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700 mb-6">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
            Umów wizytę w <strong>kilka kliknięć</strong>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900">
            {title}
            <span className="block mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{subtitle}</span>
          </h1>

          <p className="mt-8 text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{description}</p>

          <div className="mt-10 flex flex-col sm:flex-row gap-5 justify-center">
            {primaryCTA && (
              <a
                href={primaryCTA.href}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-6 text-lg font-semibold text-white shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 hover:scale-[1.03]"
              >
                <span className="relative z-10">{primaryCTA.text}</span>
                <div className="absolute inset-0 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 bg-gradient-to-r from-indigo-600 to-blue-600"></div>
              </a>
            )}
            {secondaryCTA && (
              <a
                href={secondaryCTA.href}
                className="rounded-2xl border-2 border-gray-300 bg-white/80 backdrop-blur-sm px-10 py-6 text-lg font-semibold text-gray-800 hover:border-gray-400 transition-all duration-300 hover:shadow-xl"
              >
                {secondaryCTA.text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Stats({ stats }: any) {
  return (
    <section className="py-20 bg-white border-t border-gray-100">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 text-center">
          {stats.map((s: any, idx: number) => (
            <div key={idx}>
              <div className={`text-5xl font-bold text-${s.color} mb-3`}>{s.value}</div>
              <p className="text-lg text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection({ cta }: any) {
  return (
    <section className="py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
          Gotowy na wizytę bez czekania?
        </h2>

        <a
          href={cta.href}
          className="inline-flex items-center gap-3 rounded-xl bg-blue-600 px-12 py-7 text-xl font-semibold text-white shadow-xl hover:bg-blue-700 transition-colors hover:shadow-blue-500/30 group"
        >
          <span>{cta.text}</span>
          <svg className="h-6 w-6 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      </div>
    </section>
  )
}
