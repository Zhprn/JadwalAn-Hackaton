import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Bot, CalendarDays, Eye, EyeOff, Gamepad2, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { authApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import logo from "@/assets/LogoJadwalan.svg";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      auth.login({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
      toast.success(`Selamat datang, ${res.user.name}`);
      // Beri waktu context router menerima status login baru.
      setTimeout(() => {
        if (redirectTo && redirectTo.startsWith("/dashboard")) window.location.assign(redirectTo);
        else navigate({ to: "/dashboard", replace: true });
      }, 0);
    } catch (err) {
      setError(errorMessage(err, "Gagal masuk"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F8F9FA]">
      {/* Panel brand */}
      <div className="hidden lg:flex flex-col justify-between bg-indigo-600 text-white p-12">
        <img src={logo} alt="JadwalAn" className="h-9 w-44 object-contain object-left brightness-0 invert" />
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight">Rental PS lebih rapi, AI yang urus bookingnya.</h1>
          <p className="text-indigo-100">Kelola jadwal unit, pantau chat pelanggan, dan kirim promo personal — semua dari satu dashboard.</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"><CalendarDays className="w-4 h-4" /></span>Kalender unit anti bentrok</li>
            <li className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"><MessageSquare className="w-4 h-4" /></span>Live chat dengan handoff AI → admin</li>
            <li className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center"><Bot className="w-4 h-4" /></span>Insight & promo otomatis</li>
          </ul>
        </div>
        <p className="text-xs text-indigo-200">© JadwalAn · Panel admin</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-5">
          <div className="lg:hidden flex items-center gap-2 text-indigo-600 font-bold text-lg">
            <Gamepad2 className="w-6 h-6" /> JadwalAn
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Masuk admin</h2>
            <p className="text-sm text-slate-500 mt-1">Gunakan akun admin rental kamu.</p>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm font-medium px-3 py-2">{error}</div>}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@jadwalan.id"
              className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-lg border border-gray-200 px-3 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-70 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
