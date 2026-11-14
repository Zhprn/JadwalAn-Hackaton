// src/components/PaymentQRIS.tsx
import { Check, QrCode, Clock, Download, RefreshCcw, Info } from 'lucide-react'
import { useState, useEffect } from 'react'

interface PaymentQRISProps {
  bookingData: {
    unit: string
    date: string
    time: string
    duration: number
    subtotal: number
    discountAmount: number
    total: number
    promoCode: string
  }
  onSuccess: () => void
  onCancel: () => void
}

export function PaymentQRIS({ bookingData, onSuccess, onCancel }: PaymentQRISProps) {
  // Simulasi Timer (27 Menit 41 Detik)
  const [timeLeft, setTimeLeft] = useState(27 * 60 + 41)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const seconds = (timeLeft % 60).toString().padStart(2, '0')

  // Fungsi Cek Status (Simulasi)
  const handleCheckStatus = () => {
    setIsChecking(true)
    setTimeout(() => {
      setIsChecking(false)
      onSuccess() // Simulasi berhasil setelah dicek
    }, 2000)
  }

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Progress Bar (Custom Header untuk Pembayaran) */}
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 text-sm font-semibold">
        <div className="flex items-center gap-2 text-emerald-600">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline">Pilih jadwal</span>
        </div>
        <div className="w-8 md:w-12 h-px bg-emerald-600"></div>
        <div className="flex items-center gap-2 text-blue-600">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">2</div>
          <span className="hidden sm:inline">Bayar</span>
        </div>
        <div className="w-8 md:w-12 h-px bg-slate-200"></div>
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">3</div>
          <span className="hidden sm:inline">Selesai</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* KOLOM KIRI: QRIS */}
        <div className="flex-[1.2] bg-white rounded-[2rem] border border-slate-200 p-8 md:p-10 shadow-sm flex flex-col items-center text-center">
          <div className="bg-orange-50 text-orange-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            Menunggu pembayaran
          </div>
          
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">Scan QRIS untuk membayar</h2>
          <p className="text-slate-500 text-sm mb-8">Gunakan GoPay, OVO, DANA, ShopeePay, atau m-banking apa pun.</p>
          
          {/* QR Image Placeholder */}
          <div className="w-64 h-64 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mb-8 relative p-4">
            {/* Menggunakan Icon sebagai placeholder QR besar */}
            <QrCode className="w-full h-full text-slate-800" strokeWidth={1} />
          </div>

          <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-widest">Total pembayaran</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter mb-8">
            Rp{bookingData.total.toLocaleString('id-ID')}
          </p>

          <div className="w-full bg-orange-50/80 text-orange-700 text-sm font-bold p-4 rounded-xl flex items-center justify-center gap-2 mb-6 border border-orange-100">
            <Clock className="w-4 h-4" /> Bayar dalam {minutes}:{seconds} <span className="font-normal text-orange-600 hidden sm:inline">sebelum booking batal otomatis</span>
          </div>

          <div className="flex flex-col sm:flex-row w-full gap-3">
            <button className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Simpan QR
            </button>
            <button 
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="flex-[1.5] bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <RefreshCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} /> 
              {isChecking ? 'Mengecek...' : 'Cek status pembayaran'}
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 mt-5">
            Status dicek otomatis setiap beberapa detik (GET /payments/:bookingId).
          </p>
        </div>

        {/* KOLOM KANAN: DETAIL & INSTRUKSI */}
        <div className="flex-1 space-y-4">
          
          {/* Card 1: Rincian Booking */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kode Booking</p>
              <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> pending
              </span>
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-wide">JA261115K3DQ</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Unit</span>
                <span className="font-bold text-slate-900">{bookingData.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-bold text-slate-900">{bookingData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jam</span>
                <span className="font-bold text-slate-900">{bookingData.time} ({bookingData.duration} jam)</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-100">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-900">Rp{bookingData.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {bookingData.promoCode && (
                <div className="flex justify-between items-center">
                  <div className="text-slate-500 flex items-center gap-2">
                    Promo <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{bookingData.promoCode}</span>
                  </div>
                  <span className="font-bold text-emerald-600">-Rp{bookingData.discountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-2">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-xl font-black text-slate-900">Rp{bookingData.total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Cara Bayar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-4">Cara bayar</h4>
            <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2.5">
              <li>Buka aplikasi e-wallet atau m-banking.</li>
              <li>Pilih menu Scan / QRIS, arahkan ke kode di samping.</li>
              <li>Pastikan nominal Rp{bookingData.total.toLocaleString('id-ID')}, lalu konfirmasi.</li>
            </ol>
          </div>

          {/* Card 3: Setelah Dibayar Info */}
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex gap-3 shadow-sm">
            <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm mt-0.5">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h5 className="font-bold text-emerald-800 text-sm">Setelah dibayar</h5>
              <p className="text-xs text-emerald-700/80 mt-0.5 leading-relaxed">
                Badge berubah ke confirmed, tampil tombol "Lihat booking saya".
              </p>
            </div>
          </div>

          {/* Actions Bottom */}
          <div className="pt-4 flex flex-col gap-4 items-center">
            <button 
              onClick={onCancel} // Di app asli ini mungkin route ke history
              className="text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors"
            >
              Bayar nanti, ke Booking Saya
            </button>
            <button 
              onClick={onCancel}
              className="w-full bg-white border border-red-200 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-50 transition-colors shadow-sm"
            >
              Batalkan booking
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}