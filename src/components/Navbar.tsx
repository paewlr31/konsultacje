import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import Logout from './Logout'

type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN' | null
//Uwaga: Supabase nie ma natywnego wsparcia dla none, 
//więc używamy dummy storage + wyłączamy autoRefresh i persistSession.


export default function Navbar() {
  const [role, setRole] = useState<Role>(null)
  const [fullName, setFullName] = useState<string>('')

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single()
        if (data) {
          setRole(data.role)
          setFullName(data.full_name)
        }
      }
    }
    getProfile()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) getProfile()
      else {
        setRole(null)
        setFullName('')
      }
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  if (!role) {
    // Gość (niezalogowany)
    return (
      <nav className="navbar bg-base-100">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost">Strona główna</Link>
          <Link to="/doctors" className="btn btn-ghost">Lista lekarzy</Link>
        </div>
        <div className="flex-none">
          <Link to="/register" className="btn btn-ghost">Rejestracja</Link>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </div>
      </nav>
    )
  }

  // Wspólne dla wszystkich zalogowanych
  const commonLinks = (
    <>
      <Link to="/" className="btn btn-ghost">Strona główna</Link>
      <Link to="/doctors" className="btn btn-ghost">Lista lekarzy</Link>
    </>
  )

  if (role === 'PATIENT') {
    return (
      <nav className="navbar bg-base-100">
        <div className="flex-1">{commonLinks}</div>
        <div className="flex-none gap-2">
          <Link to="/schedules" className="btn btn-ghost">Harmonogramy lekarzy</Link>
          <Link to="/appointments" className="btn btn-ghost">Moje wizyty</Link>
          <span className="btn btn-ghost">{fullName}</span>
          <Logout />
        </div>
      </nav>
    )
  }

  if (role === 'DOCTOR') {
    return (
      <nav className="navbar bg-base-100">
        <div className="flex-1">{commonLinks}</div>
        <div className="flex-none gap-2">
          <Link to="/my-schedule" className="btn btn-ghost">Mój harmonogram</Link>
          <Link to="/manage-schedule" className="btn btn-ghost">Zarządzanie harmonogramem</Link>
          <span className="btn btn-ghost">{fullName}</span>
          <Logout />
        </div>
      </nav>
    )
  }

  if (role === 'ADMIN') {
    return (
      <nav className="navbar bg-base-100">
        <div className="flex-1">{commonLinks}</div>
        <div className="flex-none gap-2">
          <Link to="/admin/users" className="btn btn-ghost">Lista użytkowników</Link>
          <Link to="/admin/create-doctor" className="btn btn-ghost">Utwórz lekarza</Link>
            <Link to="/admin/persistence" className="btn btn-ghost">Persystencja sesji</Link>
          <Logout />
        </div>
      </nav>
    )
  }

  return null
}