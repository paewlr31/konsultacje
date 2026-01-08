export default function MySchedule() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Mój harmonogram</h1>
      <p className="text-lg text-slate-400">
        Ta strona jest dostępna dla: Lekarzy
      </p>
      {/* Podgląd własnego harmonogramu */}
      <div className="mt-8">
        <p>Twoje zaplanowane konsultacje...</p>
      </div>
    </div>
  )
}