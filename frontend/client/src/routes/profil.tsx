// src/routes/profil.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Phone, ChevronRight, Headphones, MessageSquare, LogOut, UserCog } from 'lucide-react'

export const Route = createFileRoute('/profil')({
  component: Profil,
})

function Profil() {
  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8">
      {/* Header Info */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Profil Saya</h1>
        <p className="text-slate-500 text-sm">Sedikit tentang kamu dan waktu bermainmu.</p>
      </div>

      {/* Kartu Profil Utama */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
        
        {/* Info Pengguna & Tombol Edit */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-xl font-black text-indigo-600 border border-indigo-100 shrink-0">
              AP
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Andi Pratama</h2>
              <p className="text-xs text-slate-500 mt-0.5">Member sejak Mei 2026</p>
            </div>
          </div>

          <button className="flex items-center justify-between md:justify-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-xl text-slate-600 group-hover:text-indigo-600 transition-colors">
                <UserCog className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Edit profil</p>
                <p className="text-[10px] text-slate-500">Perbarui nama dan nomor WhatsApp</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Nomor WhatsApp */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Nomor WhatsApp</p>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Phone className="w-4 h-4 text-slate-400" />
            +62 812-3456-7890
          </div>
        </div>

        <hr className="border-slate-100 my-2" />

        {/* Statistik Bermain */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 md:items-center">
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1">Total jam bermain</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-indigo-600 tracking-tighter">48</span>
              <span className="text-xs font-semibold text-slate-500">jam</span>
            </div>
          </div>
          
          <div className="hidden md:block w-px h-12 bg-slate-100"></div>
          
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1">Sesi selesai</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-900 tracking-tighter">12</span>
              <span className="text-xs font-semibold text-slate-500">sesi</span>
            </div>
          </div>

          <div className="hidden md:block w-px h-12 bg-slate-100"></div>

          <div className="md:flex-1 bg-slate-50 p-4 rounded-xl">
            <p className="text-sm font-bold text-slate-900 mb-1">Waktu seru yang terkumpul.</p>
            <p className="text-[10px] text-slate-500">Terima kasih sudah main bersama kami.</p>
          </div>
        </div>
      </div>

      {/* Bagian Akun & Bantuan */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Akun & bantuan</h3>
        
        {/* Banner Bantuan */}
        <div className="bg-[#F8F9FF] border border-indigo-50 rounded-3xl p-6 md:p-8 flex flex-col gap-6">
          <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
            <Headphones className="w-5 h-5" />
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 text-base mb-1.5">Kami siap membantu.</h4>
            <p className="text-xs text-slate-500 leading-relaxed md:max-w-md">
              Dari ubah jadwal sampai cari slot kosong, tanya asisten atau admin kami.
            </p>
          </div>

          <button className="bg-white text-indigo-600 font-bold text-sm px-6 py-3.5 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors w-full md:w-auto">
            <MessageSquare className="w-4 h-4" /> Hubungi kami
          </button>
          
          <p className="text-[10px] text-slate-400 font-medium">
            Admin online • 10.00 - 23.00 WIB
          </p>
        </div>
      </div>

      {/* Tombol Logout & Footer */}
      <div className="pt-4 flex flex-col md:flex-row justify-between md:items-end gap-6">
        <div>
          <button className="flex items-center justify-center gap-2 text-red-600 text-xs font-bold px-6 py-3 border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors w-full md:w-auto bg-white">
            <LogOut className="w-4 h-4" /> Keluar akun
          </button>
          <p className="text-[10px] text-slate-400 mt-4 text-center md:text-left">
            JadwalAn versi 2.0 • Dibuat untuk waktu bermainmu.
          </p>
        </div>
      </div>
    </div>
  )
}