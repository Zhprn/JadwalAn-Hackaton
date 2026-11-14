// src/routes/booking.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Check, MonitorPlay, Gamepad2, ArrowRight, Minus, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'

// Import komponen pembayaran yang baru dibuat
import { PaymentQRIS } from '../components/PaymentQRIS'

export const Route = createFileRoute('/booking')({
  component: BookingPage,
})

function BookingPage() {
  const navigate = useNavigate()

  // State Step
  const [step, setStep] = useState<'form' | 'payment'>('form')

  // State Waktu Main
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('18:00')

  // State Promo & Pembayaran
  const [promoCode, setPromoCode] = useState('WEEKEND20')
  const [isPromoApplied, setIsPromoApplied] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'kasir'>('qris')
  
  // Data Mockup untuk UI
  const dates = [
    { day: 'Sab', date: '14', status: 'Hari ini', isActive: false },
    { day: 'Min', date: '15', status: 'Promo', isActive: true },
    { day: 'Sen', date: '16', status: '', isActive: false },
    { day: 'Sel', date: '17', status: '', isActive: false },
    { day: 'Rab', date: '18', status: '', isActive: false },
  ]
  const timeSlots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

  // Kalkulasi Harga
  const calculateDuration = () => {
    const startHour = parseInt(startTime.split(':')[0])
    const endHour = parseInt(endTime.split(':')[0])
    let diff = endHour - startHour
    if (diff < 1 || isNaN(diff)) return 1
    return diff
  }
  const duration = calculateDuration()
  const pricePerHour = 15000
  const subtotal = pricePerHour * duration
  const discountAmount = isPromoApplied ? subtotal * 0.2 : 0
  const total = subtotal - discountAmount

  // Handlers
  const handleStartTimeChange = (val: string) => {
    setStartTime(val)
    const newStartHour = parseInt(val.split(':')[0])
    if (!isNaN(newStartHour)) {
      const newEndHour = newStartHour + 2
      setEndTime(`${newEndHour.toString().padStart(2, '0')}:00`)
    }
  }

  const handlePaymentSuccess = () => {
    localStorage.setItem('jadwalBaru', JSON.stringify({
      id: "JA261115K3DQ",
      unit: "TV 1",
      time: `${startTime.replace(':', '.')} - ${endTime.replace(':', '.')} WIB · ${duration} jam`,
      price: `Rp${total.toLocaleString('id-ID')}`,
      date: "Minggu, 15 November 2026"
    }))
    sessionStorage.removeItem('pendingBooking')
    navigate({ to: '/jadwal' })
  }

  const handleCancelPayment = () => {
    setStep('form') // Kembali ke form jika dibatalkan
  }

  // Objek data yang dilempar ke komponen PaymentQRIS
  const bookingDetails = {
    unit: 'PS5 - TV 1',
    date: 'Minggu, 15 Nov 2026',
    time: `${startTime}-${endTime} WIB`,
    duration,
    subtotal,
    discountAmount,
    total,
    promoCode: isPromoApplied ? promoCode : ''
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-12 pt-4 px-4 md:px-8 font-sans">
      <div className="max-w-[1200px] mx-auto">
        
        {/* Header Section (Hanya tampil di Step 1) */}
        {step === 'form' && (
          <>
            <button 
              onClick={() => navigate({ to: '/' })}
              className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors mb-6"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali
            </button>

            <div className="mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Pilih jadwal main</h1>
              <p className="text-slate-500 text-sm">
                Jam buka 10:00–23:00 WIB · booking minimal 30 menit sebelum mulai · durasi 1–8 jam
              </p>
            </div>
          </>
        )}

        {/* TAMPILAN STEP 1: FORM */}
        {step === 'form' && (
          <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-left-4 duration-300">
            {/* KOLOM KIRI */}
            <div className="flex-1 space-y-6">
              
              {/* Navigasi Tanggal */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900">November 2026</h2>
                  <div className="flex gap-2">
                    <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
                    <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {dates.map((d, i) => (
                    <button key={i} className={`min-w-[4.5rem] rounded-2xl p-3 flex flex-col items-center justify-center transition-all ${d.isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                      <span className={`text-xs ${d.isActive ? 'text-blue-100' : 'text-slate-400'}`}>{d.day}</span>
                      <span className="text-xl font-bold my-0.5">{d.date}</span>
                      {d.status && <span className={`text-[10px] font-semibold mt-1 ${d.isActive ? 'text-white' : 'text-slate-400'}`}>{d.status}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* List Console */}
              <div className="bg-white rounded-2xl border-2 border-blue-600 p-5 md:p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <MonitorPlay className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">PS5 - TV 1</h3>
                      <p className="text-xs text-slate-500 mt-0.5">TV 50" 4K · maks 4 pemain</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">Rp15.000</span><span className="text-xs text-slate-500">/jam</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {timeSlots.map((time, idx) => {
                    let stateClass = "border-slate-200 text-slate-700 hover:border-blue-400 bg-white" 
                    if (time === '10:00' || time === '11:00') stateClass = "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed line-through"
                    else if (time === startTime) stateClass = "bg-blue-600 text-white border-blue-600 shadow-sm"
                    else if (time > startTime && time < endTime) stateClass = "bg-blue-100 text-blue-700 border-blue-200" 
                    return (
                      <button key={idx} onClick={() => handleStartTimeChange(time)} className={`py-2 text-xs font-semibold rounded-xl border transition-all ${stateClass}`}>{time}</button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* KOLOM KANAN (Ringkasan) */}
            <div className="w-full lg:w-[400px]">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
                <div className="bg-[#0F172A] p-6 text-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ringkasan Booking</p>
                  <h3 className="text-xl font-bold mb-1">PS5 – TV 1</h3>
                  <p className="text-sm text-slate-300">Minggu, 15 Nov 2026 · {startTime}–{endTime} WIB</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Durasi */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Waktu Main</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Mulai</label>
                        <input type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="mt-5 w-3 h-px bg-slate-300 shrink-0"></div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Selesai</label>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* Promo & Harga */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Kode promo</label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500" />
                      <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50">Pakai</button>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Rp15.000 x {duration} jam</span><span className="font-semibold text-slate-900">Rp{subtotal.toLocaleString('id-ID')}</span></div>
                    {isPromoApplied && <div className="flex justify-between text-sm"><span className="text-slate-500">Diskon {promoCode}</span><span className="font-semibold text-emerald-600">-Rp{discountAmount.toLocaleString('id-ID')}</span></div>}
                    <div className="border-t border-slate-200 pt-3 flex justify-between items-center"><span className="font-bold text-slate-900">Total</span><span className="text-2xl font-black text-slate-900">Rp{total.toLocaleString('id-ID')}</span></div>
                  </div>

                  <button 
                    onClick={() => setStep('payment')}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    Booking & bayar Rp{total.toLocaleString('id-ID')} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAMPILAN STEP 2: KOMPONEN QRIS DARI COMPONENTS FOLDER */}
        {step === 'payment' && (
          <PaymentQRIS 
            bookingData={bookingDetails}
            onSuccess={handlePaymentSuccess}
            onCancel={handleCancelPayment}
          />
        )}

      </div>
    </div>
  )
}