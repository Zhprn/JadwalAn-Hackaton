export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export const ACCESS_TOKEN_KEY = "accessToken";
export const REFRESH_TOKEN_KEY = "refreshToken";
export const USER_DATA_KEY = "user-data";

/** Endpoint refresh token untuk aplikasi ini (admin). */
const REFRESH_ENDPOINT = "/auth/refresh";
/** Endpoint yang tidak boleh memicu refresh otomatis. */
const NO_REFRESH = ["/auth/login", "/auth/refresh"];

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
};

export type Paged<T> = { data: T[]; meta: PageMeta };

export class ApiError extends Error {
  statusCode: number;
  details: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; skipAuthRefresh?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Hapus sesi & beri tahu AuthProvider (dipakai saat refresh token gagal). */
export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_DATA_KEY);
  window.dispatchEvent(new Event("auth:logout"));
}

let refreshing: Promise<string | null> | null = null;

/** Minta access token baru memakai refresh token (satu request untuk banyak 401 bersamaan). */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}${REFRESH_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const tokens = json?.data;
      if (!tokens?.accessToken) return null;
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      if (tokens.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      return tokens.accessToken as string;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function rawFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { body, headers, skipAuthRefresh, ...rest } = options;
  const build = () => {
    const finalHeaders = new Headers(headers);
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
    const isFormData = body instanceof FormData;
    if (!isFormData && body !== undefined) finalHeaders.set("Content-Type", "application/json");
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  };

  let response = await build();
  const canRefresh = !skipAuthRefresh && !NO_REFRESH.some((p) => endpoint.startsWith(p));
  if (response.status === 401 && canRefresh && localStorage.getItem(ACCESS_TOKEN_KEY)) {
    const newToken = await refreshAccessToken();
    if (newToken) response = await build();
    else clearSession();
  }
  return response;
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Request gagal (${response.status})`;
    throw new ApiError(message, response.status, isRecord(payload) ? (payload.errors ?? payload) : payload);
  }
  return payload;
}

async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const payload = await parse(await rawFetch(endpoint, options));
  if (isRecord(payload) && "data" in payload) return payload.data as T;
  return payload as T;
}

/** Untuk endpoint list ber-paginasi: kembalikan data + meta. */
async function apiPage<T>(endpoint: string, options: RequestOptions = {}): Promise<Paged<T>> {
  const payload = await parse(await rawFetch(endpoint, { ...options, method: "GET" }));
  if (isRecord(payload)) {
    return {
      data: (payload.data as T[]) ?? [],
      meta: (payload.meta as PageMeta) ?? { page: 1, limit: 0, total: 0, totalPages: 1 },
    };
  }
  return { data: [], meta: { page: 1, limit: 0, total: 0, totalPages: 1 } };
}

/** Unduh file (mis. export Excel) dan simpan di browser. */
async function apiDownload(endpoint: string, filename: string) {
  const response = await rawFetch(endpoint, { method: "GET" });
  if (!response.ok) await parse(response);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] ?? filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bangun query string, abaikan nilai kosong. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => apiFetch<T>(endpoint, { ...options, method: "GET" }),
  page: <T>(endpoint: string, options?: RequestOptions) => apiPage<T>(endpoint, options),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: RequestOptions) => apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
  download: apiDownload,
};

/** Ambil pesan error yang ramah untuk toast. */
export function errorMessage(err: unknown, fallback = "Terjadi kesalahan") {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
