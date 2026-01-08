import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Logout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <button onClick={handleLogout} className="btn btn-outline">
      Logout
    </button>
  )
}