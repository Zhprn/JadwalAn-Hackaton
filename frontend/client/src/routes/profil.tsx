import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog, ChevronRight, Phone, Headphones, MessageSquare, LogOut, KeyRound, Crown, Loader2, X, BellOff } from "lucide-react";
import { toast } from "sonner";
import { authApi, publicApi } from "@/services/api";
import { useAuth } from "@/auth";
import { Spinner, inputCls } from "@/components/ui-bits";
import { errorMessage } from "@/lib/api-client";
import { formatWa, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: ProfilPage,
});

// Ambang tier sama dengan backend (booking.service.ts).
const TIER_NEXT = { regular: { next: "loyal", sessions: 5 }, loyal: { next: "vip", sessions: 20 }, vip: null } as const;

function ProfilPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  const settings = useQuery({ queryKey: ["settings"], queryFn: publicApi.settings });
  const wa = useQuery({ queryKey: ["whatsapp-public"], queryFn: publicApi.whatsapp, staleTime: 60_000 });
  const [modal, setModal] = useState<"edit" | "password" | null>(null);

  const c = me.data;

  // Sinkronkan data tier/nama terbaru ke navbar.
  useEffect(() => {
    if (c && auth.user && (c.tier !== auth.user.tier || c.name !== auth.user.name)) {
      auth.setUser({ id: c.id, name: c.name, whatsapp: c.whatsapp, tier: c.tier, avatarUrl: c.avatarUrl });
    }
  }, [c, auth]);

  const optOut = useMutation({
    mutationFn: (v: boolean) => authApi.updateMe({ optOutPromo: v }),
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      toast.success(u.optOutPromo ? "Kamu tidak akan menerima pesan promo" : "Pesan promo diaktifkan");
    },
  });

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    auth.logout();
    toast.success("Sampai jumpa lagi!");
    navigate({ to: "/" });
  };

  if (me.isLoading || !c) return <Spinner />;
  const nextTier = TIER_NEXT[c.tier];
  const memberSince = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(c.createdAt));

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Profil Saya</h1>
        <p className="text-slate-500 text-sm">Sedikit tentang kamu dan waktu bermainmu.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-xl font-black text-indigo-600 border border-indigo-100 shrink-0">{initials(c.name)}</div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {c.name}
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex items-center gap-1", c.tier === "vip" ? "bg-amber-50 text-amber-700" : c.tier === "loyal" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600")}>
                  {c.tier !== "regular" && <Crown className="w-3 h-3" />} {c.tier}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Member sejak {memberSince}</p>
            </div>
          </div>
          <button type="button" onClick={() => setModal("edit")} className="flex items-center justify-between md:justify-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-2 rounded-xl text-slate-600 group-hover:text-indigo-600 transition-colors">
                <UserCog className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Edit profil</p>
                <p className="text-[10px] text-slate-500">Perbarui nama dan nomor WhatsApp</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div>
          <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Nomor WhatsApp</p>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Phone className="w-4 h-4 text-slate-400" /> {formatWa(c.whatsapp)}
          </div>
        </div>

        <hr className="border-slate-100 my-2" />

        <div className="flex flex-col md:flex-row gap-6 md:gap-12 md:items-center">
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1">Total jam bermain</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-indigo-600 tracking-tighter">{c.totalHours}</span>
              <span className="text-xs font-semibold text-slate-500">jam</span>
            </div>
          </div>
          <div className="hidden md:block w-px h-12 bg-slate-100" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium mb-1">Sesi selesai</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-900 tracking-tighter">{c.totalSessions}</span>
              <span className="text-xs font-semibold text-slate-500">sesi</span>
            </div>
          </div>
          <div className="hidden md:block w-px h-12 bg-slate-100" />
          <div className="md:flex-1 bg-slate-50 p-4 rounded-xl">
            {nextTier ? (
              <>
                <p className="text-sm font-bold text-slate-900 mb-2">
                  {Math.max(0, nextTier.sessions - c.totalSessions)} sesi lagi menuju <span className="uppercase text-indigo-600">{nextTier.next}</span>
                </p>
                <div className="h-2 rounded-full bg-white overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, (c.totalSessions / nextTier.sessions) * 100)}%` }} />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-900 mb-1">Kamu member VIP 👑</p>
                <p className="text-[10px] text-slate-500">Terima kasih sudah jadi pelanggan setia kami.</p>
              </>
            )}
            {c.favoriteConsole && (
              <p className="text-[10px] text-slate-500 mt-2">
                Favorit: {c.favoriteConsole}
                {c.favoriteHour ? ` jam ${c.favoriteHour}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Akun & bantuan</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#F8F9FF] border border-indigo-50 rounded-3xl p-6 flex flex-col gap-5">
            <div className="bg-white w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base mb-1.5">Kami siap membantu.</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Dari ubah jadwal sampai cari slot kosong, tanya asisten atau admin kami.</p>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-chat"))}
              className="bg-white text-indigo-600 font-bold text-sm px-6 py-3.5 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" /> Hubungi kami
            </button>
            {wa.data?.connected && wa.data.phone && (
              <a
                href={`https://wa.me/${wa.data.phone}`}
                target="_blank"
                rel="noreferrer"
                className="-mt-2 bg-emerald-600 text-white font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Chat via WhatsApp
              </a>
            )}
            <p className="text-[10px] text-slate-400 font-medium">Admin online • {settings.data ? `${settings.data.openTime} - ${settings.data.closeTime}` : "jam buka"} WIB</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl p-2 flex flex-col">
            <button type="button" onClick={() => setModal("password")} className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 text-left">
              <KeyRound className="w-5 h-5 text-slate-500" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-slate-900">Ganti password</span>
                <span className="block text-xs text-slate-500">Demi keamanan akunmu</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
            <label className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-50 cursor-pointer">
              <BellOff className="w-5 h-5 text-slate-500" />
              <span className="flex-1">
                <span className="block text-sm font-bold text-slate-900">Tolak pesan promo</span>
                <span className="block text-xs text-slate-500">Tidak menerima promo via WhatsApp</span>
              </span>
              <input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={c.optOutPromo} onChange={(e) => optOut.mutate(e.target.checked)} disabled={optOut.isPending} />
            </label>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button type="button" onClick={logout} className="flex items-center justify-center gap-2 text-red-600 text-xs font-bold px-6 py-3 border border-slate-200 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors w-full md:w-auto bg-white">
          <LogOut className="w-4 h-4" /> Keluar akun
        </button>
        <p className="text-[10px] text-slate-400 mt-4 text-center md:text-left">JadwalAn • Dibuat untuk waktu bermainmu.</p>
      </div>

      {modal === "edit" && <EditModal name={c.name} whatsapp={c.whatsapp} onClose={() => setModal(null)} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditModal({ name, whatsapp, onClose }: { name: string; whatsapp: string; onClose: () => void }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const [f, setF] = useState({ name, whatsapp: whatsapp.startsWith("62") ? `0${whatsapp.slice(2)}` : whatsapp });
  const save = useMutation({
    mutationFn: () => authApi.updateMe(f),
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      auth.setUser({ id: u.id, name: u.name, whatsapp: u.whatsapp, tier: u.tier, avatarUrl: u.avatarUrl });
      toast.success("Profil diperbarui");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal title="Edit profil" onClose={onClose}>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Nama</span>
        <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Nomor WhatsApp</span>
        <input className={inputCls} inputMode="tel" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        <span className="text-xs text-slate-400">Nomor baru dipakai untuk login berikutnya.</span>
      </label>
      <button type="button" onClick={() => save.mutate()} disabled={save.isPending || f.name.trim().length < 2} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-60">
        {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
      </button>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const save = useMutation({
    mutationFn: () => authApi.changePassword(f.current, f.next),
    onSuccess: () => {
      toast.success("Password diubah");
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const mismatch = f.confirm && f.confirm !== f.next;
  return (
    <Modal title="Ganti password" onClose={onClose}>
      <input className={inputCls} type="password" placeholder="Password lama" aria-label="Password lama" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <input className={inputCls} type="password" placeholder="Password baru (min. 6)" aria-label="Password baru" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      <input className={inputCls} type="password" placeholder="Ulangi password baru" aria-label="Ulangi password baru" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      {mismatch && <p className="text-xs text-red-600">Password baru tidak sama.</p>}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending || !f.current || f.next.length < 6 || f.next !== f.confirm}
        className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Ganti password
      </button>
    </Modal>
  );
}
