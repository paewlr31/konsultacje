export default function MyAppointments() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Moje wizyty / Koszyk</h1>
      <p className="text-lg text-slate-400">
        Ta strona jest dostępna dla: Pacjentów
      </p>
      {/* Lista zarezerwowanych konsultacji */}
      <div className="mt-8">
        <p>Twoje zarezerwowane terminy...</p>
      </div>
    </div>
  )
}