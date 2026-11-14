// src/routes/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Calendar, MonitorPlay, CheckCircle2, ChevronDown, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate()
  
  // State untuk interaksi Ganti Tanggal (Simulasi UI)
  const [currentDate, setCurrentDate] = useState("Sabtu, 24 Oktober 2026")

  const handleDateChange = () => {
    setCurrentDate(prev => 
      prev === "Sabtu, 24 Oktober 2026" 
        ? "Minggu, 25 Oktober 2026" 
        : "Sabtu, 24 Oktober 2026"
    )
  }

  // Fungsi saat tombol Booking ditekan
  const handleBooking = (slot: {unit: string, time: string, price: string}) => {
    // 1. Simpan data slot yang dipilih ke memori sementara (sessionStorage)
    sessionStorage.setItem('pendingBooking', JSON.stringify({
      unit: slot.unit,
      price: slot.price,
      date: currentDate,
      defaultTime: slot.time // Contoh: "14.00 - 15.00"
    }))
    
    // 2. Pindah ke halaman form booking
    navigate({ to: '/booking' })
  }

  // Data dummy slot kosong
  const slots = [
    { unit: "03", time: "14.00 - 15.00", desc: "Pas untuk jeda siang", price: "Rp30.000" },
    { unit: "05", time: "15.00 - 16.00", desc: "Satu jam, banyak keseruan", price: "Rp30.000" },
    { unit: "02", time: "19.00 - 20.00", desc: "Tutup hari dengan mabar", price: "Rp30.000" }
  ]

  return (
    <div className="space-y-12 pb-24 md:pb-10 relative">
      
      {/* Hero Section */}
      <div className="bg-[#F8F9FF] rounded-[2rem] p-6 md:p-12 relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          <p className="text-indigo-600 font-bold text-xs tracking-widest mb-4">WAKTUNYA MAIN, BUKAN MENUNGGU</p>
          <h1 className="text-4xl md:text-[3.5rem] font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
            Jadwal pasti.<br/>Main lebih santai.
          </h1>
          <p className="text-slate-500 md:text-lg text-sm mb-8 max-w-md">
            Dari mabar sampai cetak gol, booking tempat favoritmu dalam hitungan menit.
          </p>
        </div>
        
        {/* Floating Card: Jadwal Terdekat */}
        <div className="mt-4 md:absolute md:top-1/2 md:-translate-y-1/2 md:right-12 bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 w-full md:w-72 z-10 hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">JADWAL TERDEKATMU</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-600 cursor-pointer" />
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
              <MonitorPlay className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">PS5 - Unit 03</h3>
              <p className="text-xs text-slate-500 mt-0.5">Min, 25 Okt • 16.00 - 18.00</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Konsol */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-4">Pilih keseruanmu</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-md whitespace-nowrap hover:bg-indigo-700 transition-colors">
            PlayStation 5
          </button>
          <button className="bg-white text-slate-600 border border-slate-200 px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap hover:bg-slate-50 transition-colors">
            PlayStation 4
          </button>
        </div>
      </div>

      {/* List Slot Kosong */}
      <div>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Slot kosong hari ini</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg inline-flex w-fit transition-all">
              <Calendar className="w-4 h-4 text-indigo-600" />
              {currentDate}
            </div>
          </div>
          <button 
            onClick={handleDateChange}
            className="text-sm text-indigo-600 font-semibold flex items-center gap-1 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors -ml-3 md:ml-0"
          >
            Ganti tanggal <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {slots.map((slot, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-indigo-600 hover:shadow-lg transition-all group flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-5">
                  <div className="flex gap-3 items-center">
                    <div className="text-indigo-600 bg-indigo-50 p-2.5 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <MonitorPlay className="w-5 h-5"/>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">PS5 - Unit {slot.unit}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">2 controller • Layar 43"</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Kosong
                  </span>
                </div>
                <div className="mb-6">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{slot.time}</h3>
                  <p className="text-sm text-slate-500 mt-1">{slot.desc} • 1 jam</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  <div className="font-extrabold text-slate-900 text-lg">{slot.price}</div>
                  <div className="text-[10px] text-slate-400 font-medium">per sesi • sudah termasuk pajak</div>
                </div>
                <button 
                  onClick={() => handleBooking(slot)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-sm"
                >
                  Booking
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Alur (How it works) */}
      <div className="bg-slate-50 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-8">
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Pilih jadwal
          </h3>
          <p className="text-xs text-slate-500 ml-6">Cari waktu yang pas</p>
        </div>
        <div className="hidden md:block w-px h-10 bg-slate-200"></div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Konfirmasi
          </h3>
          <p className="text-xs text-slate-500 ml-6">Bayar dengan aman via QRIS di form booking</p>
        </div>
        <div className="hidden md:block w-px h-10 bg-slate-200"></div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Datang & main
          </h3>
          <p className="text-xs text-slate-500 ml-6">Tempatmu sudah disiapkan</p>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="text-center text-xs text-slate-400 pt-8 pb-4 flex flex-col items-center gap-2">
        <p className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Kemang buka setiap hari • 10.00 - 23.00 WIB</p>
        <p className="mt-2">© 2026 JadwalAn. Waktunya main.</p>
      </div>
    </div>
  )
}