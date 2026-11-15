import { ShieldAlert } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export function PermissionDenied(): ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-danger/10 p-4 text-danger">
        <ShieldAlert size={48} aria-hidden="true" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Ruxsat etilmagan</h1>
      <p className="mb-6 max-w-md text-gray-500">
        Sizda ushbu sahifani ko'rish uchun ruxsat yo'q. Agar bu xatolik bo'lsa, tizim administratoriga murojaat qiling.
      </p>
      <Link to="/" className="btn btn-brand">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}

