import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset błędu
    setError('')

    // Walidacja zgodności haseł
    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne. Proszę wpisać takie samo hasło w obu polach.')
      return
    }

    // Rejestracja w Supabase
    const { error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }, // przekazywane do triggera w bazie
      },
    })

    if (supabaseError) {
      setError(supabaseError.message)
    } else {
      // Sukces – przekieruj do logowania
      navigate('/login', { state: { message: 'Konto zostało utworzone! Teraz możesz się zalogować.' } })
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl mb-4">Rejestracja (Pacjent)</h2>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <input
            type="text"
            placeholder="Imię i nazwisko"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <input
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered w-full"
            required
            minLength={6} // Supabase wymaga min. 6 znaków
          />
        </div>

        <div>
          <input
            type="password"
            placeholder="Potwierdź hasło"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input input-bordered w-full"
            required
          />
        </div>

        {error && (
          <div className="alert alert-error shadow-lg">
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current flex-shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full">
          Zarejestruj
        </button>
      </form>

      <p className="mt-6 text-center">
        Masz już konto?{' '}
        <Link to="/login" className="link link-primary">
          Zaloguj się
        </Link>
      </p>
    </div>
  )
}