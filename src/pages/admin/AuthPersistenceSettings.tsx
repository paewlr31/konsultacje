// src/pages/admin/AuthPersistenceSettings.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

type PersistenceMode = 'local' | 'session' | 'none'

const modeDescriptions: Record<PersistenceMode, string> = {
  local: 'Sesja trwała – użytkownik pozostaje zalogowany po zamknięciu przeglądarki i ponownym otwarciu',
  session: 'Sesja tylko na czas życia karty – po zamknięciu karty przeglądarki użytkownik jest wylogowywany',
  none: 'Brak persystencji – wylogowanie przy każdym odświeżeniu strony',
}

export default function AuthPersistenceSettings() {
  const [currentMode, setCurrentMode] = useState<PersistenceMode>('local')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Sprawdź czy użytkownik jest adminem
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (data?.role !== 'ADMIN') {
        navigate('/')
        return
      }

      // Odczytaj aktualny tryb
      const saved = localStorage.getItem('auth-persistence-mode') as PersistenceMode | null
      setCurrentMode(saved || 'local')
      setLoading(false)
    }

    checkRole()
  }, [navigate])

  const handleChangeMode = (newMode: PersistenceMode) => {
    localStorage.setItem('auth-persistence-mode', newMode)
    setCurrentMode(newMode)
    alert('Tryb persystencji zmieniony! Odśwież stronę lub uruchom ponownie aplikację, aby zmiany weszły w życie.')
  }

  if (loading) return <p>Ładowanie...</p>

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 card bg-base-200">
      <h2 className="text-2xl font-bold mb-6">Ustawienia persystencji sesji logowania</h2>

      <div className="space-y-6">
        {(['local', 'session', 'none'] as PersistenceMode[]).map((mode) => (
          <div
            key={mode}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              currentMode === mode ? 'border-primary bg-primary/10' : 'border-base-300'
            }`}
            onClick={() => handleChangeMode(mode)}
          >
            <div className="flex items-center gap-4">
              <input
                type="radio"
                name="persistence"
                checked={currentMode === mode}
                onChange={() => handleChangeMode(mode)}
                className="radio radio-primary"
              />
              <div>
                <h3 className="font-semibold capitalize">{mode === 'none' ? 'Brak (none)' : mode}</h3>
                <p className="text-sm text-base-content/70">{modeDescriptions[mode]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-base-300 rounded-lg">
        <p className="text-sm">
          <strong>Aktualny tryb:</strong> <span className="font-mono">{currentMode}</span>
        </p>
        <p className="text-sm mt-2">
          Zmiana trybu wymaga odświeżenia strony lub restartu aplikacji, aby nowy klient Supabase został zainicjalizowany z nowym ustawieniem.
        </p>
      </div>
    </div>
  )
}