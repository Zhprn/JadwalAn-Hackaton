import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, LogOut, MessageCircle, RefreshCw, Smartphone, Send, ShieldAlert, Bot, BellRing, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, Toggle, inputCls, textareaCls } from "@/components/common";
import { whatsappApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { formatWa, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaConfig } from "@/types";

export function WhatsAppPanel() {
  const qc = useQueryClient();
  const { data: wa, isLoading } = useQuery({
    queryKey: ["whatsapp", "status"],
    queryFn: whatsappApi.status,
    // QR berganti tiap ±20 detik → polling cepat saat menunggu scan.
    refetchInterval: (q) => (q.state.data?.status === "qr" || q.state.data?.status === "connecting" ? 2000 : 15000),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["whatsapp"] });
  const connect = useMutation({ mutationFn: whatsappApi.connect, onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const logout = useMutation({
    mutationFn: whatsappApi.logout,
    onSuccess: () => {
      toast.success("WhatsApp diputuskan");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveConfig = useMutation({
    mutationFn: (patch: Partial<WaConfig>) => whatsappApi.config(patch),
    onSuccess: () => {
      toast.success("Pengaturan WhatsApp disimpan");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !wa) {
    return (
      <Card className="p-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </Card>
    );
  }

  const cfg = wa.config;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Koneksi */}
      <Card className="lg:col-span-3 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Koneksi WhatsApp</h2>
              <p className="text-sm text-slate-500">Tautkan nomor WhatsApp rental seperti WhatsApp Web.</p>
            </div>
          </div>
          <StatusChip status={wa.status} />
        </div>

        {wa.status === "connected" ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{wa.name ?? "WhatsApp terhubung"}</p>
              <p className="text-sm text-slate-600">{formatWa(wa.phone)}</p>
              {wa.connectedAt && <p className="text-xs text-slate-500 mt-0.5">Terhubung {relativeTime(wa.connectedAt)}</p>}
            </div>
            <Btn variant="danger" onClick={() => confirm("Putuskan WhatsApp? Kamu harus scan QR lagi untuk menyambung.") && logout.mutate()} loading={logout.isPending}>
              <LogOut className="w-4 h-4" /> Putuskan
            </Btn>
          </div>
        ) : wa.status === "qr" && wa.qr ? (
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <QRCodeSVG value={wa.qr} size={232} level="L" title="QR WhatsApp" />
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-semibold text-slate-800">Scan QR dengan WhatsApp di HP</p>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1.5">
                <li>Buka WhatsApp (atau WhatsApp Business) di HP rental.</li>
                <li>
                  Ketuk <b>⋮ / Setelan</b> → <b>Perangkat tertaut</b>.
                </li>
                <li>
                  Ketuk <b>Tautkan perangkat</b>, lalu arahkan kamera ke QR ini.
                </li>
              </ol>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> QR diperbarui otomatis{wa.qrExpiresIn != null ? ` · ${wa.qrExpiresIn} dtk` : ""}
              </p>
            </div>
          </div>
        ) : wa.status === "connecting" ? (
          <div className="py-10 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">{wa.lastError ?? "Menyambungkan ke WhatsApp…"}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 p-8 flex flex-col items-center text-center gap-3">
            <Smartphone className="w-10 h-10 text-slate-300" />
            <p className="text-sm text-slate-600 max-w-sm">Hubungkan WhatsApp agar AI otomatis membalas chat pelanggan, dan konfirmasi booking, pengingat, serta promo terkirim tanpa buka WhatsApp manual.</p>
            {wa.lastError && <p className="text-xs font-medium text-red-600">{wa.lastError}</p>}
            <Btn onClick={() => connect.mutate()} loading={connect.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="w-4 h-4" /> Hubungkan WhatsApp
            </Btn>
          </div>
        )}

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2.5 text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Koneksi memakai protokol WhatsApp Web (tidak resmi). Pakai nomor khusus bisnis, kirim promo hanya ke pelanggan yang tidak menolak promo, dan hindari kirim massal berlebihan agar nomor tidak
            diblokir WhatsApp.
          </p>
        </div>
      </Card>

      {/* Otomasi */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Otomasi</h3>
          <Row icon={<Bot className="w-4 h-4 text-violet-600" />} title="AI balas chat WhatsApp" desc="Pesan masuk dijawab AI; tampil juga di Live Chat.">
            <Toggle checked={cfg.autoReply} onChange={(v) => saveConfig.mutate({ autoReply: v })} color="violet" label="AI balas chat WhatsApp" />
          </Row>
          <Row icon={<CalendarCheck className="w-4 h-4 text-indigo-600" />} title="Konfirmasi booking" desc="Kirim pesan saat booking terkonfirmasi / dibatalkan.">
            <Toggle checked={cfg.notifyBooking} onChange={(v) => saveConfig.mutate({ notifyBooking: v })} label="Konfirmasi booking" />
          </Row>
          <Row icon={<BellRing className="w-4 h-4 text-amber-600" />} title="Pengingat sebelum main" desc="Dikirim otomatis sebelum jam mulai.">
            <Toggle checked={cfg.notifyReminder} onChange={(v) => saveConfig.mutate({ notifyReminder: v })} label="Pengingat" />
          </Row>
          {cfg.notifyReminder && (
            <Field label="Kirim pengingat (menit sebelum mulai)">
              <select className={inputCls} value={cfg.reminderMins} onChange={(e) => saveConfig.mutate({ reminderMins: Number(e.target.value) })}>
                {[30, 60, 120, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} menit
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Card>
        <TestSend disabled={wa.status !== "connected"} />
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    connected: ["Terhubung", "bg-emerald-50 text-emerald-700"],
    qr: ["Menunggu scan", "bg-amber-50 text-amber-700"],
    connecting: ["Menyambung…", "bg-sky-50 text-sky-700"],
    disconnected: ["Terputus", "bg-slate-100 text-slate-500"],
  };
  const [label, cls] = map[status] ?? map.disconnected;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0", cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full bg-current", status === "connected" && "animate-pulse")} /> {label}
    </span>
  );
}

function Row({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function TestSend({ disabled }: { disabled: boolean }) {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("Halo! Ini pesan uji dari JadwalAn 🎮");
  const send = useMutation({
    mutationFn: () => whatsappApi.test(to, message),
    onSuccess: () => toast.success("Pesan uji terkirim"),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card className="p-6 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Kirim pesan uji</h3>
      <Field label="Nomor tujuan">
        <input className={inputCls} inputMode="tel" placeholder="08xx" value={to} onChange={(e) => setTo(e.target.value)} disabled={disabled} />
      </Field>
      <Field label="Pesan">
        <textarea className={textareaCls} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} disabled={disabled} />
      </Field>
      <Btn onClick={() => send.mutate()} loading={send.isPending} disabled={disabled || to.length < 9 || !message.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
        <Send className="w-4 h-4" /> Kirim uji
      </Btn>
      {disabled && <p className="text-xs text-slate-400 text-center">Hubungkan WhatsApp dulu.</p>}
    </Card>
  );
}
