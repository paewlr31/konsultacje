// src/pages/admin/UsersManagement.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Loader2, Check, X } from "lucide-react";

interface User {
  id: string;
  full_name: string;
  role: string;
  is_banned: boolean;
  doctor_type: string | null;
  created_at: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Pobranie wszystkich użytkowników z tabeli profiles
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_banned, doctor_type, created_at")
        .order("full_name", { ascending: true });

      if (error) throw error;

      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError("Nie udało się pobrać użytkowników");
    } finally {
      setLoading(false);
    }
  };

  // Toggle ban/unban
  const toggleBan = async (userId: string, ban: boolean) => {
    setUpdatingId(userId);
    setError(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: ban })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: ban } : u))
      );
    } catch (err: any) {
      console.error(err);
      setError("Nie udało się zaktualizować statusu ban");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-8 min-h-screen bg-slate-50">
      <h1 className="text-3xl font-bold mb-2">Zarządzanie użytkownikami</h1>
      <p className="text-lg text-slate-400 mb-6">
        Ta strona jest dostępna tylko dla adminów
      </p>

      {loading && <p>Ładowanie użytkowników...</p>}
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="overflow-x-auto bg-white shadow rounded-xl border border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-700">Imię i nazwisko</th>
              <th className="px-6 py-3 font-medium text-gray-700">Rola</th>
              <th className="px-6 py-3 font-medium text-gray-700">Specjalizacja</th>
              <th className="px-6 py-3 font-medium text-gray-700">Dołączył</th>
              <th className="px-6 py-3 font-medium text-gray-700">Status</th>
              <th className="px-6 py-3 font-medium text-gray-700">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-gray-500 text-center">
                  Brak użytkowników
                </td>
              </tr>
            )}

            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-200">
                <td className="px-6 py-3">{user.full_name}</td>
                <td className="px-6 py-3">{user.role}</td>
                <td className="px-6 py-3">{user.doctor_type || "-"}</td>
                <td className="px-6 py-3">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3">
                  {user.is_banned ? (
                    <span className="text-red-600 font-semibold">Zablokowany</span>
                  ) : (
                    <span className="text-green-600 font-semibold">Aktywny</span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <button
                    disabled={updatingId === user.id}
                    onClick={() => toggleBan(user.id, !user.is_banned)}
                    className={`
                      px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2
                      ${user.is_banned
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                      } transition-all duration-200
                    `}
                  >
                    {updatingId === user.id ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : user.is_banned ? (
                      <>
                        <Check className="h-4 w-4" /> Odbanuj
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4" /> Zbanuj
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
