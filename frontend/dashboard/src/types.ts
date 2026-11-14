// Tipe data mengikuti respons backend (backend/prisma/schema.prisma).

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
export type Tier = "regular" | "loyal" | "vip";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
  avatarUrl?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface StoreSetting {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  timezone: string;
  openTime: string;
  closeTime: string;
  closedDays: number[];
  minBookingHours: number;
  maxBookingHours: number;
  slotIntervalMins: number;
  bookingLeadMins: number;
  pendingExpiryMins: number;
}

export interface Station {
  id: string;
  name: string;
  category: string;
  pricePerHour: number;
  status: "active" | "maintenance" | "inactive";
  description: string | null;
  imageUrl: string | null;
  maxPlayers: number;
  games: string[];
  sortOrder: number;
}

export interface Promo {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  consoleType: "ALL" | "PS5" | "PS4";
  discountType: "percent" | "nominal";
  discountPercentage: number;
  discountAmount: number;
  maxDiscount: number | null;
  minHours: number;
  minTransaction: number;
  validDays: number[];
  validFrom: string | null;
  validTo: string | null;
  startDate: string;
  validUntil: string;
  isActive: boolean;
  isPublic: boolean;
  targetTier: Tier | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  createdAt: string;
}

export interface CustomerLite {
  id: string;
  name: string;
  whatsapp: string;
  tier: Tier;
}

export interface Payment {
  id: string;
  method: "qris" | "cash" | "transfer";
  status: "pending" | "paid" | "expired" | "failed" | "refunded";
  amount: number;
  qrUrl: string | null;
  paidAt: string | null;
  expiredAt: string | null;
}

export interface Booking {
  id: string;
  bookingCode: string | null;
  startTime: string;
  endTime: string;
  durationHours: number;
  subtotal: number;
  discount: number;
  totalPrice: number;
  status: BookingStatus;
  source: "manual" | "web" | "ai";
  channel: string | null;
  notes: string | null;
  cancelReason: string | null;
  checkedInAt: string | null;
  createdAt: string;
  stationId: string;
  customerId: string;
  station: Pick<Station, "id" | "name" | "category" | "pricePerHour">;
  customer: CustomerLite;
  promo: { id: string; code: string; title: string | null } | null;
  payment: Payment | null;
  review?: { id: string; rating: number; comment: string | null } | null;
  createdBy?: { id: string; name: string } | null;
  chatSession?: { id: string; title: string | null; status: string } | null;
  history?: ActivityLog[];
}

export interface ScheduleData {
  date: string;
  closed: boolean;
  openTime: string;
  closeTime: string;
  stations: (Station & {
    bookings: (Pick<Booking, "id" | "bookingCode" | "startTime" | "endTime" | "status" | "source" | "totalPrice" | "durationHours" | "notes"> & {
      start: string;
      end: string;
      customer: CustomerLite;
      payment: { status: string; method: string } | null;
      promo: { code: string } | null;
    })[];
  })[];
}

export interface Customer extends CustomerLite {
  avatarUrl: string | null;
  totalHours: number;
  totalSessions: number;
  totalSpent: number;
  lastPlayed: string | null;
  favoriteConsole: string | null;
  favoriteHour: string | null;
  optOutPromo: boolean;
  createdAt: string;
  tags?: string[];
  notes?: string | null;
  lastPromoSentAt?: string | null;
  bookings?: Booking[];
  reviews?: { id: string; rating: number; comment: string | null; createdAt: string }[];
  promoMessages?: PromoMessage[];
  _count?: { bookings: number; chatSessions: number };
}

export interface DailyMetric {
  totalRevenue: number;
  occupancyRate: number;
  slotsFilled: number;
  slotsTotal: number;
  totalBookings: number;
  aiBookings: number;
  cancelledBookings: number;
  newCustomers: number;
  chatSessions: number;
  peakHour: string | null;
}

export interface DashboardSummary {
  date: string;
  metrics: DailyMetric;
  comparison: { revenue: number; bookings: number; occupancy: number };
  upcoming: Booking[];
  nowPlaying: Booking[];
  pendingPayments: number;
  chats: Record<string, number>;
  unreadNotifications: number;
}

export interface RevenueChart {
  days: { date: string; revenue: number; bookings: number; aiBookings: number; cancelled: number; occupancyRate: number }[];
  totalRevenue: number;
  totalBookings: number;
}

export interface AiInsight {
  id: string;
  type: string;
  title: string | null;
  content: string;
  data: { highlights?: string[]; recommendations?: string[]; tags?: string[]; churnRisk?: string } | null;
  createdAt: string;
  expiresAt: string | null;
}

export type SessionStatus = "ai_pilot" | "human" | "closed";

export interface ChatSession {
  id: string;
  title: string | null;
  summary: string | null;
  channel: string;
  status: SessionStatus;
  intent: string | null;
  priority: "normal" | "high";
  customerId: string;
  customer: CustomerLite & { avatarUrl: string | null };
  assignedAdminId: string | null;
  assignedAdmin: { id: string; name: string; avatarUrl: string | null } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastSender: string | null;
  unreadByAdmin: number;
  unreadByCustomer: number;
  rating: number | null;
  createdAt: string;
  events?: { id: string; type: string; note: string | null; createdAt: string; admin: { id: string; name: string } | null }[];
  bookings?: { id: string; bookingCode: string | null; status: BookingStatus; startTime: string; totalPrice: number }[];
}

export interface ChatMessage {
  id: string;
  sender: "customer" | "ai" | "admin" | "system";
  type: string;
  message: string;
  metadata: { agent?: string; intent?: string; latencyMs?: number; model?: string; tools?: string[]; routedBy?: string } | null;
  createdAt: string;
  admin: { id: string; name: string } | null;
  booking: {
    id: string;
    bookingCode: string | null;
    status: BookingStatus;
    startTime: string;
    endTime: string;
    totalPrice: number;
    station: { name: string };
  } | null;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  isActive: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PromoMessage {
  id: string;
  content: string;
  tone: string;
  tags: string[];
  version: number;
  status: "draft" | "sent" | "failed";
  sentAt: string | null;
  createdAt: string;
  customerId: string;
  promoId: string | null;
  customer?: { id: string; name: string; whatsapp: string; tier?: Tier };
  promo?: { id: string; code: string } | null;
  waLink?: string;
}

export interface PromoTarget extends CustomerLite {
  lastPlayed: string | null;
  totalSessions: number;
  totalSpent: number;
  favoriteConsole: string | null;
  lastPromoSentAt: string | null;
  daysAbsent: number | null;
}

export interface AiAgent {
  id: string;
  feature: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  autoReply: boolean;
  canCreateBooking: boolean;
  bookingStatus: "pending" | "confirmed";
  greetingMessage: string | null;
  fallbackMessage: string | null;
  handoffKeywords: string[];
  activeFrom: string | null;
  activeTo: string | null;
}

export interface AiKnowledge {
  id: string;
  category: string;
  question: string | null;
  content: string;
  isActive: boolean;
  priority: number;
  updatedAt: string;
}

export interface AiLog {
  id: string;
  feature: string;
  model: string;
  input: { message?: string; agent?: string; intent?: string } | null;
  output: { reply?: string; handoff?: boolean } | null;
  toolCalls: { name: string; ms: number }[] | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  status: "success" | "error" | "handoff";
  errorMessage: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
}

export interface AiStats {
  days: number;
  totalCalls: number;
  avgLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  byStatus: Record<string, number>;
  byFeature: { feature: string; calls: number; avgLatencyMs: number }[];
  aiBookings: number;
  handoffs: number;
}

export interface PlaygroundResult {
  reply: string;
  agent: string;
  intent: string;
  routedBy: string;
  handoff: boolean;
  toolCalls: { name: string; ms: number }[];
  model: string;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number };
  status: string;
  error?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: unknown;
  createdAt: string;
  user: { id: string; name: string } | null;
}
