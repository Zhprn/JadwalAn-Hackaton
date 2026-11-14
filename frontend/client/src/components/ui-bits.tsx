import type { ReactNode } from "react";
import { CheckCircle2, Clock, Loader2, Play, XCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";

const STATUS: Record<BookingStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Menunggu bayar", cls: "text-orange-700 bg-orange-50 border-orange-100", icon: Clock },
  confirmed: { label: "Terkonfirmasi", cls: "text-emerald-700 bg-emerald-50 border-emerald-100", icon: CheckCircle2 },
  checked_in: { label: "Sedang main", cls: "text-sky-700 bg-sky-50 border-sky-100", icon: Play },
  completed: { label: "Selesai", cls: "text-slate-600 bg-slate-100 border-slate-200", icon: CheckCircle2 },
  cancelled: { label: "Dibatalkan", cls: "text-red-600 bg-red-50 border-red-100", icon: XCircle },
  no_show: { label: "Tidak hadir", cls: "text-slate-500 bg-slate-100 border-slate-200", icon: XCircle },
};

export function StatusPill({ status }: { status: BookingStatus }) {
  const s = STATUS[status] ?? STATUS.pending;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-md border", s.cls)}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-12 text-sm text-slate-500", className)}>
      <Loader2 className="w-4 h-4 animate-spin" /> {label ?? "Memuat..."}
    </div>
  );
}

export function Empty({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-6 bg-white border border-dashed border-slate-200 rounded-2xl">
      <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">{icon ?? <Inbox className="w-5 h-5" />}</div>
      <p className="font-bold text-slate-900 text-sm">{title}</p>
      {description && <p className="text-xs text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const inputCls =
  "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50";
