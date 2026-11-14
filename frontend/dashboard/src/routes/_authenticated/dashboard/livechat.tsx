import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Send, Bot, CalendarDays, ArrowUpRight, Hand, CheckCheck, RotateCcw, Lock, Unlock, Headphones, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { chatApi } from "@/services/api";
import { Avatar, EmptyState, SessionBadge, Spinner, StatusBadge, TierBadge } from "@/components/common";
import { BookingDetailDialog } from "@/components/booking-dialogs";
import { errorMessage } from "@/lib/api-client";
import { fmtDateLong, fmtRange, fmtTime, formatWa, relativeTime, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatSession } from "@/types";

type ChatSearch = { session?: string };

export const Route = createFileRoute("/_authenticated/dashboard/livechat")({
  validateSearch: (s: Record<string, unknown>): ChatSearch => ({ session: typeof s.session === "string" ? s.session : undefined }),
  component: LiveChatPage,
});

const TABS = [
  { key: "active", label: "Aktif", status: "ai_pilot,human" },
  { key: "human", label: "Butuh admin", status: "human" },
  { key: "ai", label: "AI", status: "ai_pilot" },
  { key: "closed", label: "Selesai", status: "closed" },
] as const;

const AGENT_LABEL: Record<string, string> = { booking: "Booking Agent", info: "Info Agent", support: "Support Agent" };

function LiveChatPage() {
  const { session: selectedId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("active");
  const [q, setQ] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);

  const status = TABS.find((t) => t.key === tab)!.status;
  const sessions = useQuery({
    queryKey: ["chat", "sessions", status, q],
    queryFn: () => chatApi.sessions({ status, search: q || undefined, limit: 50 }),
    refetchInterval: 8000,
  });
  const byStatus = (sessions.data?.meta?.byStatus ?? {}) as Record<string, number>;

  const detail = useQuery({
    queryKey: ["chat", "session", selectedId],
    queryFn: () => chatApi.session(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  // Tandai dibaca saat sesi dibuka / ada pesan baru.
  const lastMsgId = detail.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (!selectedId || !detail.data?.session.unreadByAdmin) return;
    chatApi.read(selectedId).then(() => qc.invalidateQueries({ queryKey: ["chat", "sessions"] }));
  }, [selectedId, lastMsgId, detail.data?.session.unreadByAdmin, qc]);

  // Pilih sesi pertama otomatis di layar lebar.
  useEffect(() => {
    if (!selectedId && sessions.data?.data.length && window.innerWidth >= 1024) {
      navigate({ search: { session: sessions.data.data[0].id }, replace: true });
    }
  }, [selectedId, sessions.data, navigate]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["chat"] });
    qc.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  };

  const action = useMutation({
    mutationFn: (a: "takeover" | "release" | "close" | "reopen") => chatApi.action(selectedId!, a),
    onSuccess: (_, a) => {
      toast.success({ takeover: "Percakapan diambil alih", release: "Dikembalikan ke AI", close: "Sesi ditutup", reopen: "Sesi dibuka kembali" }[a]);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = detail.data?.session;

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)] max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Live Booking Chat</h1>
          <p className="text-sm text-slate-500 mt-1">Pantau percakapan, biarkan AI mengurus reservasinya.</p>
        </div>
        <Link to="/dashboard/ai" className="flex items-center gap-2 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-3 py-2 rounded-lg hover:bg-violet-100">
          <Sparkles className="w-4 h-4" /> Pengaturan AI
        </Link>
      </div>

      <div className="flex bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0">
        {/* KIRI: daftar sesi */}
        <div className={cn("w-full lg:w-[320px] flex-shrink-0 border-r border-gray-200 flex-col bg-white", selectedId ? "hidden lg:flex" : "flex")}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Kotak masuk</h2>
            {!!byStatus.human && (
              <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 inline-block bg-orange-500 rounded-full mr-1" />
                {byStatus.human} butuh admin
              </span>
            )}
          </div>
          <div className="px-4 pt-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap", tab === t.key ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4 pt-3 pb-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama atau pesan..."
                aria-label="Cari percakapan"
                className="w-full bg-slate-50 text-sm rounded-lg pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.isLoading && <Spinner />}
            {sessions.data && !sessions.data.data.length && <EmptyState title="Belum ada percakapan" icon={<MessageSquare className="w-5 h-5" />} />}
            {sessions.data?.data.map((c) => (
              <SessionItem key={c.id} chat={c} active={c.id === selectedId} onClick={() => navigate({ search: { session: c.id } })} />
            ))}
          </div>
        </div>

        {/* KANAN: percakapan */}
        <div className={cn("flex-1 flex-col bg-[#F8F9FA]/50 relative min-w-0", selectedId ? "flex" : "hidden lg:flex")}>
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="Pilih percakapan" description="Pesan dari pelanggan akan muncul di sini." icon={<MessageSquare className="w-5 h-5" />} />
            </div>
          ) : !s ? (
            <Spinner />
          ) : (
            <>
              <div className="min-h-[72px] bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button type="button" onClick={() => navigate({ search: {} })} className="lg:hidden text-sm text-slate-500 mr-1" aria-label="Kembali ke daftar">
                    ←
                  </button>
                  <Avatar name={s.customer.name} className="w-10 h-10 text-sm" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-800 leading-tight flex items-center gap-2">
                      {s.customer.name} <TierBadge tier={s.customer.tier} /> <SessionBadge status={s.status} />
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.channel === "whatsapp" ? "WhatsApp" : "Web"} · {formatWa(s.customer.whatsapp)}
                      {s.assignedAdmin && ` · ditangani ${s.assignedAdmin.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === "ai_pilot" && (
                    <button
                      type="button"
                      onClick={() => action.mutate("takeover")}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100"
                    >
                      <Hand className="w-3.5 h-3.5" /> Take Over
                    </button>
                  )}
                  {s.status === "human" && (
                    <button
                      type="button"
                      onClick={() => action.mutate("release")}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-violet-100"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke AI
                    </button>
                  )}
                  {s.status !== "closed" ? (
                    <button
                      type="button"
                      onClick={() => action.mutate("close")}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
                    >
                      <Lock className="w-3.5 h-3.5" /> Tutup
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => action.mutate("reopen")}
                      disabled={action.isPending}
                      className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Buka lagi
                    </button>
                  )}
                </div>
              </div>

              {s.status === "ai_pilot" ? (
                <div className="bg-indigo-50/80 px-6 py-2 flex items-center gap-2 border-b border-indigo-100 flex-shrink-0">
                  <Bot className="w-4 h-4 text-indigo-600 shrink-0" />
                  <p className="text-[11px] font-semibold text-indigo-700">AI sedang menangani percakapan ini. Kamu bisa mengambil alih kapan saja — atau langsung balas.</p>
                </div>
              ) : s.status === "human" ? (
                <div className="bg-orange-50 px-6 py-2 flex items-center gap-2 border-b border-orange-100 flex-shrink-0">
                  <Headphones className="w-4 h-4 text-orange-600 shrink-0" />
                  <p className="text-[11px] font-semibold text-orange-700">AI berhenti membalas. Balasan pelanggan menunggu admin.</p>
                </div>
              ) : null}

              {s.summary && (
                <div className="px-6 py-2 bg-white border-b border-gray-100 text-xs text-slate-600 flex gap-2 flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                  <span>
                    <b className="text-slate-700">Ringkasan AI:</b> {s.summary}
                  </span>
                </div>
              )}

              <MessageList messages={detail.data!.messages} onOpenBooking={setBookingId} />
              <Composer sessionId={s.id} status={s.status} channel={s.channel} onSent={refresh} />
            </>
          )}
        </div>

        {/* PANEL PELANGGAN (layar lebar) */}
        {s && <CustomerPanel session={s} onOpenBooking={setBookingId} />}
      </div>

      <BookingDetailDialog bookingId={bookingId} onClose={() => setBookingId(null)} />
    </div>
  );
}

function SessionItem({ chat, active, onClick }: { chat: ChatSession; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex gap-3 p-4 border-b border-gray-50 transition-colors border-l-2",
        active ? "bg-indigo-50/40 border-l-indigo-600" : "hover:bg-slate-50 border-l-transparent",
      )}
    >
      <Avatar name={chat.customer.name} className="w-10 h-10 text-sm" />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5 gap-2">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{chat.customer.name}</h3>
          <span className="text-[10px] text-slate-400 shrink-0">{chat.lastMessageAt ? relativeTime(chat.lastMessageAt) : ""}</span>
        </div>
        <p className={cn("text-xs truncate", chat.unreadByAdmin ? "text-slate-800 font-semibold" : "text-slate-500")}>
          {chat.lastSender === "ai" ? "AI: " : chat.lastSender === "admin" ? "Kamu: " : ""}
          {chat.lastMessage ?? chat.title ?? "—"}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={cn("w-1.5 h-1.5 rounded-full", chat.channel === "whatsapp" ? "bg-emerald-500" : "bg-blue-500")} />
            {chat.channel === "whatsapp" ? "WhatsApp" : "Web"}
          </span>
          <SessionBadge status={chat.status} />
          {chat.priority === "high" && chat.status !== "closed" && <span className="text-[10px] font-bold text-red-600">prioritas</span>}
          {!!chat.unreadByAdmin && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">{chat.unreadByAdmin}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageList({ messages, onOpenBooking }: { messages: ChatMessage[]; onOpenBooking: (id: string) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [last]);

  let lastDay = "";
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
      {messages.map((m) => {
        const day = fmtDateLong(m.createdAt);
        const sep = day !== lastDay;
        lastDay = day;
        return (
          <div key={m.id} className="flex flex-col gap-4">
            {sep && (
              <div className="flex justify-center">
                <span className="text-[10px] font-medium text-slate-400">{day}</span>
              </div>
            )}
            <Bubble m={m} onOpenBooking={onOpenBooking} />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({ m, onOpenBooking }: { m: ChatMessage; onOpenBooking: (id: string) => void }) {
  if (m.sender === "system") {
    return (
      <div className="flex justify-center">
        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{m.message}</span>
      </div>
    );
  }
  if (m.type === "booking_card" && m.booking) {
    const b = m.booking;
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => onOpenBooking(b.id)}
          className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 w-full max-w-[90%] flex items-center justify-between hover:bg-emerald-100/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-800">
                Booking tersimpan · {b.station.name} · <span className="font-mono">{b.bookingCode}</span>
              </h4>
              <p className="text-[10px] text-emerald-600/80 mt-0.5">
                {fmtDateLong(b.startTime)} · {fmtRange(b.startTime, b.endTime)} · {rupiah(b.totalPrice)}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-2">
            <StatusBadge status={b.status} />
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </span>
        </button>
      </div>
    );
  }
  if (m.sender === "customer") {
    return (
      <div className="flex justify-end">
        <div className="bg-white border border-gray-100 shadow-sm text-slate-700 p-3.5 rounded-2xl rounded-tr-sm max-w-[75%] text-sm">
          <p className="whitespace-pre-wrap break-words">{m.message}</p>
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-slate-400">{fmtTime(m.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }
  const isAi = m.sender === "ai";
  return (
    <div className="flex items-end gap-3 max-w-[80%]">
      <div className={cn("w-8 h-8 rounded-full text-white flex items-center justify-center flex-shrink-0 mb-4 shadow-sm", isAi ? "bg-indigo-600" : "bg-emerald-600")}>
        {isAi ? <Bot className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <span className={cn("text-[10px] font-bold ml-1", isAi ? "text-indigo-600" : "text-emerald-700")}>
          {isAi ? "Jadwal.an AI" : `Admin · ${m.admin?.name ?? ""}`}
          {isAi && m.metadata?.agent && <span className="font-medium text-slate-400"> · {AGENT_LABEL[m.metadata.agent] ?? m.metadata.agent}</span>}
        </span>
        <div className={cn("p-3.5 rounded-2xl rounded-tl-sm text-sm border", isAi ? "bg-indigo-50/80 border-indigo-100 text-indigo-900" : "bg-emerald-50/60 border-emerald-100 text-slate-800")}>
          <p className="whitespace-pre-wrap break-words">{m.message}</p>
          <div className="flex justify-end mt-1 gap-1 items-center">
            {isAi && !!m.metadata?.tools?.length && <span className="text-[10px] text-indigo-400 mr-auto">{m.metadata.tools.join(" · ")}</span>}
            {isAi && m.metadata?.latencyMs != null && <span className="text-[10px] text-indigo-400">{(m.metadata.latencyMs / 1000).toFixed(1)} dtk ·</span>}
            <span className={cn("text-[10px]", isAi ? "text-indigo-400" : "text-emerald-600/70")}>{fmtTime(m.createdAt)}</span>
            <CheckCheck className={cn("w-3 h-3", isAi ? "text-indigo-500" : "text-emerald-600")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Composer({ sessionId, status, channel, onSent }: { sessionId: string; status: string; channel: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const { data: replies } = useQuery({ queryKey: ["quick-replies"], queryFn: chatApi.quickReplies, staleTime: 5 * 60_000 });
  const send = useMutation({
    mutationFn: (msg: string) => chatApi.send(sessionId, msg),
    onSuccess: (res) => {
      if (res.deliveryError) toast.warning(res.deliveryError);
      setText("");
      onSent();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const suggestions = useMemo(() => {
    if (!text.startsWith("/")) return [];
    return (replies ?? []).filter((r) => r.isActive && r.shortcut.startsWith(text.toLowerCase().split(" ")[0])).slice(0, 5);
  }, [text, replies]);

  const submit = () => {
    const msg = text.trim();
    if (msg && !send.isPending) send.mutate(msg);
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0 relative">
      {!!suggestions.length && (
        <ul className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setText(r.content)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50">
                <span className="font-mono text-xs font-bold text-indigo-600">{r.shortcut}</span>
                <span className="text-xs text-slate-500"> · {r.title}</span>
                <span className="block text-xs text-slate-600 truncate">{r.content}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3 bg-slate-50 border border-gray-200 rounded-xl px-4 py-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
          placeholder={
            channel === "whatsapp"
              ? "Balasan dikirim langsung ke WhatsApp pelanggan… (ketik / untuk quick reply)"
              : status === "ai_pilot"
                ? "Balas untuk mengambil alih dari AI… (ketik / untuk quick reply)"
                : "Tulis balasan… (ketik / untuk quick reply)"
          }
          aria-label="Tulis balasan"
          className="flex-1 bg-transparent text-sm py-1.5 outline-none text-slate-700 placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || send.isPending}
          aria-label="Kirim"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CustomerPanel({ session, onOpenBooking }: { session: ChatSession; onOpenBooking: (id: string) => void }) {
  return (
    <aside className="hidden xl:flex w-[280px] flex-shrink-0 border-l border-gray-200 bg-white flex-col overflow-y-auto">
      <div className="p-5 border-b border-gray-100 flex flex-col items-center text-center gap-2">
        <Avatar name={session.customer.name} className="w-14 h-14 text-base" />
        <div>
          <p className="font-semibold text-slate-800">{session.customer.name}</p>
          <p className="text-xs text-slate-500">{formatWa(session.customer.whatsapp)}</p>
        </div>
        <div className="flex gap-2">
          <TierBadge tier={session.customer.tier} />
          {session.intent && <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold">{session.intent}</span>}
        </div>
        <a href={`https://wa.me/${session.customer.whatsapp}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-600 hover:underline">
          Buka di WhatsApp
        </a>
      </div>
      {!!session.bookings?.length && (
        <div className="p-5 border-b border-gray-100 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Booking dari sesi ini</p>
          {session.bookings.map((b) => (
            <button key={b.id} type="button" onClick={() => onOpenBooking(b.id)} className="w-full text-left rounded-lg border border-gray-100 p-2.5 hover:bg-slate-50">
              <span className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-slate-800">{b.bookingCode}</span>
                <StatusBadge status={b.status} className="px-2 py-0.5 text-[10px]" />
              </span>
              <span className="text-[11px] text-slate-500">
                {fmtDateLong(b.startTime)} · {rupiah(b.totalPrice)}
              </span>
            </button>
          ))}
        </div>
      )}
      {!!session.events?.length && (
        <div className="p-5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat sesi</p>
          <ol className="space-y-2">
            {session.events.slice(-8).map((e) => (
              <li key={e.id} className="text-[11px] text-slate-600 flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>
                  <b className="text-slate-700">{e.type}</b>
                  {e.note ? ` — ${e.note}` : ""} <span className="text-slate-400">· {relativeTime(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </aside>
  );
}
