// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { MessageSquare, Gamepad2 } from 'lucide-react'
import { useState } from 'react'
import { ChatModal } from './ChatModal'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 relative pb-20 md:pb-0">
      {/* Navbar - Desktop & Mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 md:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-indigo-700 font-extrabold text-xl tracking-tight">
          <Gamepad2 className="w-6 h-6" />
          JadwalAn
        </Link>
        
        {/* Navigasi Desktop */}
        <nav className="hidden md:flex items-center gap-8 font-semibold text-sm text-slate-500">
          <Link 
            to="/" 
            className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
          >
            Beranda
          </Link>
          <Link 
            to="/booking" 
            className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
          >
            Booking
          </Link>
          <Link 
            to="/jadwal" 
            className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
          >
            Jadwal Saya
          </Link>
          <Link 
            to="/promo" 
            className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
          >
            Promo
          </Link>
          <Link 
            to="/profil" 
            className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
          >
            Profil
          </Link>
        </nav>

        {/* Profil Avatar */}
        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">
          AP
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>

      {/* Komponen Chat AI Modal */}
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Floating Chat AI Button */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 bg-indigo-600 text-white px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.3)] hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2 z-50"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-semibold text-sm">Chat AI</span>
      </button>

      {/* Navigasi Mobile (Bottom Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 flex justify-between items-center text-[10px] font-semibold text-slate-500 z-40 pb-safe px-4">
        <Link 
          to="/" 
          className="flex flex-col items-center gap-1 [&.active]:text-indigo-600"
        >
          <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center [&.active]:bg-indigo-100"></div>
          Beranda
        </Link>
        <Link 
          to="/booking" 
          className="flex flex-col items-center gap-1 [&.active]:text-indigo-600"
        >
          <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center [&.active]:bg-indigo-100"></div> 
          Booking
        </Link>
        <Link 
          to="/jadwal" 
          className="flex flex-col items-center gap-1 [&.active]:text-indigo-600"
        >
          <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center [&.active]:bg-indigo-100"></div> 
          Jadwal
        </Link>
        <Link 
          to="/promo" 
          className="flex flex-col items-center gap-1 [&.active]:text-indigo-600"
        >
          <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center [&.active]:bg-indigo-100"></div> 
          Promo
        </Link>
        <Link 
          to="/profil" 
          className="flex flex-col items-center gap-1 [&.active]:text-indigo-600"
        >
          <div className="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center [&.active]:bg-indigo-100"></div> 
          Profil
        </Link>
      </nav>
    </div>
  )
}