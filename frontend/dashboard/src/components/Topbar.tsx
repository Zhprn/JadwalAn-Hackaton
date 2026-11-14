import React from 'react';
import { Home, ChevronRight, ChevronDown } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="flex items-center justify-between w-full h-16 px-6 bg-white border-b border-gray-200">
      
      {/* Bagian Kiri: Breadcrumb */}
      <div className="flex items-center gap-3">
        <button className="text-slate-500 hover:text-slate-700 transition-colors">
          <Home className="w-5 h-5" strokeWidth={2} />
        </button>
        <ChevronRight className="w-4 h-4 text-slate-400" strokeWidth={2} />
        <span className="text-sm font-semibold text-slate-800">Dashboard</span>
      </div>

      {/* Bagian Kanan: Profil User */}
      <div className="flex items-center h-full">
        {/* Garis vertikal pembatas */}
        <div className="w-px h-8 bg-gray-200 mr-6"></div>

        {/* Info Profil */}
        <button className="flex items-center gap-3 text-left focus:outline-none hover:opacity-80 transition-opacity">
          {/* Avatar Lingkaran */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50">
            <span className="text-sm font-bold text-indigo-600">AD</span>
          </div>
          
          {/* Nama & Role */}
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-800 leading-tight">
              Admin Cuku
            </span>
            <span className="text-xs text-slate-500">
              Pemilik rental
            </span>
          </div>

          {/* Ikon Dropdown */}
          <ChevronDown className="w-4 h-4 text-slate-500 ml-2" strokeWidth={2} />
        </button>
      </div>
      
    </header>
  );
}