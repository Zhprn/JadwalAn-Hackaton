import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, ChevronRight, Home, LogOut, Settings, CheckCheck, MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/auth";
import { notificationApi, whatsappApi } from "@/services/api";
import { initials, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/livechat": "Live Booking Chat",
  "/dashboard/calender": "Manajemen Kalender",
  "/dashboard/bookings": "Daftar Booking",
  "/dashboard/promo": "Manajemen Promo",
  "/dashboard/costumer": "Customer Re-Engagement",
  "/dashboard/ai": "Pengaturan AI",
  "/dashboard/settings": "Pengaturan",
};

const NOTIF_DOT: Record<string, string> = {
  new_booking: "bg-indigo-500",
  payment_paid: "bg-emerald-500",
  handoff: "bg-orange-500",
  new_chat: "bg-violet-500",
  booking_cancelled: "bg-red-500",
};

/** Ubah link notifikasi backend (/dashboard/livechat?session=..) menjadi route yang ada. */
const notifTarget = (link: string | null) => {
  if (!link) return null;
  if (link.startsWith("/dashboard/livechat")) return { to: "/dashboard/livechat", search: Object.fromEntries(new URLSearchParams(link.split("?")[1] ?? "")) };
  if (link.startsWith("/dashboard/bookings/")) return { to: "/dashboard/bookings", search: { id: link.split("/").pop() } };
  return { to: link, search: {} };
};

export default function Topbar({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, "") });
  const title = TITLES[pathname] ?? "Dashboard";

  const { data: notif } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list({ limit: 12 }),
    refetchInterval: 20_000,
  });
  const unread = Number(notif?.meta?.unread ?? 0);
  const { data: wa } = useQuery({ queryKey: ["whatsapp", "status"], queryFn: whatsappApi.status, refetchInterval: 30_000, retry: 0 });

  const readAll = useMutation({
    mutationFn: notificationApi.readAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const openNotif = async (id: string, link: string | null, isRead: boolean) => {
    if (!isRead) {
      await notificationApi.read(id).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    const t = notifTarget(link);
    if (t) navigate({ to: t.to as never, search: t.search as never });
  };

  return (
    <header className="sticky top-14 lg:top-0 z-10 flex items-center justify-between w-full h-16 px-4 sm:px-6 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/dashboard" className="text-slate-500 hover:text-slate-700 transition-colors" aria-label="Beranda dashboard">
          <Home className="w-5 h-5" strokeWidth={2} />
        </Link>
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
        <span className="text-sm font-semibold text-slate-800 truncate">{title}</span>
      </div>

      <div className="flex items-center h-full gap-3">
        {/* Status WhatsApp */}
        {wa && (
          <Link
            to="/dashboard/settings"
            search={{ tab: "whatsapp" } as never}
            title={wa.status === "connected" ? `WhatsApp terhubung (${wa.phone})` : "WhatsApp belum terhubung — klik untuk scan QR"}
            className={cn(
              "hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
              wa.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {wa.status === "connected" ? "WA aktif" : wa.status === "qr" ? "WA menunggu scan" : "WA terputus"}
          </Link>
        )}

        {/* Notifikasi */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Notifikasi${unread ? ` (${unread} belum dibaca)` : ""}`}
              className="relative w-10 h-10 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-slate-800">Notifikasi</span>
              <button
                type="button"
                onClick={() => readAll.mutate()}
                disabled={!unread}
                className="text-xs font-semibold text-indigo-600 flex items-center gap-1 disabled:opacity-40"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Tandai semua dibaca
              </button>
            </div>
            <ul className="max-h-[420px] overflow-y-auto">
              {!notif?.data.length && <li className="px-4 py-10 text-center text-sm text-slate-400">Belum ada notifikasi</li>}
              {notif?.data.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotif(n.id, n.link, n.isRead)}
                    className={cn("w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 border-b border-gray-50", !n.isRead && "bg-indigo-50/40")}
                  >
                    <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", NOTIF_DOT[n.type] ?? "bg-slate-400")} />
                    <span className="flex-1 min-w-0">
                      <span className={cn("block text-sm text-slate-800", !n.isRead && "font-semibold")}>{n.title}</span>
                      {n.body && <span className="block text-xs text-slate-500 truncate">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400 mt-0.5">{relativeTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <div className="w-px h-8 bg-gray-200 hidden sm:block" />

        {/* Profil */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex items-center gap-3 text-left focus:outline-none hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-50">
                <span className="text-sm font-bold text-indigo-600">{initials(user?.name)}</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-semibold text-slate-800 leading-tight">{user?.name ?? "Admin"}</span>
                <span className="text-xs text-slate-500">{user?.email ?? "Admin rental"}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 ml-1 hidden sm:block" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate({ to: "/dashboard/settings", search: { tab: "akun" } as never })}>
              <Settings className="w-4 h-4" /> Akun & pengaturan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
