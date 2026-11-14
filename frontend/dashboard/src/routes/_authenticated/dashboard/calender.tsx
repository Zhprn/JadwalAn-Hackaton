import { createFileRoute } from '@tanstack/react-router'
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal,
  Gamepad2,
  CheckCircle2,
  Bot
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/dashboard/calender')({
     component: CalendarPage,
  
  })

export default function CalendarPage() {
  const hours = Array.from({ length: 11 }, (_, i) => i + 10);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto overflow-x-hidden">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Manajemen Kalender</h1>
          <p className="text-sm text-slate-500 mt-1">Atur jam main, cek slot kosong, dan hindari booking bentrok.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#3b82f6] hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Tambah reservasi
        </button>
      </div>

      {/* 2. CALENDAR BOARD (MAIN CONTAINER) */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col min-w-[800px] overflow-x-auto">
        
        {/* === TOP CONTROLS === */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between min-w-[900px]">
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Hari ini
            </button>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-md">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-slate-800 flex items-baseline gap-2">
              21 Oktober 2026 <span className="text-sm font-medium text-slate-400">Rabu</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <SlidersHorizontal className="w-4 h-4" />
              Semua stasiun
            </button>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button className="px-4 py-1.5 bg-[#3b82f6] text-white text-sm font-semibold rounded-md shadow-sm">Harian</button>
              <button className="px-4 py-1.5 text-slate-500 text-sm font-semibold hover:text-slate-700 rounded-md">Mingguan</button>
            </div>
          </div>
        </div>

        {/* === LEGEND & INFO === */}
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-slate-50/50 min-w-[900px]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200"></span> Tersedia
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-3 h-3 rounded bg-[#3b82f6]"></span> Booked
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-3 h-3 rounded border-2 border-[#8b5cf6] bg-[#3b82f6]"></span> Booking dari AI
            </div>
          </div>
          <span className="text-xs text-slate-400">Jam operasional 10:00 – 20:00 · WIB</span>
        </div>

        {/* === TIMELINE GRID AREA === */}
        <div className="p-5 min-w-[900px] flex flex-col gap-4">
          
          {/* Header Jam */}
          <div className="flex items-end pb-2 border-b border-gray-100">
            {/* Kolom Kiri Header */}
            <div className="w-[180px] flex-shrink-0 text-xs font-bold text-slate-400 tracking-wider">
              STASIUN / JAM
            </div>
            {/* Kolom Kanan Header (Jam) */}
            <div className="flex-1 grid grid-cols-10">
              {hours.slice(0, 10).map((hour) => (
                <div key={hour} className="text-xs font-medium text-slate-400 relative">
                  <span className="absolute -left-3">{hour}:00</span>
                </div>
              ))}
              <div className="relative -ml-4"><span className="text-xs font-medium text-slate-400 absolute -left-3">20:00</span></div>
            </div>
          </div>

          {/* --- BARIS 1: PS5 - TV 1 --- */}
          <div className="flex min-h-[96px]">
            {/* Info Stasiun (Kiri) */}
            <div className="w-[180px] flex-shrink-0 pr-4 flex flex-col justify-center border-r border-slate-100">
              <Gamepad2 className="w-5 h-5 text-indigo-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">PS5 - TV 1</h3>
              <p className="text-xs text-slate-400 mt-0.5">Rp20.000 / jam</p>
            </div>
            {/* Grid Jadwal (Kanan) */}
            <div className="flex-1 grid grid-cols-10 gap-2 pl-4">
              <div className="col-span-4 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Andi</h4>
                <p className="text-xs text-blue-100 my-0.5">10:00 – 14:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-2 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Raka</h4>
                <p className="text-xs text-blue-100 my-0.5">14:00 – 16:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-3 bg-[#3b82f6] border-2 border-[#8b5cf6] text-white rounded-xl p-3 flex flex-col justify-center shadow-[0_0_10px_rgba(139,92,246,0.3)] hover:opacity-90 cursor-pointer relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                <h4 className="font-semibold text-sm relative z-10 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Fajar</h4>
                <p className="text-xs text-blue-100 my-0.5 relative z-10">16:00 – 19:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90 relative z-10">
                  <span className="bg-white/20 px-1.5 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Via AI - Confirmed</span>
                </div>
              </div>
              <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
            </div>
          </div>

          {/* --- BARIS 2: PS5 - TV 2 --- */}
          <div className="flex min-h-[96px]">
            {/* Info Stasiun (Kiri) */}
            <div className="w-[180px] flex-shrink-0 pr-4 flex flex-col justify-center border-r border-slate-100">
              <Gamepad2 className="w-5 h-5 text-indigo-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">PS5 - TV 2</h3>
              <p className="text-xs text-slate-400 mt-0.5">Rp20.000 / jam</p>
            </div>
            {/* Grid Jadwal (Kanan) */}
            <div className="flex-1 grid grid-cols-10 gap-2 pl-4">
              <div className="col-span-2 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Dimas</h4>
                <p className="text-xs text-blue-100 my-0.5">10:00 – 12:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
              <div className="col-span-3 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Rizky</h4>
                <p className="text-xs text-blue-100 my-0.5">13:00 – 16:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
              <div className="col-span-3 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Arif</h4>
                <p className="text-xs text-blue-100 my-0.5">17:00 – 20:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
            </div>
          </div>

          {/* --- BARIS 3: PS4 - TV 3 --- */}
          <div className="flex min-h-[96px]">
            {/* Info Stasiun (Kiri) */}
            <div className="w-[180px] flex-shrink-0 pr-4 flex flex-col justify-center border-r border-slate-100">
              <Gamepad2 className="w-5 h-5 text-indigo-600 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">PS4 - TV 3</h3>
              <p className="text-xs text-slate-400 mt-0.5">Rp12.000 / jam</p>
            </div>
            {/* Grid Jadwal (Kanan) */}
            <div className="flex-1 grid grid-cols-10 gap-2 pl-4">
              <div className="col-span-3 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Yoga</h4>
                <p className="text-xs text-blue-100 my-0.5">10:00 – 13:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
              <div className="col-span-4 bg-[#3b82f6] text-white rounded-xl p-3 flex flex-col justify-center hover:opacity-90 cursor-pointer">
                <h4 className="font-semibold text-sm">Reza</h4>
                <p className="text-xs text-blue-100 my-0.5">14:00 – 18:00</p>
                <div className="flex items-center gap-1 text-[10px] font-medium text-white/90"><CheckCircle2 className="w-3 h-3" /> Confirmed</div>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-2">
                <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
                <div className="col-span-1 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-xl border border-dashed border-slate-200"></div>
              </div>
            </div>
          </div>

        </div>

        {/* === BOTTOM FOOTER === */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-slate-50/50 min-w-[900px]">
          <span className="text-xs text-slate-500 font-medium px-1">Klik slot kosong untuk menambah reservasi · Durasi minimum 1 jam</span>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-emerald-600">Kalender tersinkron</span>
          </div>
        </div>

      </div>
    </div>
  )
}