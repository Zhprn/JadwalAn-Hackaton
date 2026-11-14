// src/routes/promo.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Calendar, Copy, Info, Check, Gamepad2, Activity, CircleDashed } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/promo')({
  component: Promo,
})

function Promo() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const promos = [
    {
      discount: '20%',
      type: 'OFF',
      badge: 'PlayStation 5',
      badgeIcon: <Gamepad2 className="w-3.5 h-3.5" />,
      title: 'Weekend Mabar',
      desc: 'Ajak teman, main PS5 lebih hemat setiap Sabtu & Minggu.',
      date: '24 - 31 Oktober 2026',
      terms: 'Maks. Rp20.000 · Min. 2 jam',
      code: 'MABAR20',
    },
    {
      discount: '15%',
      type: 'OFF',
      badge: 'PlayStation 4',
      badgeIcon: <Gamepad2 className="w-3.5 h-3.5" />,
      title: 'Siang Lebih Hemat',
      desc: 'Isi jeda siang dengan PS4. Berlaku Senin-Kamis sebelum 17.00.',
      date: '1 - 31 Oktober 2026',
      terms: 'Maks. Rp15.000 · Min. 2 jam',
      code: 'SIANG15',
    },
    {
      discount: 'Rp25.000',
      type: 'POTONGAN',
      badge: 'Futsal',
      badgeIcon: <Activity className="w-3.5 h-3.5" />,
      title: 'Gol Hemat',
      desc: 'Kumpulkan tim terbaikmu. Lebih hemat untuk sewa lapangan futsal.',
      date: '24 Oktober - 30 November 2026',
      terms: 'Min. transaksi Rp150.000',
      code: 'GOL25',
    },
    {
      discount: '10%',
      type: 'OFF',
      badge: 'Biliar',
      badgeIcon: <CircleDashed className="w-3.5 h-3.5" />,
      title: 'Break & Play',
      desc: 'Santai setelah aktivitas, nikmati potongan untuk setiap sesi biliar.',
      date: '1 - 31 Oktober 2026',
      terms: 'Maks. Rp10.000 · Min. 2 jam',
      code: 'BILIAR10',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8">
      {/* Header Info */}
      <div className="space-y-3">
        <p className="text-indigo-600 font-bold text-[10px] tracking-widest uppercase">Promo Pilihan JadwalAn</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Main seru, lebih hemat.</h1>
        <p className="text-slate-500 text-sm">Sedikit bonus untuk waktu bermainmu. Pilih promo yang paling pas.</p>
      </div>

      {/* Grid Promo */}
      <div>
        <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Semua promo</h2>
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">4 tersedia</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Berlaku di JadwalAn Kemang</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {promos.map((promo, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-4xl font-black text-indigo-600 tracking-tight leading-none">{promo.discount}</h3>
                    <p className="text-[10px] font-bold text-indigo-600 tracking-wider mt-1">{promo.type}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/50">
                    {promo.badgeIcon} {promo.badge}
                  </span>
                </div>
                
                <h4 className="font-bold text-slate-900 text-lg mb-1.5">{promo.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  {promo.desc}
                </p>

                <div className="space-y-1.5 mb-6">
                  <p className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {promo.date}
                  </p>
                  <p className="text-[11px] text-slate-500 pl-5 font-medium">
                    {promo.terms}
                  </p>
                </div>
              </div>

              {/* Copy Code Area */}
              <div className="bg-slate-50 rounded-xl p-1.5 pl-4 flex items-center justify-between border border-slate-100 group-hover:border-indigo-100 transition-colors">
                <span className="font-bold text-sm text-slate-700 tracking-wide">{promo.code}</span>
                <button 
                  onClick={() => handleCopy(promo.code)}
                  className="flex items-center gap-1.5 bg-white border border-slate-200 text-indigo-600 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-indigo-50 hover:border-indigo-100 transition-colors shadow-sm"
                >
                  {copiedCode === promo.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> 
                      <span className="text-emerald-700">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Salin kode
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panduan Penggunaan & Syarat */}
      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 mt-4">
        <h3 className="font-bold text-slate-900 text-base mb-6">Pakai promo, semudah ini.</h3>
        
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 mb-8">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">Salin kode promo</h4>
              <p className="text-[11px] text-slate-500">Pilih penawaran favoritmu.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 flex-1">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">Pilih jadwal main</h4>
              <p className="text-[11px] text-slate-500">Tentukan sesi yang sesuai promo.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 flex-1">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs mb-1">Tempel saat bayar</h4>
              <p className="text-[11px] text-slate-500">Diskon langsung mengurangi total.</p>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 pt-5 border-t border-slate-200/60">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500">
            Satu kode untuk satu transaksi. Promo tidak dapat digabung dan mengikuti periode serta syarat masing-masing penawaran.
          </p>
        </div>
      </div>
    </div>
  )
}