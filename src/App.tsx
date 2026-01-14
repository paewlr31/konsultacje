import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import React from 'react'
import Navbar from './components/Navbar'
import Home from './pages/guest/Home'
import DoctorsList from './pages/guest/DoctorsList'
import Login from './pages/Login'
import Register from './pages/Register'

// Patient
import Schedules from './pages/patient/Schedules'
import MyAppointments from './pages/patient/MyAppointments'

// Doctor
import MySchedule from './pages/doctor/MySchedule'
import ManageSchedule from './pages/doctor/ManageSchedule'

// Admin
import UsersManagement from './pages/admin/UsersManagement'
import CreateDoctor from './pages/admin/CreateDoctor'
import AuthPersistenceSettings from './pages/admin/AuthPersistenceSettings'

import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function RequireAuth({ children, allowedRoles }: { children: React.JSX.Element, allowedRoles?: string[] }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => { listener.subscription.unsubscribe() }
  }, [])

  if (loading) return <p>Loading...</p>

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />

  // Dla prostoty – wszystkie zalogowane mają dostęp do swoich sekcji (sprawdzane w Navbar)

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Gość */}
        <Route path="/" element={<Home />} />
        <Route path="/doctors" element={<DoctorsList />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Pacjent */}
        <Route path="/schedules" element={<RequireAuth><Schedules /></RequireAuth>} />
        <Route path="/appointments" element={<RequireAuth><MyAppointments /></RequireAuth>} />

        {/* Lekarz */}
        <Route path="/my-schedule" element={<RequireAuth><MySchedule /></RequireAuth>} />
        <Route path="/manage-schedule" element={<RequireAuth><ManageSchedule /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin/users" element={<RequireAuth><UsersManagement /></RequireAuth>} />
        <Route path="/admin/create-doctor" element={<RequireAuth><CreateDoctor /></RequireAuth>} />
        <Route path="/admin/persistence" element={<RequireAuth><AuthPersistenceSettings /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}