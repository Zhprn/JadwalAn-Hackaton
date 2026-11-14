import * as React from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  ClipboardList,
  BadgePercent,
  Sparkles,
  Bot,
  Settings,
  Menu,
  X,
  Loader2,
  Gamepad2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import Topbar from "../Topbar";
import logo from "../../assets/LogoJadwalan.svg";
import { useAuth } from "@/auth";
import { authApi, dashboardApi, settingsApi } from "@/services/api";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  exact?: boolean;
  ai?: boolean;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Angka badge sidebar diperbarui berkala.
  const { data: summary } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: dashboardApi.summary,
    refetchInterval: 30_000,
  });
  const { data: setting } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get, staleTime: 5 * 60_000 });

  const primaryNav: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { title: "Live Booking Chat", href: "/dashboard/livechat", icon: MessageSquare, badge: summary?.chats?.human },
    { title: "Manajemen Kalender", href: "/dashboard/calender", icon: Calendar },
    { title: "Daftar Booking", href: "/dashboard/bookings", icon: ClipboardList, badge: summary?.pendingPayments },
    { title: "Manajemen Promo", href: "/dashboard/promo", icon: BadgePercent },
    { title: "Customer Re-Engagement", href: "/dashboard/costumer", icon: Sparkles, ai: true },
  ];
  const systemNav: NavItem[] = [
    { title: "Pengaturan AI", href: "/dashboard/ai", icon: Bot, ai: true },
    { title: "Pengaturan", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // token mungkin sudah kedaluwarsa — tetap keluar
    } finally {
      auth.logout();
      toast.success("Berhasil keluar");
      setLoggingOut(false);
      navigate({ to: "/login", replace: true });
    }
  };

  const renderItem = (item: NavItem) => {
    const isActive = item.exact ? pathname === item.href || pathname === `${item.href}/` : pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        to={item.href}
        onClick={() => setIsOpen(false)}
        className={`group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all ${
          isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`h-5 w-5 ${isActive ? "text-white" : item.ai ? "text-violet-500" : "text-gray-400 group-hover:text-gray-600"}`}
          />
          <span>{item.title}</span>
        </div>
        {!!item.badge && (
          <span
            className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
              isActive ? "bg-white text-indigo-600" : "bg-indigo-600 text-white"
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA]">
      {/* Header Mobile */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-bold text-gray-900">JadwalAn</span>
        </div>
        <button type="button" onClick={() => setIsOpen(true)} aria-label="Buka menu" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-gray-100 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Logo JadwalAn" className="h-8 w-40 object-contain object-left" />
            <button onClick={() => setIsOpen(false)} aria-label="Tutup menu" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          <Link
            to="/dashboard/settings"
            className="mt-8 flex items-center justify-between rounded-xl bg-indigo-600 p-4 text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-200">Workspace Rental</p>
              <p className="text-sm font-semibold">{setting?.name ?? "Rental PS"}</p>
              {setting && (
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Buka {setting.openTime}–{setting.closeTime} WIB
                </p>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-indigo-200" />
          </Link>

          <p className="mt-8 mb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Menu Utama</p>
          <nav className="space-y-1.5">{primaryNav.map(renderItem)}</nav>
          <p className="mt-6 mb-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sistem</p>
          <nav className="space-y-1.5">{systemNav.map(renderItem)}</nav>
        </div>

        <div className="p-6 border-t border-gray-100 mt-auto">
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-red-50 hover:text-red-600"
          >
            {loggingOut && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loggingOut ? "Keluar..." : "Log Out"}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-72">
        <Topbar onLogout={handleLogout} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
