// src/components/ChatModal.tsx
import { X, Bot, Headphones, Send, Maximize2 } from 'lucide-react'
import { useState } from 'react'

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const [message, setMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  // Fungsi untuk menutup modal:
  // Trigger animasi tutup dulu, baru reset ukuran ke kecil di balik layar
  const handleClose = () => {
    onClose()
    setTimeout(() => {
      setIsExpanded(false)
    }, 400) // Sesuaikan dengan durasi animasi CSS (400ms)
  }

  // Pengaturan Class untuk Animasi yang Super Smooth
  const modalClasses = `
    fixed z-[100] flex flex-col bg-white overflow-hidden font-sans shadow-[0_8px_30px_rgb(0,0,0,0.12)]
    transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom-right
    ${isExpanded 
      ? 'bottom-0 right-0 w-full h-[100dvh] rounded-none border-0' 
      : 'bottom-24 right-4 md:bottom-28 md:right-8 w-[350px] md:w-[400px] h-[550px] rounded-2xl border border-slate-100'
    }
    ${isOpen 
      ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto visible' 
      : 'opacity-0 translate-y-12 scale-90 pointer-events-none invisible'
    }
  `

  return (
    <div className={modalClasses}>
      {/* Header (Tingginya tetap) */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Asisten JadwalAn</h3>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Admin Rani sedang membantu
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {!isExpanded && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
              title="Perbesar Layar"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          
          <button 
            onClick={handleClose}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
            title="Tutup Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Area - Menggunakan flex-1 agar tingginya otomatis beradaptasi dengan mulus saat modal membesar */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-hide">
        <div className="text-center text-[10px] font-medium text-slate-400 mt-2 mb-4">
          Hari ini • 13.42 WIB
        </div>

        {/* User Message */}
        <div className="flex justify-end">
          <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] leading-relaxed">
            PS5 jam 14.00 hari ini masih kosong?
          </div>
        </div>

        {/* AI Message */}
        <div className="flex justify-start flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 ml-1">AI JadwalAn</span>
          <div className="bg-[#F8F9FF] text-slate-700 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] leading-relaxed border border-slate-50">
            Masih, Andi! PS5 - Unit 03 di Kemang kosong pukul 14.00 - 15.00. Harganya Rp30.000 untuk 1 sesi.
          </div>
        </div>

        {/* User Message */}
        <div className="flex justify-end">
          <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] leading-relaxed">
            Bisa tambah controller? Hubungkan ke admin, ya.
          </div>
        </div>

        {/* System Notification: Take Over */}
        <div className="flex justify-center my-4">
          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full">
            <Headphones className="w-3 h-3" />
            Terhubung dengan admin manusia
          </span>
        </div>

        {/* Admin Message */}
        <div className="flex justify-start flex-col gap-1">
          <span className="text-[10px] font-bold text-emerald-700 ml-1">Admin (Human) • Rani</span>
          <div className="bg-emerald-50/50 text-slate-700 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] leading-relaxed border border-emerald-100/50">
            Halo, Andi! Unit 03 sudah termasuk 2 controller. Tambahan controller tersedia Rp10.000. Mau saya bantu booking?
          </div>
          <span className="text-[9px] text-slate-400 text-right mt-0.5 mr-1">13.44 • Baru saja</span>
        </div>
      </div>

      {/* Input Area (Tingginya tetap, menempel di bawah) */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        {/* Quick Prompts */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          <button className="text-[11px] font-semibold text-indigo-600 border border-indigo-100 bg-white px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-indigo-50 transition-colors">
            Cek jadwal kosong
          </button>
          <button className="text-[11px] font-semibold text-indigo-600 border border-indigo-100 bg-white px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-indigo-50 transition-colors">
            Promo hari ini
          </button>
          <button className="text-[11px] font-semibold text-indigo-600 border border-indigo-100 bg-white px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-indigo-50 transition-colors">
            Hubungi admin
          </button>
        </div>

        {/* Text Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Tulis pesanmu di sini..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all text-slate-700 placeholder:text-slate-400"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && message.trim()) setMessage('')
            }}
          />
          <button 
            className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!message.trim()}
            onClick={() => {
              if (message.trim()) setMessage('')
            }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-center text-[9px] text-slate-400 mt-3">
          AI untuk jawaban cepat. Admin untuk bantuan personal.
        </p>
      </div>
    </div>
  )
}