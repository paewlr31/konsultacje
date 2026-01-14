// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

//Uwaga: Supabase nie ma natywnego wsparcia dla none, 
//więc używamy dummy storage + wyłączamy autoRefresh i persistSession.

// Domyślny tryb – fallback
const DEFAULT_STORAGE_TYPE: 'local' | 'session' | 'none' = 'local'

// Funkcja pomocnicza do odczytu aktualnego trybu z localStorage (tylko po stronie klienta)
function getPersistanceMode(): 'local' | 'session' | 'none' {
  if (typeof window === 'undefined') return DEFAULT_STORAGE_TYPE

  const saved = localStorage.getItem('auth-persistence-mode')
  if (saved === 'local' || saved === 'session' || saved === 'none') {
    return saved
  }
  return DEFAULT_STORAGE_TYPE
}

const persistenceMode = getPersistanceMode()

// Tworzymy custom storage jeśli nie 'local'
const supabaseStorage = persistenceMode === 'local'
  ? localStorage
  : persistenceMode === 'session'
    ? sessionStorage
    : // dla 'none' – dummy storage, który nic nie zapisuje
      {
        length: 0,
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
      } as unknown as Storage

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseStorage,
    autoRefreshToken: persistenceMode !== 'none',
    persistSession: persistenceMode !== 'none',
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})