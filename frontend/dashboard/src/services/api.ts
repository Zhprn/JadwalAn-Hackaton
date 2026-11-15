import { apiClient, qs, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/lib/api-client";
import type {
  AdminUser,
  AiAgent,
  AiInsight,
  AiKnowledge,
  AiLog,
  AiStats,
  Booking,
  BookingStatus,
  ChatMessage,
  ChatSession,
  Customer,
  DashboardSummary,
  Notification,
  PlaygroundResult,
  Promo,
  PromoMessage,
  PromoTarget,
  QuickReply,
  RevenueChart,
  ScheduleData,
  Station,
  StoreSetting,
  WaConfig,
  WaStatus,
  CaptionPlatform,
  CaptionTone,
  PosterCaption,
} from "@/types";

type Q = Record<string, string | number | boolean | undefined | null>;

// ---------------------------------------------------------------- auth
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ user: AdminUser; accessToken: string; refreshToken: string }>("/auth/login", { email, password }),
  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  me: () => apiClient.get<AdminUser>("/auth/me"),
  updateMe: (data: { name?: string; email?: string }) => apiClient.put<AdminUser>("/auth/edit", data),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.put("/auth/password", { currentPassword, newPassword }),
  admins: () => apiClient.get<AdminUser[]>("/auth/admins"),
  registerAdmin: (data: { name: string; email: string; password: string }) => apiClient.post<AdminUser>("/auth/register", data),
  setAdminStatus: (id: string, isActive: boolean) => apiClient.patch<AdminUser>(`/auth/admins/${id}/status`, { isActive }),
};

// ---------------------------------------------------------------- master data
export const settingsApi = {
  get: () => apiClient.get<StoreSetting>("/settings"),
  update: (data: Partial<StoreSetting>) => apiClient.put<StoreSetting>("/settings", data),
};

export type StationInput = Omit<Station, "id">;
export const stationApi = {
  list: (q: Q = {}) => apiClient.get<Station[]>(`/stations${qs(q)}`),
  create: (data: Partial<StationInput>) => apiClient.post<Station>("/stations", data),
  update: (id: string, data: Partial<StationInput>) => apiClient.put<Station>(`/stations/${id}`, data),
  remove: (id: string, force = false) => apiClient.delete<{ message?: string }>(`/stations/${id}${force ? "?force=true" : ""}`),
};

export type PromoInput = Partial<Omit<Promo, "id" | "usedCount" | "createdAt">>;
export const promoApi = {
  list: (q: Q = {}) => apiClient.get<Promo[]>(`/promos${qs(q)}`),
  create: (data: PromoInput) => apiClient.post<Promo>("/promos", data),
  update: (id: string, data: PromoInput) => apiClient.put<Promo>(`/promos/${id}`, data),
  remove: (id: string) => apiClient.delete(`/promos/${id}`),
};

// ---------------------------------------------------------------- bookings
export type AdminBookingInput = {
  stationId: string;
  date: string;
  startTime: string;
  durationHours: number;
  promoCode?: string | null;
  customerId?: string;
  newCustomer?: { name: string; whatsapp: string };
  notes?: string;
  status?: "pending" | "confirmed";
  markPaid?: "cash" | "transfer";
  enforceLead?: boolean;
};

export const bookingApi = {
  list: (q: Q = {}) => apiClient.page<Booking>(`/bookings${qs(q)}`),
  get: (id: string) => apiClient.get<Booking>(`/bookings/${id}`),
  schedule: (date: string) => apiClient.get<ScheduleData>(`/bookings/schedule${qs({ date })}`),
  create: (data: AdminBookingInput) => apiClient.post<Booking>("/bookings/admin", data),
  setStatus: (id: string, status: BookingStatus, reason?: string) =>
    apiClient.patch<Booking>(`/bookings/${id}/status`, { status, reason }),
  reschedule: (id: string, data: { stationId?: string; date?: string; startTime?: string; durationHours?: number }) =>
    apiClient.patch<Booking>(`/bookings/${id}/reschedule`, data),
  setNotes: (id: string, notes: string | null) => apiClient.patch<Booking>(`/bookings/${id}/notes`, { notes }),
  quote: (data: { stationId: string; date: string; startTime: string; durationHours: number; promoCode?: string | null }) =>
    apiClient.post<{ subtotal: number; discount: number; totalPrice: number; promoError: string | null; promoValid: boolean | null }>(
      "/bookings/quote",
      data,
    ),
  export: (q: Q = {}) => apiClient.download(`/bookings/export${qs(q)}`, "booking.xlsx"),
};

export const paymentApi = {
  manual: (bookingId: string, method: "cash" | "transfer") => apiClient.post(`/payments/${bookingId}/manual`, { method }),
  refund: (bookingId: string) => apiClient.post(`/payments/${bookingId}/refund`),
};

// ---------------------------------------------------------------- customers
export const customerApi = {
  list: (q: Q = {}) => apiClient.page<Customer>(`/customers${qs(q)}`),
  get: (id: string) => apiClient.get<Customer>(`/customers/${id}`),
  create: (data: { name: string; whatsapp: string; notes?: string }) =>
    apiClient.post<Customer & { temporaryPassword?: string }>("/customers", data),
  update: (id: string, data: Partial<Pick<Customer, "name" | "whatsapp" | "tier" | "tags" | "notes" | "optOutPromo">>) =>
    apiClient.patch<Customer>(`/customers/${id}`, data),
};

// ---------------------------------------------------------------- dashboard
export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>("/dashboard/summary"),
  revenue: (days = 7) => apiClient.get<RevenueChart>(`/dashboard/revenue${qs({ days })}`),
  stations: (days = 30) =>
    apiClient.get<(Pick<Station, "id" | "name" | "category" | "status"> & { bookings: number; hours: number; revenue: number })[]>(
      `/dashboard/stations${qs({ days })}`,
    ),
};

// ---------------------------------------------------------------- chat
export const chatApi = {
  sessions: (q: Q = {}) => apiClient.page<ChatSession>(`/chat/admin/sessions${qs(q)}`),
  session: (id: string) => apiClient.get<{ session: ChatSession; messages: ChatMessage[] }>(`/chat/admin/sessions/${id}`),
  messagesAfter: (id: string, after?: string) => apiClient.get<ChatMessage[]>(`/chat/sessions/${id}/messages${qs({ after, limit: 100 })}`),
  send: (id: string, message: string) =>
    apiClient.post<{ message: ChatMessage; deliveryError: string | null }>(`/chat/admin/sessions/${id}/messages`, { message }),
  action: (id: string, action: "takeover" | "release" | "close" | "reopen") =>
    apiClient.post<ChatSession>(`/chat/admin/sessions/${id}/${action}`),
  read: (id: string) => apiClient.post(`/chat/sessions/${id}/read`),
  quickReplies: () => apiClient.get<QuickReply[]>("/chat/quick-replies"),
};

// ---------------------------------------------------------------- AI
export const aiApi = {
  status: (ping = false) =>
    apiClient.get<{ configured: boolean; models: Record<string, string>; ping: { ok: boolean; latencyMs: number; error?: string; model?: string } | null }>(
      `/ai/status${qs({ ping })}`,
    ),
  playground: (message: string, history: { role: "user" | "model"; text: string }[], previousIntent?: string) =>
    apiClient.post<PlaygroundResult>("/ai/playground", { message, history, previousIntent }),
  agents: () => apiClient.get<AiAgent[]>("/ai/agents"),
  updateAgent: (feature: string, data: Partial<AiAgent>) => apiClient.put<AiAgent>(`/ai/agents/${feature}`, data),
  knowledge: () => apiClient.get<AiKnowledge[]>("/ai/knowledge"),
  createKnowledge: (data: Partial<AiKnowledge>) => apiClient.post<AiKnowledge>("/ai/knowledge", data),
  updateKnowledge: (id: string, data: Partial<AiKnowledge>) => apiClient.put<AiKnowledge>(`/ai/knowledge/${id}`, data),
  deleteKnowledge: (id: string) => apiClient.delete(`/ai/knowledge/${id}`),
  logs: (q: Q = {}) => apiClient.page<AiLog>(`/ai/logs${qs(q)}`),
  stats: (days = 7) => apiClient.get<AiStats>(`/ai/stats${qs({ days })}`),
  dashboardInsight: (refresh = false) => apiClient.get<AiInsight>(`/ai/insights/dashboard${qs({ refresh })}`),
  customerInsight: (id: string, refresh = false) => apiClient.get<AiInsight>(`/ai/insights/customers/${id}${qs({ refresh })}`),
};

export const promoMessageApi = {
  targets: (q: Q = {}) => apiClient.get<PromoTarget[]>(`/promo-messages/targets${qs(q)}`),
  stats: () => apiClient.get<{ sent: number; drafts: number; converted: number; conversionRate: number }>("/promo-messages/stats"),
  list: (q: Q = {}) => apiClient.page<PromoMessage>(`/promo-messages${qs(q)}`),
  generate: (data: { customerId: string; promoId?: string | null; tone: string; instruction?: string }) =>
    apiClient.post<PromoMessage>("/promo-messages/generate", data),
  regenerate: (id: string, data: { tone?: string; instruction?: string } = {}) =>
    apiClient.post<PromoMessage>(`/promo-messages/${id}/regenerate`, data),
  update: (id: string, data: { content?: string; tags?: string[] }) => apiClient.patch<PromoMessage>(`/promo-messages/${id}`, data),
  send: (id: string) => apiClient.post<PromoMessage & { sentVia: "whatsapp" | "link" }>(`/promo-messages/${id}/send`),
  sendBulk: (ids: string[]) => apiClient.post<{ queued: number; estimatedSeconds: number }>("/promo-messages/send-bulk", { ids }),
  generateBulk: (data: { customerIds: string[]; promoId?: string | null; tone: string }) =>
    apiClient.post<{ customerId: string; ok: boolean; id?: string; error?: string }[]>("/promo-messages/generate-bulk", data),
  remove: (id: string) => apiClient.delete(`/promo-messages/${id}`),
};

// ---------------------------------------------------------------- notifications
export const notificationApi = {
  list: (q: Q = {}) => apiClient.page<Notification>(`/notifications${qs(q)}`),
  read: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  readAll: () => apiClient.post("/notifications/read-all"),
};

// ---------------------------------------------------------------- WhatsApp
export const whatsappApi = {
  status: () => apiClient.get<WaStatus>("/whatsapp/status"),
  connect: () => apiClient.post<WaStatus>("/whatsapp/connect"),
  logout: () => apiClient.post<WaStatus>("/whatsapp/logout"),
  config: (data: Partial<WaConfig>) => apiClient.put<WaConfig>("/whatsapp/config", data),
  test: (to: string, message: string) => apiClient.post("/whatsapp/test", { to, message }),
};

export const copywriterApi = {
  /** Unggah poster → analisis + 1 caption langsung ke promo. */
  generate: (data: { image: File; platform: CaptionPlatform; tone: CaptionTone; notes?: string }) => {
    const form = new FormData();
    form.append("image", data.image);
    form.append("platform", data.platform);
    form.append("tone", data.tone);
    if (data.notes?.trim()) form.append("notes", data.notes.trim());
    return apiClient.post<PosterCaption>("/ai/copywriter/poster", form);
  },
  regenerate: (id: string, data: { platform?: CaptionPlatform; tone?: CaptionTone; notes?: string | null }) =>
    apiClient.post<PosterCaption>(`/ai/copywriter/history/${id}/regenerate`, data),
  history: () => apiClient.get<PosterCaption[]>("/ai/copywriter/history"),
  remove: (id: string) => apiClient.delete(`/ai/copywriter/history/${id}`),
};
