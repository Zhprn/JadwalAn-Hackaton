import { createFileRoute } from '@tanstack/react-router'
import { 
  CalendarDays, 
  Gamepad2, 
  Wallet, 
  Clock, 
  Bot, 
  Plus, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react'

// Mendefinisikan route berdasarkan struktur folder _authenticated/dashboard/index.tsx
export const Route = createFileRoute('/_authenticated/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  // Data dummy untuk tabel reservasi
  const reservations = [
    { id: 'RP', name: 'Raka Pratama', source: 'Via WhatsApp', time: '14:00 – 16:00', duration: '2 jam', item: 'PS5 · TV 1', total: 'Rp40.000' },
    { id: 'RE', name: 'Reza Putra', source: 'Via WhatsApp', time: '14:00 – 18:00', duration: '4 jam', item: 'PS4 · TV 3', total: 'Rp48.000' },
    { id: 'FR', name: 'Fajar Ramadhan', source: 'Via AI - WhatsApp', time: '16:00 – 19:00', duration: '3 jam', item: 'PS5 · TV 1', total: 'Rp60.000' },
    { id: 'AH', name: 'Arif Hidayat', source: 'Via WhatsApp', time: '17:00 – 20:00', duration: '3 jam', item: 'PS5 · TV 2', total: 'Rp60.000' },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Selamat siang, Admin</h1>
          <p className="text-sm text-slate-500 mt-1">Semua aktivitas rental dalam satu tampilan. Yuk, cek hari ini!</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
          <CalendarDays className="w-4 h-4" />
          Rabu, 21 Oktober 2026
        </button>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Slot */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Slot Terisi Hari Ini</span>
            <Gamepad2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-slate-800 mb-2">24/30 Slot</h2>
            <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
              ↑ 4 slot dari kemarin
            </p>
          </div>
        </div>

        {/* Card 2: Pendapatan */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Pendapatan Estimasi</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-slate-800 mb-2">Rp424.000</h2>
            <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
              ↑ 18% dari kemarin
            </p>
          </div>
        </div>

        {/* Card 3: Okupansi */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Tingkat Okupansi</span>
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-slate-800 mb-2">80%</h2>
              <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                6 slot masih tersedia
              </p>
            </div>
            {/* Custom SVG Progress Circle */}
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-indigo-50" />
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray="150.7" strokeDashoffset="30.14" className="text-indigo-600 rounded-full" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* 3. AI BANNER */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">AI bantu isi slot, kamu fokus urus rental.</h3>
            <p className="text-xs text-indigo-700/80 mt-0.5">8 booking ditangani otomatis hari ini. Slot sore paling diminati — siapkan stik cadangan!</p>
          </div>
        </div>
        <button className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5 whitespace-nowrap hover:text-indigo-800 transition-colors">
          Lihat percakapan <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4. TABLE SECTION */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Reservasi Mendatang</h2>
            <p className="text-sm text-slate-500 mt-1">4 reservasi berikutnya · Hari ini</p>
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Tambah reservasi
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-xs text-slate-400">
                <th className="py-4 px-6 font-semibold tracking-wide">Nama</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Jam Main</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Item</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Total</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Status Booking</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-800">
              {reservations.map((res, index) => (
                <tr key={index} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs tracking-wider">
                        {res.id}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{res.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{res.source}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-800">{res.time}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{res.duration}</p>
                  </td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{res.item}</td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{res.total}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Confirmed
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <span className="text-xs text-slate-500 font-medium px-2">Menampilkan 4 reservasi mendatang</span>
          <button className="text-sm font-semibold text-indigo-600 flex items-center gap-1.5 hover:text-indigo-700 transition-colors">
            Buka kalender <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5. BOTTOM SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-8">
        <div className="flex items-center gap-3 px-2">
          <Gamepad2 className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">3 stasiun siap main</p>
            <p className="text-xs text-slate-500 mt-0.5">2 PS5 · 1 PS4</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <Bot className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">8 booking otomatis</p>
            <p className="text-xs text-slate-500 mt-0.5">Rata-rata respons 3 detik</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <ShieldCheck className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Tidak ada jadwal bentrok</p>
            <p className="text-xs text-slate-500 mt-0.5">Semua reservasi tersinkron</p>
          </div>
        </div>
      </div>

    </div>
  )
}