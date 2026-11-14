import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Gamepad2, ShieldCheck, UserCog, Plus, Pencil, Trash2, Wrench, MessageCircle } from "lucide-react";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, Btn, Card, EmptyState, Field, PageHeader, Spinner, Toggle, inputCls, textareaCls } from "@/components/common";
import { authApi, settingsApi, stationApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { relativeTime, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth";
import type { Station, StoreSetting } from "@/types";

type Tab = "rental" | "unit" | "whatsapp" | "admin" | "akun";
type SettingsSearch = { tab?: Tab };

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  validateSearch: (s: Record<string, unknown>): SettingsSearch => ({
    tab: ["rental", "unit", "whatsapp", "admin", "akun"].includes(String(s.tab)) ? (s.tab as Tab) : undefined,
  }),
  component: SettingsPage,
});

const TABS = [
  { key: "rental", label: "Rental", icon: Store },
  { key: "unit", label: "Unit PS", icon: Gamepad2 },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "admin", label: "Admin", icon: ShieldCheck },
  { key: "akun", label: "Akun saya", icon: UserCog },
] as const;

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function SettingsPage() {
  const { tab = "rental" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <PageHeader title="Pengaturan" subtitle="Atur jam operasional, unit PlayStation, koneksi WhatsApp, dan akun admin." />
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ search: { tab: t.key } })}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap", tab === t.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "rental" && <RentalTab />}
      {tab === "unit" && <UnitTab />}
      {tab === "whatsapp" && <WhatsAppPanel />}
      {tab === "admin" && <AdminTab />}
      {tab === "akun" && <AccountTab />}
    </div>
  );
}

// ===================================================================== Rental

function RentalTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [f, setF] = useState<StoreSetting | null>(null);
  useEffect(() => {
    if (data) setF(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.update({
        name: f!.name,
        address: f!.address || null,
        phone: f!.phone || null,
        openTime: f!.openTime,
        closeTime: f!.closeTime,
        closedDays: f!.closedDays,
        minBookingHours: f!.minBookingHours,
        maxBookingHours: f!.maxBookingHours,
        slotIntervalMins: f!.slotIntervalMins,
        bookingLeadMins: f!.bookingLeadMins,
        pendingExpiryMins: f!.pendingExpiryMins,
      }),
    onSuccess: () => {
      toast.success("Pengaturan rental disimpan");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !f) return <Spinner />;
  const set = <K extends keyof StoreSetting>(k: K, v: StoreSetting[K]) => setF((s) => (s ? { ...s, [k]: v } : s));

  return (
    <Card className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama rental">
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="No. WhatsApp / telepon">
          <input className={inputCls} value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="62812xxxx" />
        </Field>
        <Field label="Alamat" className="sm:col-span-2">
          <textarea className={textareaCls} rows={2} value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Jam operasional (WIB)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Jam buka">
            <input type="time" className={inputCls} value={f.openTime} onChange={(e) => set("openTime", e.target.value)} />
          </Field>
          <Field label="Jam tutup" hint="Boleh lewat tengah malam, mis. 02:00">
            <input type="time" className={inputCls} value={f.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
          </Field>
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Hari libur</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const on = f.closedDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("closedDays", on ? f.closedDays.filter((x) => x !== i) : [...f.closedDays, i].sort())}
                    className={cn("h-9 px-3 rounded-lg text-xs font-semibold border", on ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-slate-600 border-gray-200")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400">Tidak ada yang dipilih = buka setiap hari</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Aturan booking</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Field label="Durasi min (jam)">
            <input type="number" min={1} max={24} className={inputCls} value={f.minBookingHours} onChange={(e) => set("minBookingHours", Number(e.target.value))} />
          </Field>
          <Field label="Durasi maks (jam)">
            <input type="number" min={1} max={24} className={inputCls} value={f.maxBookingHours} onChange={(e) => set("maxBookingHours", Number(e.target.value))} />
          </Field>
          <Field label="Interval slot">
            <select className={inputCls} value={f.slotIntervalMins} onChange={(e) => set("slotIntervalMins", Number(e.target.value))}>
              <option value={60}>60 menit</option>
              <option value={30}>30 menit</option>
              <option value={15}>15 menit</option>
            </select>
          </Field>
          <Field label="Booking minimal (menit sebelum)">
            <input type="number" min={0} className={inputCls} value={f.bookingLeadMins} onChange={(e) => set("bookingLeadMins", Number(e.target.value))} />
          </Field>
          <Field label="Batas bayar pending (menit)">
            <input type="number" min={5} className={inputCls} value={f.pendingExpiryMins} onChange={(e) => set("pendingExpiryMins", Number(e.target.value))} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Btn onClick={() => save.mutate()} loading={save.isPending}>
          Simpan pengaturan
        </Btn>
      </div>
    </Card>
  );
}

// ===================================================================== Unit

function UnitTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["stations"], queryFn: () => stationApi.list() });
  const [editing, setEditing] = useState<Station | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (s: Station) => stationApi.remove(s.id, true),
    onSuccess: (res) => {
      toast.success((res as { message?: string })?.message ?? "Unit dihapus");
      qc.invalidateQueries({ queryKey: ["stations"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Unit PlayStation</h2>
          <p className="text-sm text-slate-500">Unit aktif tampil di halaman booking pelanggan dan dipakai AI.</p>
        </div>
        <Btn onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" /> Tambah unit
        </Btn>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title="Belum ada unit" icon={<Gamepad2 className="w-5 h-5" />} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-gray-100">
                <th className="py-3 px-5 font-semibold">#</th>
                <th className="py-3 px-5 font-semibold">Unit</th>
                <th className="py-3 px-5 font-semibold">Harga/jam</th>
                <th className="py-3 px-5 font-semibold">Pemain</th>
                <th className="py-3 px-5 font-semibold">Game</th>
                <th className="py-3 px-5 font-semibold">Status</th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-3 px-5 text-slate-400">{s.sortOrder}</td>
                  <td className="py-3 px-5">
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      {s.name}
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", s.category === "PS5" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600")}>{s.category}</span>
                    </p>
                    {s.description && <p className="text-xs text-slate-500">{s.description}</p>}
                  </td>
                  <td className="py-3 px-5 font-semibold">{rupiah(s.pricePerHour)}</td>
                  <td className="py-3 px-5">{s.maxPlayers}</td>
                  <td className="py-3 px-5 text-xs text-slate-500 max-w-[220px] truncate">{s.games.join(", ") || "—"}</td>
                  <td className="py-3 px-5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold",
                        s.status === "active" ? "bg-emerald-50 text-emerald-700" : s.status === "maintenance" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {s.status === "maintenance" && <Wrench className="w-3 h-3" />}
                      {s.status === "active" ? "Aktif" : s.status === "maintenance" ? "Perawatan" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(s)} aria-label="Edit unit" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Hapus unit"
                        onClick={() => confirm(`Hapus ${s.name}? Unit dengan riwayat booking akan dinonaktifkan.`) && remove.mutate(s)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StationForm station={editing} onClose={() => setEditing(null)} nextOrder={(data?.length ?? 0) + 1} />
    </Card>
  );
}

function StationForm({ station, onClose, nextOrder }: { station: Station | "new" | null; onClose: () => void; nextOrder: number }) {
  const qc = useQueryClient();
  const empty = { name: "", category: "PS5", pricePerHour: 15000, status: "active" as Station["status"], description: "", maxPlayers: 2, games: "", sortOrder: nextOrder };
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (station === "new") setF({ ...empty, sortOrder: nextOrder });
    else if (station)
      setF({
        name: station.name,
        category: station.category,
        pricePerHour: station.pricePerHour,
        status: station.status,
        description: station.description ?? "",
        maxPlayers: station.maxPlayers,
        games: station.games.join(", "),
        sortOrder: station.sortOrder,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: f.name,
        category: f.category,
        pricePerHour: Number(f.pricePerHour),
        status: f.status,
        description: f.description || undefined,
        maxPlayers: Number(f.maxPlayers),
        games: f.games.split(",").map((g) => g.trim()).filter(Boolean),
        sortOrder: Number(f.sortOrder),
      };
      return station === "new" ? stationApi.create(payload) : stationApi.update((station as Station).id, payload);
    },
    onSuccess: () => {
      toast.success("Unit disimpan");
      qc.invalidateQueries({ queryKey: ["stations"] });
      qc.invalidateQueries({ queryKey: ["schedule"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={!!station} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{station === "new" ? "Tambah unit" : "Edit unit"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nama unit" className="col-span-2">
            <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="PS5 - TV 1" />
          </Field>
          <Field label="Konsol">
            <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option>PS5</option>
              <option>PS4</option>
            </select>
          </Field>
          <Field label="Harga per jam (Rp)">
            <input type="number" min={1000} step={500} className={inputCls} value={f.pricePerHour} onChange={(e) => setF({ ...f, pricePerHour: Number(e.target.value) })} />
          </Field>
          <Field label="Maks pemain">
            <input type="number" min={1} className={inputCls} value={f.maxPlayers} onChange={(e) => setF({ ...f, maxPlayers: Number(e.target.value) })} />
          </Field>
          <Field label="Urutan tampil">
            <input type="number" className={inputCls} value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value) })} />
          </Field>
          <Field label="Status" className="col-span-2">
            <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Station["status"] })}>
              <option value="active">Aktif</option>
              <option value="maintenance">Perawatan</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </Field>
          <Field label="Deskripsi" className="col-span-2">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder='TV 50" 4K, sofa' />
          </Field>
          <Field label="Daftar game (pisahkan koma)" className="col-span-2">
            <textarea className={textareaCls} rows={2} value={f.games} onChange={(e) => setF({ ...f, games: e.target.value })} placeholder="EA FC 25, Tekken 8, GTA V" />
          </Field>
        </div>
        <DialogFooter>
          <Btn variant="ghost" onClick={onClose}>
            Batal
          </Btn>
          <Btn onClick={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim()}>
            Simpan
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================== Admin

function AdminTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["admins"], queryFn: authApi.admins });
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [open, setOpen] = useState(false);

  const register = useMutation({
    mutationFn: () => authApi.registerAdmin(form),
    onSuccess: () => {
      toast.success("Admin ditambahkan");
      setForm({ name: "", email: "", password: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => authApi.setAdminStatus(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admins"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Admin</h2>
          <p className="text-sm text-slate-500">Semua admin bisa mengelola booking, chat, dan pengaturan.</p>
        </div>
        <Btn onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Tambah admin
        </Btn>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-gray-50">
          {data?.map((a) => (
            <li key={a.id} className="p-5 flex items-center gap-4">
              <Avatar name={a.name} className="w-10 h-10" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">
                  {a.name} {a.id === user?.id && <span className="text-xs font-medium text-indigo-600">(kamu)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {a.email} · login terakhir {a.lastLoginAt ? relativeTime(a.lastLoginAt) : "belum pernah"}
                </p>
              </div>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md", a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{a.isActive ? "Aktif" : "Nonaktif"}</span>
              <Toggle checked={!!a.isActive} onChange={(v) => toggle.mutate({ id: a.id, isActive: v })} label="Status admin" />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nama">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password" hint="Minimal 6 karakter">
              <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Btn variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Btn>
            <Btn onClick={() => register.mutate()} loading={register.isPending} disabled={!form.name || !form.email || form.password.length < 6}>
              Simpan
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ===================================================================== Akun

function AccountTab() {
  const auth = useAuth();
  const [profile, setProfile] = useState({ name: auth.user?.name ?? "", email: auth.user?.email ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateMe(profile),
    onSuccess: (u) => {
      auth.setUser({ id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl });
      toast.success("Profil diperbarui");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const savePw = useMutation({
    mutationFn: () => authApi.changePassword(pw.currentPassword, pw.newPassword),
    onSuccess: () => {
      toast.success("Password diubah");
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Profil</h2>
        <Field label="Nama">
          <input className={inputCls} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputCls} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
        </Field>
        <div className="flex justify-end">
          <Btn onClick={() => saveProfile.mutate()} loading={saveProfile.isPending}>
            Simpan profil
          </Btn>
        </div>
      </Card>
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Ganti password</h2>
        <Field label="Password lama">
          <input type="password" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </Field>
        <Field label="Password baru">
          <input type="password" className={inputCls} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </Field>
        <Field label="Ulangi password baru">
          <input type="password" className={inputCls} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        </Field>
        {pw.confirm && pw.confirm !== pw.newPassword && <p className="text-xs text-red-600">Password baru tidak sama.</p>}
        <div className="flex justify-end">
          <Btn onClick={() => savePw.mutate()} loading={savePw.isPending} disabled={!pw.currentPassword || pw.newPassword.length < 6 || pw.newPassword !== pw.confirm}>
            Ganti password
          </Btn>
        </div>
      </Card>
    </div>
  );
}
