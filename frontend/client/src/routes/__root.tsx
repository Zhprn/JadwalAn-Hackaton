import { useEffect, useState } from "react";
import { createRootRouteWithContext, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Gamepad2, Home, CalendarPlus, CalendarCheck, TicketPercent, User, LogOut } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChatModal } from "@/components/ChatModal";
import { useAuth, type AuthState } from "@/auth";
import { authApi } from "@/services/api";
import { initials } from "@/lib/format";

export const Route = createRootRouteWithContext<{ auth: AuthState }>()({
  component: RootComponent,
});

const NAV = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/booking", label: "Booking", icon: CalendarPlus },
  { to: "/jadwal", label: "Jadwal Saya", short: "Jadwal", icon: CalendarCheck },
  { to: "/promo", label: "Promo", icon: TicketPercent },
  { to: "/profil", label: "Profil", icon: User },
] as const;

function RootComponent() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  // Halaman lain bisa membuka chat lewat event "open-chat".
  useEffect(() => {
    const open = () => setIsChatOpen(true);
    window.addEventListener("open-chat", open);
    return () => window.removeEventListener("open-chat", open);
  }, []);

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    auth.logout();
    toast.success("Sampai jumpa lagi!");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 relative pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 px-4 md:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-indigo-700 font-extrabold text-xl tracking-tight">
          <Gamepad2 className="w-6 h-6" /> JadwalAn
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-semibold text-sm text-slate-500">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="[&.active]:text-indigo-600 [&.active]:border-b-2 border-indigo-600 pb-1 transition-colors hover:text-indigo-600"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {auth.isAuthenticated && auth.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu akun"
                className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition-colors"
              >
                {initials(auth.user.name)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold text-slate-900">{auth.user.name}</p>
                <p className="text-xs text-slate-500 capitalize">Member {auth.user.tier}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/jadwal" })}>
                <CalendarCheck className="w-4 h-4" /> Jadwal saya
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/profil" })}>
                <User className="w-4 h-4" /> Profil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 px-3 py-2">
              Masuk
            </Link>
            <Link to="/daftar" className="hidden sm:inline-flex text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl">
              Daftar
            </Link>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>

      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <button
        type="button"
        onClick={() => setIsChatOpen((v) => !v)}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 bg-indigo-600 text-white px-5 py-3.5 rounded-full shadow-[0_8px_30px_rgb(79,70,229,0.3)] hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2 z-50"
        aria-label={isChatOpen ? "Tutup chat AI" : "Buka chat AI"}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-semibold text-sm">Chat AI</span>
      </button>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 py-2 px-2 flex justify-between items-center text-[10px] font-semibold text-slate-500 z-40">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} className="flex-1 flex flex-col items-center gap-1 py-1 [&.active]:text-indigo-600">
            <n.icon className="w-5 h-5" />
            {"short" in n ? n.short : n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
