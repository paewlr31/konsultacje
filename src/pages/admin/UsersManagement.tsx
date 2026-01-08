export default function UsersManagement() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Zarządzanie użytkownikami</h1>
      <p className="text-lg text-slate-400">
        Ta strona jest dostępna dla: Adminów
      </p>
      {/* Lista użytkowników z możliwością banowania */}
      <div className="mt-8">
        <p>Tabela użytkowników z przyciskami ban/odbanuj...</p>
      </div>
    </div>
  )
}