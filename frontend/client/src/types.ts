// Tipe data mengikuti respons backend.

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
export type Tier = "regular" | "loyal" | "vip";

export interface Customer {
  id: string;
  name: string;
  whatsapp: string;
  avatarUrl: string | null;
  tier: Tier;
  totalHours: number;
  totalSessions: number;
  totalSpent: number;
  lastPlayed: string | null;
  favoriteConsole: string | null;
  favoriteHour: string | null;
  optOutPromo: boolean;
  createdAt: string;
}

export interface StoreSetting {
  name: string;
  address: string | null;
  phone: string | null;
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
  status: string;
  description: string | null;
  imageUrl: string | null;
  maxPlayers: number;
  games: string[];
}

export interface Slot {
  start: string;
  end: string;
  available: boolean;
  maxHours: number;
}

export interface Availability {
  date: string;
  openTime: string;
  closeTime: string;
  slotIntervalMins: number;
  minBookingHours: number;
  maxBookingHours: number;
  closed: boolean;
  stations: {
    station: { id: string; name: string; category: string; pricePerHour: number; maxPlayers: number };
    availableCount: number;
    slots: Slot[];
  }[];
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
  validUntil: string;
  targetTier: Tier | null;
}

export interface Quote {
  station: { id: string; name: string; category: string; pricePerHour: number };
  startTime: string;
  endTime: string;
  durationHours: number;
  subtotal: number;
  discount: number;
  totalPrice: number;
  promo: { id: string; code: string; title: string | null } | null;
  promoValid: boolean | null;
  promoError: string | null;
}

export interface Payment {
  id: string;
  bookingId?: string;
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
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  station: { id: string; name: string; category: string; pricePerHour: number };
  promo: { id: string; code: string; title: string | null } | null;
  payment: Payment | null;
  review: { id: string; rating: number; comment: string | null } | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: { name: string; avatarUrl: string | null };
  booking: { station: { name: string; category: string } } | null;
}

export interface ChatSession {
  id: string;
  title: string | null;
  status: "ai_pilot" | "human" | "closed";
  assignedAdmin: { id: string; name: string } | null;
  unreadByCustomer: number;
}

export interface ChatMessage {
  id: string;
  sender: "customer" | "ai" | "admin" | "system";
  type: string;
  message: string;
  metadata: { agent?: string; latencyMs?: number } | null;
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
