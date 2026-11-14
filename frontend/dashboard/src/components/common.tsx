/* eslint-disable react-refresh/only-export-components -- file ini sengaja mengekspor helper bersama komponen */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStatus, SessionStatus, Tier } from "@/types";
import type { PageMeta } from "@/lib/api-client";

// ------------------------------------------------------------------ badges

const STATUS_STYLE: Record<BookingStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  confirmed: { label: "Confirmed", cls: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  checked_in: { label: "Sedang main", cls: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  completed: { label: "Selesai", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  no_show: { label: "No-show", cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

export const statusColor = (s: BookingStatus) => STATUS_STYLE[s] ?? STATUS_STYLE.pending;

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const s = statusColor(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap", s.cls, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

const TIER_STYLE: Record<Tier, string> = {
  vip: "bg-amber-50 text-amber-700 border-amber-100",
  loyal: "bg-indigo-50 text-indigo-700 border-indigo-100",
  regular: "bg-slate-50 text-slate-600 border-slate-200",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className={cn("inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase", TIER_STYLE[tier])}>{tier}</span>;
}

const SESSION_STYLE: Record<SessionStatus, { label: string; cls: string }> = {
  ai_pilot: { label: "AI", cls: "bg-violet-50 text-violet-700" },
  human: { label: "Admin", cls: "bg-orange-50 text-orange-700" },
  closed: { label: "Selesai", cls: "bg-slate-100 text-slate-500" },
};

export function SessionBadge({ status }: { status: SessionStatus }) {
  const s = SESSION_STYLE[status];
  return <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold", s.cls)}>{s.label}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  if (source === "ai") return <span className="inline-flex px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[11px] font-bold">AI</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">{source === "web" ? "Web" : "Manual"}</span>;
}

// ------------------------------------------------------------------ layout bits

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("bg-white border border-gray-100 rounded-2xl shadow-sm", className)}>{children}</div>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={cn("w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0", className)}>
      {ini || "?"}
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 gap-2">
      <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-1">{icon ?? <Inbox className="w-5 h-5" />}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="text-xs text-slate-500 max-w-xs">{description}</p>}
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-slate-500", className)}>
      <Loader2 className="w-4 h-4 animate-spin" /> {label ?? "Memuat..."}
    </div>
  );
}

export function SkeletonRows({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-50">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="py-4 px-6">
              <div className="h-4 rounded bg-slate-100 animate-pulse" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 font-medium px-2">
        Menampilkan {from}–{to} dari {meta.total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Halaman sebelumnya"
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-slate-600 px-2">
          {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Halaman berikutnya"
          className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ form controls

export const inputCls =
  "w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50";
export const textareaCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-y";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, color = "indigo" }: { checked: boolean; onChange: (v: boolean) => void; label?: string; color?: "indigo" | "violet" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-10 h-6 rounded-full transition-colors shrink-0",
        checked ? (color === "violet" ? "bg-violet-600" : "bg-indigo-600") : "bg-slate-200",
      )}
    >
      <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all", checked ? "left-5" : "left-1")} />
    </button>
  );
}

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "ai" | "dark";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
  outline: "bg-white border border-gray-200 text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-white border border-red-200 text-red-600 hover:bg-red-50",
  ai: "bg-violet-600 hover:bg-violet-700 text-white shadow-sm",
  dark: "bg-slate-900 hover:bg-slate-800 text-white",
};

export function Btn({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        BTN[variant],
        className,
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
