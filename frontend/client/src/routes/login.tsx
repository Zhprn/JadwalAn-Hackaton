import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/ui-bits";
import { useAuth } from "@/auth";
import { authApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/jadwal" });
  },
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { redirect: to } = Route.useSearch();
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login(whatsapp, password);
      auth.login(res, res.customer);
      toast.success(`Halo, ${res.customer.name.split(" ")[0]}!`);
      setTimeout(() => {
        if (to && to.startsWith("/")) window.location.assign(to);
        else navigate({ to: "/jadwal", replace: true });
      }, 0);
    } catch (err) {
      setError(errorMessage(err, "Gagal masuk"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Masuk" subtitle="Selamat datang kembali! Masuk dengan nomor WhatsApp.">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold px-4 py-2.5">{error}</div>}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Nomor WhatsApp</span>
          <input className={inputCls} inputMode="tel" autoComplete="tel" required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="08xx xxxx xxxx" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <span className="relative block">
            <input className={`${inputCls} pr-11`} type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </span>
        </label>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Masuk
        </button>
        <p className="text-xs text-slate-400 text-center">Lupa password? Hubungi admin lewat Chat AI → ketik "admin".</p>
        <p className="text-sm text-slate-600 text-center pt-2">
          Belum punya akun?{" "}
          <Link to="/daftar" search={{ redirect: to }} className="font-bold text-indigo-600 hover:underline">
            Daftar gratis
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
