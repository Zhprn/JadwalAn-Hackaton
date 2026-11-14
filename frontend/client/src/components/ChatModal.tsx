import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Bot, Headphones, Send, Maximize2, Minimize2, CalendarDays, ArrowUpRight, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/auth";
import { chatApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { fmtDateLong, fmtRange, fmtTime, rupiah } from "@/lib/format";
import { StatusPill } from "./ui-bits";
import type { ChatMessage, ChatSession } from "@/types";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK = ["Cek jadwal kosong hari ini", "Promo hari ini apa?", "Booking saya", "Hubungi admin"];

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const auth = useAuth();
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    onClose();
    setTimeout(() => setIsExpanded(false), 400);
  };

  const merge = (incoming: ChatMessage[]) =>
    setMessages((prev) => {
      const map = new Map(prev.filter((m) => !m.id.startsWith("tmp-")).map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });

  // Mulai / lanjutkan sesi saat modal dibuka.
  useEffect(() => {
    if (!isOpen || !auth.isAuthenticated || session) return;
    setStarting(true);
    setError(null);
    chatApi
      .start()
      .then((res) => {
        setSession(res.session);
        setMessages(res.messages);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setStarting(false));
  }, [isOpen, auth.isAuthenticated, session]);

  // Reset saat logout.
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setSession(null);
      setMessages([]);
    }
  }, [auth.isAuthenticated]);

  // Polling pesan baru (balasan admin) selama modal terbuka.
  useEffect(() => {
    if (!isOpen || !session) return;
    const tick = async () => {
      const last = messages.filter((m) => !m.id.startsWith("tmp-")).at(-1)?.createdAt;
      try {
        const fresh = await chatApi.messages(session.id, last);
        if (fresh.length) {
          merge(fresh);
          // Perbarui status sesi bila admin mengambil alih / AI kembali.
          if (fresh.some((m) => m.sender === "system" || m.sender === "admin")) {
            const res = await chatApi.start();
            setSession(res.session);
          }
        }
      } catch {
        // abaikan; coba lagi di tick berikutnya
      }
    };
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [isOpen, session, messages]);

  useEffect(() => {
    if (isOpen && session) chatApi.read(session.id).catch(() => undefined);
  }, [isOpen, session, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (text?: string) => {
    const msg = (text ?? message).trim();
    if (!msg || !session || sending) return;
    setMessage("");
    setSending(true);
    setError(null);
    const temp: ChatMessage = { id: `tmp-${Date.now()}`, sender: "customer", type: "text", message: msg, metadata: null, createdAt: new Date().toISOString(), admin: null, booking: null };
    setMessages((m) => [...m, temp]);
    try {
      const res = await chatApi.send(session.id, msg);
      merge([res.customerMessage, ...res.replies]);
      setSession((s) => (s ? { ...s, status: res.session.status } : s));
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setMessage(msg);
      setError(errorMessage(e, "Pesan gagal terkirim"));
    } finally {
      setSending(false);
    }
  };

  const statusText =
    session?.status === "human"
      ? session.assignedAdmin
        ? `Admin ${session.assignedAdmin.name} sedang membantu`
        : "Menunggu admin membalas"
      : "AI siap membantu · balasan instan";

  const modalClasses = `
    fixed z-[100] flex flex-col bg-white overflow-hidden font-sans shadow-[0_8px_30px_rgb(0,0,0,0.12)]
    transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom-right
    ${isExpanded ? "bottom-0 right-0 w-full h-[100dvh] rounded-none border-0" : "bottom-24 right-4 md:bottom-28 md:right-8 w-[calc(100vw-2rem)] max-w-[400px] h-[min(600px,calc(100dvh-8rem))] rounded-2xl border border-slate-100"}
    ${isOpen ? "opacity-100 translate-y-0 scale-100 pointer-events-auto visible" : "opacity-0 translate-y-12 scale-90 pointer-events-none invisible"}
  `;

  return (
    <div className={modalClasses} role="dialog" aria-label="Chat dengan asisten JadwalAn" aria-hidden={!isOpen}>
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${session?.status === "human" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}>
            {session?.status === "human" ? <Headphones className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Asisten JadwalAn</h3>
            <p className={`text-[10px] font-semibold flex items-center gap-1 ${session?.status === "human" ? "text-emerald-600" : "text-indigo-600"}`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${session?.status === "human" ? "bg-emerald-500" : "bg-indigo-500"}`} />
              {auth.isAuthenticated ? statusText : "Masuk untuk mulai chat"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
            aria-label={isExpanded ? "Perkecil" : "Perbesar"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors" aria-label="Tutup chat">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!auth.isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Bot className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-slate-900">Tanya jadwal, harga, atau booking lewat chat</h4>
          <p className="text-sm text-slate-500">Masuk dulu supaya AI bisa membuatkan booking atas namamu.</p>
          <Link to="/login" onClick={handleClose} className="mt-2 inline-flex items-center gap-2 bg-indigo-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-700">
            <LogIn className="w-4 h-4" /> Masuk
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {starting && (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} onNavigate={handleClose} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#F8F9FF] border border-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            {error && <p className="text-center text-xs text-red-600 bg-red-50 rounded-lg py-2 px-3">{error}</p>}
            <div ref={endRef} />
          </div>

          <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!session || sending}
                  onClick={() => send(q === "Hubungi admin" ? "Saya mau bicara dengan admin" : q)}
                  className="text-[11px] font-semibold text-indigo-600 border border-indigo-100 bg-white px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tulis pesanmu di sini..."
                aria-label="Tulis pesan"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all text-slate-700 placeholder:text-slate-400"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={!session}
              />
              <button
                type="button"
                className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!message.trim() || sending || !session}
                onClick={() => send()}
                aria-label="Kirim"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-[9px] text-slate-400 mt-3">AI untuk jawaban cepat. Ketik "admin" untuk bantuan personal.</p>
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ m, onNavigate }: { m: ChatMessage; onNavigate: () => void }) {
  if (m.sender === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full">
          <Headphones className="w-3 h-3" /> {m.message}
        </span>
      </div>
    );
  }
  if (m.type === "booking_card" && m.booking) {
    const b = m.booking;
    return (
      <Link to="/jadwal" onClick={onNavigate} className="block border border-slate-200 rounded-2xl p-4 hover:border-indigo-300 transition-colors">
        <div className="flex justify-between items-center mb-2">
          <StatusPill status={b.status} />
          <span className="font-mono text-[11px] font-bold text-slate-500">{b.bookingCode}</span>
        </div>
        <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" /> {b.station.name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {fmtDateLong(b.startTime)} · {fmtRange(b.startTime, b.endTime)}
        </p>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
          <span className="font-extrabold text-slate-900">{rupiah(b.totalPrice)}</span>
          <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
            Lihat jadwal <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </Link>
    );
  }
  if (m.sender === "customer") {
    return (
      <div className="flex justify-end">
        <div className={`bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] leading-relaxed whitespace-pre-wrap break-words ${m.id.startsWith("tmp-") ? "opacity-70" : ""}`}>
          {m.message}
        </div>
      </div>
    );
  }
  const isAdmin = m.sender === "admin";
  return (
    <div className="flex justify-start flex-col gap-1">
      <span className={`text-[10px] font-bold ml-1 ${isAdmin ? "text-emerald-700" : "text-slate-500"}`}>{isAdmin ? `Admin · ${m.admin?.name ?? ""}` : "AI JadwalAn"}</span>
      <div
        className={`text-slate-700 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] leading-relaxed border whitespace-pre-wrap break-words ${
          isAdmin ? "bg-emerald-50/50 border-emerald-100/50" : "bg-[#F8F9FF] border-slate-50"
        }`}
      >
        {m.message}
      </div>
      <span className="text-[9px] text-slate-400 ml-1">{fmtTime(m.createdAt)}</span>
    </div>
  );
}
