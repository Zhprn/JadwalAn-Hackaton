import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MonitorPlay, CheckCircle2, ArrowUpRight, Gamepad2, TicketPercent, Star } from "lucide-react";
import { bookingApi, publicApi } from "@/services/api";
import { useAuth } from "@/auth";
import { Spinner } from "@/components/ui-bits";
import { addDays, dateFromStr, fmtDate, fmtDateLong, fmtRange, rupiah, todayJkt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

const DAY = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function slotDesc(start: string) {
  const h = Number(start.split(":")[0]);
  if (h < 12) return "Mulai hari lebih seru";
  if (h < 15) return "Pas untuk jeda siang";
  if (h < 18) return "Mabar sore bareng teman";
  if (h < 21) return "Tutup hari dengan mabar";
  return "Sesi malam yang tenang";
}

function Index() {
  const auth = useAuth();
  const today = todayJkt();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<"PS5" | "PS4" | "">("");

  const settings = useQuery({ queryKey: ["settings"], queryFn: publicApi.settings });
  const availability = useQuery({ queryKey: ["availability", date, category], queryFn: () => publicApi.availability(date, category || undefined), refetchInterval: 60_000 });
  const promos = useQuery({ queryKey: ["promos"], queryFn: publicApi.promos });
  const reviews = useQuery({ queryKey: ["reviews", "home"], queryFn: () => publicApi.reviews({ limit: 3 }) });
  const upcoming = useQuery({
    queryKey: ["my-bookings", "upcoming", "next"],
    queryFn: () => bookingApi.mine({ status: "upcoming", limit: 1 }),
    enabled: auth.isAuthenticated,
  });
  const next = upcoming.data?.data[0];

  // Satu kartu per unit: slot kosong pertama + berapa jam bisa dimainkan.
  const cards = useMemo(() => {
    const av = availability.data;
    if (!av || av.closed) return [];
    return av.stations
      .map((s) => ({ ...s, first: s.slots.find((x) => x.available) }))
      .filter((s) => s.first)
      .slice(0, 6);
  }, [availability.data]);

  const dateChips = [0, 1, 2].map((i) => {
    const d = addDays(today, i);
    return { d, label: i === 0 ? "Hari ini" : i === 1 ? "Besok" : DAY[dateFromStr(d).getDay()] };
  });

  return (
    <div className="space-y-12 pb-24 md:pb-10 relative">
      {/* Hero */}
      <div className="bg-[#F8F9FF] rounded-[2rem] p-6 md:p-12 relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          <p className="text-indigo-600 font-bold text-xs tracking-widest mb-4">WAKTUNYA MAIN, BUKAN MENUNGGU</p>
          <h1 className="text-4xl md:text-[3.5rem] font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
            Jadwal pasti.
            <br />
            Main lebih santai.
          </h1>
          <p className="text-slate-500 md:text-lg text-sm mb-8 max-w-md">Dari mabar sampai cetak gol, booking tempat favoritmu dalam hitungan menit.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/booking" className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md">
              Booking sekarang
            </Link>
            <Link to="/promo" className="bg-white text-indigo-600 border border-indigo-100 px-6 py-3 rounded-xl text-sm font-bold hover:bg-indigo-50">
              Lihat promo
            </Link>
          </div>
        </div>

        <div className="mt-8 md:mt-0 md:absolute md:top-1/2 md:-translate-y-1/2 md:right-12 bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-50 w-full md:w-80 z-10 hover:-translate-y-1 transition-transform">
          {next ? (
            <Link to="/jadwal" className="block">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">JADWAL TERDEKATMU</span>
                <ArrowUpRight className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                  <MonitorPlay className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{next.station.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fmtDate(next.startTime)} • {fmtRange(next.startTime, next.endTime)}
                  </p>
                  <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{next.bookingCode}</p>
                </div>
              </div>
            </Link>
          ) : (
            <div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">JAM BUKA HARI INI</span>
              <p className="text-2xl font-black text-slate-900 mt-2">
                {settings.data ? `${settings.data.openTime} – ${settings.data.closeTime}` : "–"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {availability.data?.stations.reduce((s, x) => s + x.availableCount, 0) ?? 0} slot kosong {date === today ? "hari ini" : fmtDate(dateFromStr(date))}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter Konsol */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-4">Pilih keseruanmu</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(
            [
              ["", "Semua konsol"],
              ["PS5", "PlayStation 5"],
              ["PS4", "PlayStation 4"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v || "all"}
              type="button"
              onClick={() => setCategory(v)}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                category === v ? "bg-indigo-600 text-white shadow-md hover:bg-indigo-700" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Slot kosong */}
      <div>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Slot kosong {date === today ? "hari ini" : ""}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-600 font-semibold bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-fit">
              <Calendar className="w-4 h-4 text-indigo-600" />
              {fmtDateLong(dateFromStr(date))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dateChips.map((c) => (
              <button
                key={c.d}
                type="button"
                onClick={() => setDate(c.d)}
                className={cn("text-sm font-semibold px-3 py-1.5 rounded-lg", date === c.d ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50")}
              >
                {c.label}
              </button>
            ))}
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Ganti tanggal"
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
            />
          </div>
        </div>

        {availability.isLoading ? (
          <Spinner label="Mencari slot kosong..." />
        ) : availability.data?.closed ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center text-sm text-slate-500">Rental tutup pada tanggal ini. Coba tanggal lain, ya!</div>
        ) : !cards.length ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center text-sm text-slate-500">Semua unit penuh untuk tanggal ini. Coba tanggal atau konsol lain.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {cards.map(({ station, first, availableCount }) => (
              <div key={station.id} className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-indigo-600 hover:shadow-lg transition-all group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex gap-3 items-center">
                      <div className="text-indigo-600 bg-indigo-50 p-2.5 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <MonitorPlay className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{station.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {station.category} • maks {station.maxPlayers} pemain
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {availableCount} slot
                    </span>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{first!.start}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {slotDesc(first!.start)} • bisa sampai {first!.maxHours} jam
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <div className="font-extrabold text-slate-900 text-lg">{rupiah(station.pricePerHour)}</div>
                    <div className="text-[10px] text-slate-400 font-medium">per jam</div>
                  </div>
                  <Link
                    to="/booking"
                    search={{ date, stationId: station.id, start: first!.start }}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-sm"
                  >
                    Booking
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promo */}
      {!!promos.data?.length && (
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-slate-900">Promo berlaku</h2>
            <Link to="/promo" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Semua promo →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {promos.data.slice(0, 2).map((p, i) => (
              <Link
                to="/booking"
                search={{ promo: p.code }}
                key={p.id}
                className={cn("rounded-3xl p-6 flex items-center justify-between gap-4 transition-transform hover:-translate-y-0.5", i === 0 ? "bg-indigo-600 text-white" : "bg-white border border-slate-200")}
              >
                <div>
                  <p className={cn("font-extrabold text-lg", i === 0 ? "text-white" : "text-slate-900")}>{p.title ?? p.code}</p>
                  <p className={cn("text-sm mt-1 line-clamp-2", i === 0 ? "text-indigo-100" : "text-slate-500")}>{p.description}</p>
                  <span className={cn("inline-block mt-3 font-mono font-bold text-xs px-2.5 py-1 rounded-md", i === 0 ? "bg-white/15" : "bg-indigo-50 text-indigo-700")}>{p.code}</span>
                </div>
                <div className={cn("text-4xl font-black tracking-tight shrink-0", i === 0 ? "text-white" : "text-indigo-600")}>
                  {p.discountType === "percent" ? `${p.discountPercentage}%` : `-${Math.round(p.discountAmount / 1000)}rb`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Ulasan */}
      {!!reviews.data?.data.length && (
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-slate-900">Kata mereka</h2>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> <b className="text-slate-900">{Number(reviews.data.meta.average ?? 0).toFixed(1)}</b> dari{" "}
              {String(reviews.data.meta.count ?? reviews.data.meta.total)} ulasan
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviews.data.data.map((r) => (
              <figure key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex gap-0.5 mb-2" aria-label={`${r.rating} dari 5 bintang`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("w-4 h-4", i < r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                  ))}
                </div>
                <blockquote className="text-sm text-slate-700 leading-relaxed">{r.comment ? `"${r.comment}"` : "Mantap!"}</blockquote>
                <figcaption className="text-xs text-slate-500 mt-3">
                  {r.customer.name} {r.booking?.station && `· ${r.booking.station.name}`}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* Alur */}
      <div className="bg-slate-50 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-8">
        {[
          ["Pilih jadwal", "Cari waktu yang pas", Calendar],
          ["Konfirmasi", "Bayar aman via QRIS atau di kasir", TicketPercent],
          ["Datang & main", "Tunjukkan kode booking ke kasir", Gamepad2],
        ].map(([title, desc], i) => (
          <div key={String(title)} className="flex-1 flex items-start gap-3">
            {i > 0 && <div className="hidden md:block w-px h-10 bg-slate-200 -ml-3 mr-3" />}
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" /> {String(title)}
              </h3>
              <p className="text-xs text-slate-500 ml-6">{String(desc)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-slate-400 pt-8 pb-4 flex flex-col items-center gap-2">
        <p className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> {settings.data?.name ?? "JadwalAn"} buka {settings.data ? `${settings.data.openTime} – ${settings.data.closeTime}` : ""} WIB
        </p>
        {settings.data?.address && <p>{settings.data.address}</p>}
        <p className="mt-2">© {new Date().getFullYear()} JadwalAn. Waktunya main.</p>
      </div>
    </div>
  );
}
