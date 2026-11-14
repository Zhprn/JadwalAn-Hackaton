import type { ReactNode } from "react";
import { CalendarCheck, Sparkles, Star } from "lucide-react";

/** Kerangka halaman masuk / daftar. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 items-stretch pb-16 md:pb-0">
      <div className="hidden lg:flex flex-col justify-between bg-[#F8F9FF] rounded-[2rem] p-10">
        <div>
          <p className="text-indigo-600 font-bold text-xs tracking-widest mb-4">SATU AKUN, SEMUA BERES</p>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">Booking, bayar, dan chat — tanpa antre.</h1>
          <p className="text-slate-500 mt-4">Daftar pakai nomor WhatsApp. Riwayat main, tier member, dan promo khusus tersimpan otomatis.</p>
        </div>
        <ul className="space-y-4 mt-10">
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span className="w-10 h-10 rounded-xl bg-white shadow-sm text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </span>
            Lihat &amp; atur semua booking
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span className="w-10 h-10 rounded-xl bg-white shadow-sm text-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </span>
            Naik tier loyal &amp; VIP, buka promo eksklusif
          </li>
          <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span className="w-10 h-10 rounded-xl bg-white shadow-sm text-violet-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            Booking cukup lewat chat AI
          </li>
        </ul>
      </div>
      <div className="flex items-center justify-center py-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
