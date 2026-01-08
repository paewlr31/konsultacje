export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Strona główna</h1>
      <p className="text-lg text-slate-400">
        Ta strona jest dostępna dla: Gości, Pacjentów, Lekarzy, Adminów
      </p>
      {/* Tutaj treść strony głównej – np. powitanie, opis serwisu */}
      <div className="mt-8">
        <p>Witamy w systemie rezerwacji konsultacji medycznych!</p>
      </div>
    </div>
  )
}