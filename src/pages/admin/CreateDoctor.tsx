// src/pages/admin/CreateDoctor.tsx
import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function CreateDoctor() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    doctor_type: '', // nowa wartość
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const SUPABASE_FUNCTIONS_URL = 
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-doctor`;

      const response = await fetch(SUPABASE_FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          doctor_type: formData.doctor_type, // wysyłamy typ lekarza
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nie udało się utworzyć lekarza');
      }

      setSuccess(`Lekarz ${formData.full_name} (${formData.doctor_type}) został pomyślnie dodany!`);
      setFormData({
        full_name: '',
        email: '',
        password: '',
        doctor_type: '',
      });

    } catch (err: any) {
      console.error('Błąd podczas tworzenia lekarza:', err);
      setError(err.message || 'Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Dodaj nowego lekarza</h1>
          <p className="mt-3 text-lg text-gray-600">
            Konto zostanie utworzone i automatycznie potwierdzone
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-xl p-8 border border-gray-100 space-y-6">
          {/* Imię i nazwisko */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Imię i nazwisko <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Dr Jan Kowalski"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="jan.kowalski@przychodnia.pl"
            />
          </div>

          {/* Hasło */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Hasło tymczasowe <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Minimum 8 znaków"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Lekarz będzie mógł je później zmienić
            </p>
          </div>

          {/* Typ lekarza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Specjalizacja lekarza <span className="text-red-500">*</span>
            </label>
            <select
              name="doctor_type"
              value={formData.doctor_type}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Wybierz specjalizację</option>
              <option value="Kardiolog">Kardiolog</option>
              <option value="Dermatolog">Dermatolog</option>
              <option value="Pediatra">Pediatra</option>
              <option value="Neurolog">Neurolog</option>
              <option value="Stomatolog">Stomatolog</option>
            </select>
          </div>

          {/* Błędy */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Sukces */}
          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 px-6 rounded-lg font-medium text-white
              transition-all duration-200 flex items-center justify-center gap-2
              ${loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
              }
            `}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Tworzenie konta...
              </>
            ) : (
              'Utwórz konto lekarza'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
