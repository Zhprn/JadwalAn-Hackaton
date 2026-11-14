// src/routes/jadwal.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Calendar, MapPin, Clock, ArrowUpRight, RotateCcw, ArrowDown, Info, CheckCircle2, X, Receipt, QrCode, Gamepad2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/jadwal')({
  component: Jadwal,
})

function Jadwal() {
  // State untuk menyimpan data jadwal yang dipilih untuk modal detail
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null)

  // State untuk menyimpan daftar jadwal (Akan Datang)
  const [upcomingJadwal, setUpcomingJadwal] = useState([
    {
      id: "#JA251003",
      title: "PS5 · Unit 03",
      date: "Minggu, 25 Oktober 2026",
      time: "16.00 - 18.00 WIB · 2 jam",
      price: "Rp60.000",
      day: "25",
      month: "Okt"
    },
    {
      id: "#JA271001",
      title: "Futsal · Lapangan 01",
      date: "Selasa, 27 Oktober 2026",
      time: "19.00 - 20.00 WIB · 1 jam",
      price: "Rp150.000",
      day: "27",
      month: "Okt"
    }
  ])

  // Ambil data jadwal baru dari proses Booking
  useEffect(() => {
    const dataBaru = localStorage.getItem('jadwalBaru')
    if (dataBaru) {
      const parsedData = JSON.parse(dataBaru)
      
      const newBooking = {
        id: "#" + parsedData.id,
        title: `PS5 · Unit ${parsedData.unit}`,
        date: parsedData.date,
        time: `${parsedData.time} · 1 jam`,
        price: parsedData.price,
        day: parsedData.date.split(', ')[1]?.split(' ')[0] || "24",
        month: parsedData.date.split(', ')[1]?.split(' ')[1]?.substring(0, 3) || "Okt"
      }

      setUpcomingJadwal(prev => [newBooking, ...prev])
      localStorage.removeItem('jadwalBaru')
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8 relative">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Jadwal Saya</h1>
        <p className="text-slate-500 text-sm">Semua rencana mainmu, rapi dalam satu tempat.</p>
      </div>

      {/* Banner Menanti */}
      <div className="bg-[#F8F9FF] border border-indigo-50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl shadow-sm text-indigo-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-0.5">Ada {upcomingJadwal.length} jadwal seru menantimu.</h3>
            <p className="text-xs text-slate-500">Datang 10 menit lebih awal, ya!</p>
          </div>
        </div>
        <div className="text-xs font-semibold text-indigo-600 md:text-right bg-indigo-50/50 md:bg-transparent p-3 md:p-0 rounded-lg">
          Sampai ketemu di Kemang
        </div>
      </div>

      {/* Section: Akan datang */}
      <div>
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Akan datang</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md">{upcomingJadwal.length}</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Reservasi aktif</span>
        </div>

        <div className="space-y-4">
          {upcomingJadwal.map((jadwal, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">{jadwal.id}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                  <CheckCircle2 className="w-3 h-3" /> Terkonfirmasi
                </span>
              </div>
              
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
                <div className="flex gap-4 items-start">
                  <div className="bg-[#F8F9FF] text-indigo-600 rounded-xl w-14 h-14 flex flex-col justify-center items-center shrink-0 border border-indigo-50">
                    <span className="text-lg font-black leading-none">{jadwal.day}</span>
                    <span className="text-[10px] font-bold uppercase mt-0.5 tracking-wider">{jadwal.month}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1.5">{jadwal.title}</h3>
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {jadwal.date}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {jadwal.time}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:text-right flex flex-col justify-center bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                  <p className="text-xs font-semibold text-slate-700 flex items-center md:justify-end gap-1.5 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> JadwalAn Kemang
                  </p>
                  <p className="text-[10px] text-slate-500 md:ml-0 ml-5">Jl. Kemang Raya No. 10, Jakarta</p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5">Total pembayaran</p>
                  <p className="font-extrabold text-slate-900">{jadwal.price}</p>
                </div>
                {/* Tombol Lihat Detail memicu Modal */}
                <button 
                  onClick={() => setSelectedDetail(jadwal)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-slate-200 rounded-lg px-4 py-2.5 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <ArrowUpRight className="w-4 h-4" /> Lihat detail
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
          Tunjukkan kode booking saat tiba. Perubahan jadwal dapat dibantu admin paling lambat 3 jam sebelum sesi.
        </p>
      </div>

      {/* Section: Riwayat (Tetap statis) */}
      <div className="opacity-70 grayscale-[30%]">
        <div className="flex justify-between items-end mb-4 mt-8">
          <h2 className="text-lg font-bold text-slate-900">Riwayat</h2>
          <span className="text-xs text-slate-400 font-medium">12 sesi selesai</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">#JA161002</span>
            <span className="text-[10px] font-bold tracking-wide text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Selesai</span>
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1.5">PS4 · Unit 02</h3>
          <p className="text-xs text-slate-500">16 Okt 2026 • 20.00 - 22.00 WIB</p>
        </div>
      </div>


      {/* MODAL DETAIL LENGKAP */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="bg-indigo-600 p-5 flex justify-between items-start text-white">
              <div>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                  <Receipt className="w-5 h-5" /> Detail Reservasi
                </h3>
                <p className="text-indigo-200 text-xs font-medium">
                  {selectedDetail.id}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDetail(null)}
                className="text-indigo-200 hover:text-white hover:bg-indigo-500/50 p-1.5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Modal */}
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Status Banner */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-bold">Booking Terkonfirmasi</span>
              </div>

              {/* Data List */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg text-slate-400 shrink-0">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <div className="border-b border-slate-100 pb-4 w-full">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Item Reservasi</p>
                    <p className="text-sm font-bold text-slate-900">{selectedDetail.title}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg text-slate-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="border-b border-slate-100 pb-4 w-full">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Waktu Main</p>
                    <p className="text-sm font-bold text-slate-900">{selectedDetail.date}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedDetail.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-slate-50 p-2.5 rounded-lg text-slate-400 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="border-b border-slate-100 pb-4 w-full">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Lokasi</p>
                    <p className="text-sm font-bold text-slate-900">JadwalAn Kemang</p>
                    <p className="text-xs text-slate-500 mt-0.5">Jl. Kemang Raya No. 10, Jakarta Selatan</p>
                  </div>
                </div>

                <div className="flex justify-between items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Metode Bayar</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <QrCode className="w-4 h-4 text-indigo-600" /> QRIS Otomatis
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Total</p>
                    <p className="text-lg font-black text-indigo-600">{selectedDetail.price}</p>
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-center text-slate-400 mt-4">
                Tunjukkan detail ini ke admin saat kamu tiba di lokasi.
              </p>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}