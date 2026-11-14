import { createFileRoute } from '@tanstack/react-router'
import { 
  Search, 
  Paperclip, 
  Send, 
  Bot, 
  CalendarDays, 
  ArrowUpRight, 
  Hand,
  CheckCheck
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/dashboard/livechat')({
  component: LiveChatPage,
})

export default function LiveChatPage() {
  // Data dummy daftar chat
  const chatList = [
    { id: 'FR', name: 'Fajar Ramadhan', source: 'WhatsApp', time: '13:42', msg: 'Siap! Booking berhasil dicatat...', unread: false, isAI: true, active: true, phone: '+62 812-9087-2145' },
    { id: 'RP', name: 'Raka Pratama', source: 'WhatsApp', time: '13:35', msg: 'Oke, sampai ketemu bang!', unread: false, isAI: false, active: false, phone: '+62 856-1234-5678' },
    { id: 'DN', name: 'Dina Nabila', source: 'Web', time: '13:28', msg: 'Kalau PS4 berapa per jam?', unread: false, isAI: false, active: false, phone: 'Guest' },
    { id: 'AH', name: 'Arif Hidayat', source: 'WhatsApp', time: '13:12', msg: 'Saya ambil jam 5 sore ya', unread: false, isAI: false, active: false, phone: '+62 822-9876-5432' },
    { id: 'YA', name: 'Yoga Aditya', source: 'Web', time: '12:58', msg: 'Makasih bang, seru banget!', unread: false, isAI: false, active: false, phone: 'Guest' },
    { id: 'BP', name: 'Budi Prasetyo', source: 'WhatsApp', time: '12:30', msg: 'Ada eFootball terbaru bang?', unread: false, isAI: false, active: false, phone: '+62 813-5555-6666' },
  ];

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-7rem)] max-w-7xl mx-auto">
      
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Live Booking Chat</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau percakapan, biarkan AI mengurus reservasinya.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-semibold text-emerald-600">Semua channel terhubung</span>
        </div>
      </div>

      {/* 2. CHAT LAYOUT (MAIN CONTAINER) */}
      <div className="flex bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0">
        
        {/* === LEFT COLUMN: CHAT LIST === */}
        <div className="w-[320px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
          {/* Header Kotak Masuk */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Kotak masuk</h2>
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 inline-block bg-indigo-500 rounded-full mr-1"></span>
              4 baru
            </span>
          </div>

          {/* Search Bar */}
          <div className="p-4 pt-3 pb-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Cari percakapan..." 
                className="w-full bg-slate-50 text-sm border-none rounded-lg pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* List Chat */}
          <div className="flex-1 overflow-y-auto">
            {chatList.map((chat, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 p-4 cursor-pointer border-b border-gray-50 transition-colors ${
                  chat.active ? 'bg-indigo-50/40 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {chat.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{chat.name}</h3>
                    <span className="text-[10px] text-slate-400">{chat.time}</span>
                  </div>
                  <p className={`text-xs truncate ${chat.active ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                    {chat.msg}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${chat.source === 'WhatsApp' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                      {chat.source}
                    </span>
                    {chat.isAI && (
                      <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1 before:content-['·'] before:text-slate-300">
                        Ditangani AI
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === RIGHT COLUMN: ACTIVE CHAT === */}
        <div className="flex-1 flex flex-col bg-[#F8F9FA]/50 relative">
          
          {/* Active Chat Header */}
          <div className="h-[72px] bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                FR
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 leading-tight">Fajar Ramadhan</h2>
                <p className="text-xs text-slate-500 mt-0.5">WhatsApp · +62 812-9087-2145</p>
              </div>
            </div>
            <button className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
              <Hand className="w-3.5 h-3.5" /> Take Over
            </button>
          </div>

          {/* AI Banner */}
          <div className="bg-indigo-50/80 px-6 py-2 flex items-center gap-2 border-b border-indigo-100 flex-shrink-0">
            <Bot className="w-4 h-4 text-indigo-600" />
            <p className="text-[11px] font-semibold text-indigo-700">
              AI sedang menangani percakapan ini. Kamu bisa mengambil alih kapan saja.
            </p>
          </div>

          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            {/* Date separator */}
            <div className="flex justify-center">
              <span className="text-[10px] font-medium text-slate-400">Hari ini, 21 Oktober 2026</span>
            </div>

            {/* Bubble User 1 */}
            <div className="flex justify-end">
              <div className="bg-white border border-gray-100 shadow-sm text-slate-700 p-3.5 rounded-2xl rounded-tr-sm max-w-[70%] text-sm">
                <p>Bang, PS5 jam 2 siang kosong buat 3 jam?</p>
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-slate-400">13:40</span>
                </div>
              </div>
            </div>

            {/* Bubble AI 1 */}
            <div className="flex items-end gap-3 max-w-[75%]">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mb-4 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] font-bold text-indigo-600 ml-1">Jadwal.an AI</span>
                <div className="bg-indigo-50/80 border border-indigo-100 text-indigo-900 p-3.5 rounded-2xl rounded-tl-sm text-sm">
                  <p>Halo bro! Waduh jam 2 siang PS5 lagi full semua nih. Tapi jam 4 sore kosong kok. Mau di-keep dulu slot jam 4 nya? 🎮</p>
                  <div className="flex justify-end mt-1 gap-1 items-center">
                    <span className="text-[10px] text-indigo-400">13:40</span>
                    <CheckCheck className="w-3 h-3 text-indigo-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bubble User 2 */}
            <div className="flex justify-end">
              <div className="bg-white border border-gray-100 shadow-sm text-slate-700 p-3.5 rounded-2xl rounded-tr-sm max-w-[70%] text-sm">
                <p>Boleh bang, keep yang jam 4 ya.</p>
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-slate-400">13:41</span>
                </div>
              </div>
            </div>

            {/* Bubble AI 2 */}
            <div className="flex items-end gap-3 max-w-[75%]">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mb-4 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[10px] font-bold text-indigo-600 ml-1">Jadwal.an AI</span>
                <div className="bg-indigo-50/80 border border-indigo-100 text-indigo-900 p-3.5 rounded-2xl rounded-tl-sm text-sm">
                  <p>Siap! Booking berhasil dicatat untuk jam 16:00 - 19:00. Ditunggu kedatangannya ya bro! ✨</p>
                  <div className="flex justify-end mt-1 gap-1 items-center">
                    <span className="text-[10px] text-indigo-400">13:42</span>
                    <CheckCheck className="w-3 h-3 text-indigo-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* System Action Card (Booking Saved) */}
            <div className="flex justify-center mt-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 w-full max-w-[90%] flex items-center justify-between cursor-pointer hover:bg-emerald-100/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800">Booking tersimpan - PS5 - TV 1</h4>
                    <p className="text-[10px] text-emerald-600/80 mt-0.5">16:00 - 19:00 · 3 jam · Rp60.000</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
            </div>

          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3 bg-slate-50 border border-gray-200 rounded-xl px-4 py-2">
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <input 
                type="text" 
                placeholder="Ambil alih untuk membalas pesan..." 
                className="flex-1 bg-transparent text-sm py-1.5 outline-none text-slate-700 placeholder:text-slate-400"
              />
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}