import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/AuthShell";
import { inputCls } from "@/components/ui-bits";
import { useAuth } from "@/auth";
import { authApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";

type Search = { redirect?: string };

export const Route = createFileRoute("/daftar")({
  validateSearch: (s: Record<string, unknown>): Search => ({ redirect: typeof s.redirect === "string" ? s.redirect : undefined }),
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) throw redirect({ to: "/jadwal" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { redirect: to } = Route.useSearch();
  const [form, setForm] = useState({ name: "", whatsapp: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Konfirmasi password tidak sama");
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.register({ name: form.name.trim(), whatsapp: form.whatsapp, password: form.password });
      auth.login(res, res.customer);
      toast.success("Akun berhasil dibuat. Selamat bermain!");
      setTimeout(() => {
        if (to && to.startsWith("/")) window.location.assign(to);
        else navigate({ to: "/booking", replace: true });
      }, 0);
    } catch (err) {
      setError(errorMessage(err, "Gagal mendaftar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Daftar akun" subtitle="Gratis, cuma 30 detik.">
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold px-4 py-2.5">{error}</div>}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Nama lengkap</span>
          <input className={inputCls} required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Nomor WhatsApp</span>
          <input className={inputCls} required inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xx xxxx xxxx" />
          <span className="text-xs text-slate-400">Dipakai untuk login dan info booking.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input className={inputCls} type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Ulangi</span>
            <input className={inputCls} type="password" required minLength={6} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Buat akun
        </button>
        <p className="text-sm text-slate-600 text-center pt-2">
          Sudah punya akun?{" "}
          <Link to="/login" search={{ redirect: to }} className="font-bold text-indigo-600 hover:underline">
            Masuk
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
