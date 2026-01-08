export default function DoctorsList() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Lista lekarzy</h1>
      <p className="text-lg text-slate-400">
        Ta strona jest dostępna dla: Gości, Pacjentów, Lekarzy, Adminów
      </p>
      {/* Tutaj lista lekarzy – goście widzą tylko podstawowe dane */}
      <div className="mt-8">
        <p>Tutaj będzie lista dostępnych lekarzy...</p>
      </div>
    </div>
  )
}