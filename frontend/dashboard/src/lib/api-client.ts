export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type ApiResponse<TData, TMeta = unknown> = {
  statusCode: number;
  message: string;
  data: TData;
  meta?: TMeta;
};

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

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  const token = localStorage.getItem("accessToken");
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);

  const isFormData = body instanceof FormData;
  if (!isFormData) finalHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  const text = await response.text();
  let rawPayload: unknown = null;
  try {
    rawPayload = text ? JSON.parse(text) : null;
  } catch {
    rawPayload = text;
  }

  if (!response.ok) {
    const error = isRecord(rawPayload) ? rawPayload.error : undefined;
    const message =
      typeof error === "string"
        ? error
        : isRecord(rawPayload) && typeof rawPayload.message === "string"
          ? rawPayload.message
          : `Request gagal (${response.status})`;
    throw new ApiError(message, response.status, error ?? rawPayload);
  }

  if (isRecord(rawPayload) && "data" in rawPayload) {
    return rawPayload.data as T;
  }
  return rawPayload as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiFetch<T>(endpoint, { ...options, method: "DELETE" }),
};
