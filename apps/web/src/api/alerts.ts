import type { AckAlertResponse, AlertsResponse, ApiErrorResponse } from "@binance-advisor/shared";

async function fetchJsonOrThrow<T>(url: URL, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const maybeError = body as Partial<ApiErrorResponse> | null;
    const message =
      maybeError?.error?.code && maybeError?.error?.message
        ? `[${maybeError.error.code}] ${maybeError.error.message}`
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return body as T;
}

export async function fetchAlerts(
  apiBaseUrl: string,
  params?: { limit?: number; includeAcknowledged?: boolean }
): Promise<AlertsResponse> {
  const url = new URL("/alerts", apiBaseUrl);
  if (typeof params?.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (params?.includeAcknowledged) url.searchParams.set("includeAcknowledged", "true");
  return await fetchJsonOrThrow<AlertsResponse>(url);
}

export async function acknowledgeAlert(apiBaseUrl: string, id: string): Promise<AckAlertResponse> {
  const url = new URL(`/alerts/${encodeURIComponent(id)}/ack`, apiBaseUrl);
  return await fetchJsonOrThrow<AckAlertResponse>(url, { method: "POST" });
}

