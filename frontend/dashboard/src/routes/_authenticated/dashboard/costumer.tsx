import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  Download, 
  Users, 
  Heart, 
  UserCheck, 
  MoreHorizontal, 
  Search, 
  ArrowDownUp,
  Sparkles,
  X,
  CheckCircle2,
  RefreshCcw,
  Send,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export const Route = createFileRoute('/_authenticated/dashboard/costumer')({
  component: RouteComponent,
})

// Data mock pelanggan (10 Orang)
const initialCustomers = [
  { id: 1, initials: 'BP', name: 'Budi', phone: '0812xxx', lastPlay: '14 Hari Lalu', lastPlayColor: 'text-indigo-600 font-semibold', totalHours: '45 Jam' },
  { id: 2, initials: 'DP', name: 'Dimas', phone: '0857xxx', lastPlay: '3 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '32 Jam' },
  { id: 3, initials: 'RP', name: 'Raka', phone: '0813xxx', lastPlay: 'Hari Ini', lastPlayColor: 'text-gray-500', totalHours: '28 Jam' },
  { id: 4, initials: 'YA', name: 'Yoga', phone: '0822xxx', lastPlay: 'Hari Ini', lastPlayColor: 'text-gray-500', totalHours: '24 Jam' },
  { id: 5, initials: 'AH', name: 'Arif', phone: '0819xxx', lastPlay: '2 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '21 Jam' },
  { id: 6, initials: 'BS', name: 'Bambang', phone: '0815xxx', lastPlay: '5 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '19 Jam' },
  { id: 7, initials: 'FA', name: 'Fajar', phone: '0818xxx', lastPlay: '1 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '17 Jam' },
  { id: 8, initials: 'GI', name: 'Gani', phone: '0852xxx', lastPlay: '6 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '15 Jam' },
  { id: 9, initials: 'HD', name: 'Hadi', phone: '0878xxx', lastPlay: '4 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '12 Jam' },
  { id: 10, initials: 'IN', name: 'Indra', phone: '0896xxx', lastPlay: '7 Hari Lalu', lastPlayColor: 'text-gray-500', totalHours: '10 Jam' },
]

function RouteComponent() {
  // 1. State Search
  const [searchQuery, setSearchQuery] = React.useState('')
  
  // 2. State Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 7

  // 3. State Pelanggan Aktif
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<number>(1)

  // 4. Logika Filter Search
  const filteredCustomers = React.useMemo(() => {
    return initialCustomers.filter(cust => {
      const query = searchQuery.toLowerCase()
      return (
        cust.name.toLowerCase().includes(query) || 
        cust.phone.toLowerCase().includes(query)
      )
    })
  }, [searchQuery])

  // Reset ke halaman 1 saat sedang mencari
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // 5. Logika Slicing Pagination (hanya tampil 5 data per halaman)
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const paginatedCustomers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredCustomers, currentPage])

  // Detail pelanggan aktif untuk AI Promo
  const activeCustomer = initialCustomers.find(c => c.id === selectedCustomerId) || initialCustomers[0]

  // --- LOGIKA PESAN ---
  const [pesanIndex, setPesanIndex] = React.useState(0)

  const variasiPesan = [
    `Bro ${activeCustomer.name}! Udah 2 minggu nih absen mabar eFootball. Weekend ini rental PS Cuku Sunguik ada diskon 15% khusus member VIP kayak lu. Gass booking slotnya sekarang? 😎`,
    `Halo ${activeCustomer.name}! Kangen main eFootball gak nih? Udah 14 hari lho absen. Spesial buat lu member VIP, kita kasih promo diskon 15% weekend ini di PS Cuku Sunguik. Yuk merapat! 🎮🔥`,
    `Woy ${activeCustomer.name}, kemana aja nih 2 minggu gak keliatan mabar eFootball? Sini mampir ke PS Cuku Sunguik, mumpung ada voucher diskon 15% khusus VIP! Amankan slot lu sekarang sebelum full bosku! ⚽🙌`
  ]

  const handleVersiLain = () => {
    setPesanIndex((prevIndex) => (prevIndex + 1) % variasiPesan.length)
  }

  // --- FUNGSI EXPORT PDF ---
  const handleExportPDF = () => {
    // 1. Inisialisasi dokumen PDF (landscape agar tabel muat banyak)
    const doc = new jsPDF('landscape')
    
    // 2. Tambahkan Judul
    doc.setFontSize(18)
    doc.setTextColor(31, 41, 55) // text-gray-900 (Tailwind)
    doc.text('Daftar Pelanggan Loyal - JadwalAn', 14, 22)
    
    doc.setFontSize(11)
    doc.setTextColor(107, 114, 128) // text-gray-500 (Tailwind)
    doc.text('Rental PS Cuku Sunguik', 14, 30)

    // 3. Siapkan data untuk tabel
    // Kita ambil dari filteredCustomers supaya yg di-export sesuai hasil pencarian saat itu
    // Jika ingin ekspor SEMUA data tanpa terpengaruh pencarian, ganti dengan initialCustomers
    const tableColumn = ["No", "Nama Pelanggan", "Nomor WhatsApp", "Terakhir Main", "Total Jam Bermain"]
    const tableRows: any[] = []

    filteredCustomers.forEach((cust, index) => {
      const customerData = [
        index + 1,
        cust.name,
        cust.phone,
        cust.lastPlay,
        cust.totalHours,
      ]
      tableRows.push(customerData)
    })

    // 4. Generate Tabel menggunakan autotable
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40, // Posisi Y (vertikal) mulai tabel (dibawah judul)
      theme: 'grid',
      styles: { 
        font: 'helvetica', 
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: { 
        fillColor: [79, 70, 229], // Warna bg-indigo-600 dari Tailwind
        textColor: 255, 
        fontStyle: 'bold' 
      },
      alternateRowStyles: { 
        fillColor: [249, 250, 251] // Warna bg-gray-50 dari Tailwind
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' }, // Kolom 'No'
      }
    })

    // 5. Simpan dan otomatis unduh file PDF
    const tanggalHariIni = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
    doc.save(`Data_Pelanggan_${tanggalHariIni}.pdf`)
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)] font-sans text-gray-900">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900 flex items-center gap-2">
            Bikin pelanggan balik lagi
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Promo personal yang relevan, dibuat AI dari kebiasaan main pelanggan.
          </p>
        </div>
        <button 
          onClick={handleExportPDF} 
          className="bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 active:scale-95 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          Ekspor pelanggan
        </button>
      </div>

      {/* --- Stat Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3.5 rounded-xl text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">128</div>
            <div className="text-sm text-gray-500">Pelanggan terdaftar</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-purple-50 p-3.5 rounded-xl text-purple-600">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">24</div>
            <div className="text-sm text-gray-500">Member loyal</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-50 p-3.5 rounded-xl text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">12</div>
            <div className="text-sm text-gray-500">Perlu disapa kembali</div>
          </div>
        </div>
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        
        {/* --- Left Column: Table --- */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-3xl shadow-sm p-6 flex flex-col w-full overflow-hidden h-full">
          
          <div className="flex justify-between items-start mb-6 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pelanggan Loyal</h2>
              <p className="text-sm text-gray-500 mt-0.5">Kenali pemain terbaik rentalmu.</p>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 shrink-0">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau WhatsApp..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <button className="w-full sm:w-auto bg-white border border-gray-200 text-gray-700 font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm shrink-0">
              <ArrowDownUp className="w-4 h-4" />
              Total jam terbanyak
            </button>
          </div>

          <div className="w-full overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400">
                  <th className="pb-3 px-4 font-medium w-[25%]">Nama</th>
                  <th className="pb-3 px-4 font-medium w-[20%]">WhatsApp</th>
                  <th className="pb-3 px-4 font-medium w-[20%]">Main Terakhir</th>
                  <th className="pb-3 px-4 font-medium w-[20%]">Total Jam Main</th>
                  <th className="pb-3 px-4 font-medium w-[15%]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                      Pelanggan tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust) => {
                    const isActive = cust.id === selectedCustomerId;
                    return (
                      <tr key={cust.id} className={`${isActive ? `bg-indigo-50/40` : `hover:bg-gray-50/50`} transition-colors`}>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? `bg-indigo-600 text-white` : `bg-gray-100 text-gray-600`}`}>
                              {cust.initials}
                            </div>
                            <span className="font-bold text-sm text-gray-900 truncate">{cust.name}</span>
                          </div>
                        </td>
                        <td className="py-5 px-4 text-sm text-gray-500 truncate">{cust.phone}</td>
                        <td className={`py-5 px-4 text-sm truncate ${cust.lastPlayColor}`}>{cust.lastPlay}</td>
                        <td className="py-5 px-4 text-sm font-bold text-gray-900 truncate">{cust.totalHours}</td>
                        <td className="py-5 px-4 text-right sm:text-left">
                          <button 
                            onClick={() => setSelectedCustomerId(cust.id)}
                            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm w-full sm:w-auto whitespace-nowrap ${
                              isActive 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Promo WA
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-auto pt-6 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium shrink-0">
            <span>
              Menampilkan {paginatedCustomers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} dari {filteredCustomers.length} pelanggan
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold transition-colors ${
                    currentPage === page 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* --- Right Column: AI Promo Generator --- */}
        <div className="bg-white border-2 border-indigo-50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between relative w-full h-full">
          
          <div>
            {/* Header AI Panel */}
            <div className="bg-indigo-50/50 p-5 px-6 border-b border-indigo-100 flex justify-between items-center rounded-t-3xl">
              <div className="flex items-center gap-2 text-indigo-600 font-bold">
                <Sparkles className="w-5 h-5" />
                AI Promo Generator
              </div>
              <button className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              
              {/* Customer Info Box */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    {activeCustomer.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{activeCustomer.name}</h3>
                    <p className="text-xs text-gray-500">VIP • {activeCustomer.totalHours} main • {activeCustomer.phone}</p>
                  </div>
                </div>
                <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Loyal
                </span>
              </div>

              {/* Progress/Status */}
              <div className="mb-6">
                <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-2">
                  <span>Menganalisis riwayat {activeCustomer.name}...</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-indigo-600 w-full rounded-full"></div>
                </div>
                <div className="text-[11px] font-medium text-emerald-500">
                  Analisis selesai · Promo personal siap dikirim
                </div>
              </div>

              {/* Tags/Keywords */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> PS
                </span>
                <span className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Absen 14 hari
                </span>
                <span className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Diskon 15%
                </span>
              </div>

              {/* Generated Message Draft */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 mb-4">
                <div className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase mb-3">
                  Draf Pesan WhatsApp
                </div>
                <p className="text-sm text-gray-800 leading-relaxed min-h-[80px]">
                  {variasiPesan[pesanIndex]}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-center mb-6">
                <button 
                  onClick={handleVersiLain}
                  className="text-indigo-600 text-sm font-semibold flex items-center gap-2 hover:text-indigo-700 transition-colors active:scale-95"
                >
                  <RefreshCcw className="w-4 h-4" /> Buat versi lain
                </button>
              </div>

            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="p-6 pt-0">
            <div className="flex flex-col gap-2.5 mb-4 w-full">
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
                <Send className="w-4 h-4 shrink-0" /> Kirim via WA Web
              </button>
              <button className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors">
                <Copy className="w-4 h-4 shrink-0" /> Salin Teks
              </button>
            </div>

            <p className="text-center text-[11px] font-medium text-gray-400">
              Pesan belum dikirim. Tinjau draf sebelum membuka WhatsApp Web.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}