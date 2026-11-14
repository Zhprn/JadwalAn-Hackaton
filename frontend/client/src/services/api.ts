import { apiClient, qs, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/lib/api-client";
import type { Availability, Booking, ChatMessage, ChatSession, Customer, Payment, Promo, Quote, Review, Station, StoreSetting } from "@/types";

type Q = Record<string, string | number | boolean | undefined | null>;
type AuthRes = { customer: Pick<Customer, "id" | "name" | "whatsapp" | "tier" | "avatarUrl">; accessToken: string; refreshToken: string };

export const authApi = {
  login: (whatsapp: string, password: string) => apiClient.post<AuthRes>("/customers/login", { whatsapp, password }),
  register: (data: { name: string; whatsapp: string; password: string }) => apiClient.post<AuthRes>("/customers/register", data),
  logout: async () => {
    try {
      await apiClient.post("/customers/logout");
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },
  me: () => apiClient.get<Customer>("/customers/me"),
  updateMe: (data: { name?: string; whatsapp?: string; optOutPromo?: boolean }) => apiClient.put<Customer>("/customers/me", data),
  changePassword: (currentPassword: string, newPassword: string) => apiClient.put("/customers/me/password", { currentPassword, newPassword }),
};

export const publicApi = {
  settings: () => apiClient.get<StoreSetting>("/settings"),
  stations: () => apiClient.get<Station[]>("/stations?status=active"),
  promos: () => apiClient.get<Promo[]>("/promos?isPublic=true&isActive=true&valid=true"),
  availability: (date: string, category?: string) => apiClient.get<Availability>(`/bookings/availability${qs({ date, category })}`),
  reviews: (q: Q = {}) => apiClient.page<Review>(`/reviews${qs(q)}`),
};

export type CreateBookingInput = {
  stationId: string;
  date: string;
  startTime: string;
  durationHours: number;
  promoCode?: string | null;
  notes?: string;
  paymentMethod: "qris" | "cash";
};

export const bookingApi = {
  quote: (data: Omit<CreateBookingInput, "paymentMethod" | "notes">) => apiClient.post<Quote>("/bookings/quote", data),
  create: (data: CreateBookingInput) =>
    apiClient.post<{ booking: Booking; payment: Payment | null; paymentError: string | null; note?: string }>("/bookings", data),
  mine: (q: Q = {}) => apiClient.page<Booking>(`/bookings/me${qs(q)}`),
  get: (id: string) => apiClient.get<Booking>(`/bookings/me/${id}`),
  cancel: (id: string, reason?: string) => apiClient.post<Booking>(`/bookings/me/${id}/cancel`, { reason }),
};

export const paymentApi = {
  qris: (bookingId: string) => apiClient.post<Payment>(`/payments/${bookingId}/qris`),
  status: (bookingId: string) => apiClient.get<Payment>(`/payments/${bookingId}`),
};

export const reviewApi = {
  create: (data: { bookingId: string; rating: number; comment?: string }) => apiClient.post("/reviews", data),
};

export const chatApi = {
  start: () => apiClient.post<{ session: ChatSession; messages: ChatMessage[] }>("/chat/sessions", { channel: "web" }),
  messages: (sessionId: string, after?: string) =>
    apiClient.get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages${qs({ after, limit: 100 })}`),
  send: (sessionId: string, message: string) =>
    apiClient.post<{ session: ChatSession; customerMessage: ChatMessage; replies: ChatMessage[]; ai: { agent: string; handoff: boolean } | null }>(
      `/chat/sessions/${sessionId}/messages`,
      { message },
    ),
  read: (sessionId: string) => apiClient.post(`/chat/sessions/${sessionId}/read`),
};
