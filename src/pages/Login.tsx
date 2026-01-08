import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h2 className="text-2xl mb-4">Logowanie</h2>
      <form onSubmit={handleLogin}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input input-bordered w-full mb-4" required />
        <input type="password" placeholder="Hasło" value={password} onChange={(e) => setPassword(e.target.value)} className="input input-bordered w-full mb-4" required />
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="btn btn-primary w-full">Zaloguj</button>
      </form>
      <p className="mt-4">Nie masz konta? <Link to="/register">Zarejestruj się</Link></p>
    </div>
  )
}