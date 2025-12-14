import type {
  ApiErrorResponse,
  ScannerRunResponse,
  ScannerStatusResponse,
  UpdateWatchlistRequest,
  Watchlist
} from "@binance-advisor/shared";

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

export async function fetchWatchlist(apiBaseUrl: string): Promise<Watchlist> {
  const url = new URL("/watchlist", apiBaseUrl);
  return await fetchJsonOrThrow<Watchlist>(url);
}

export async function updateWatchlist(
  apiBaseUrl: string,
  body: UpdateWatchlistRequest
): Promise<Watchlist> {
  const url = new URL("/watchlist", apiBaseUrl);
  return await fetchJsonOrThrow<Watchlist>(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function fetchScannerStatus(apiBaseUrl: string): Promise<ScannerStatusResponse> {
  const url = new URL("/scanner/status", apiBaseUrl);
  return await fetchJsonOrThrow<ScannerStatusResponse>(url);
}

export async function fetchScannerResults(apiBaseUrl: string): Promise<ScannerRunResponse> {
  const url = new URL("/scanner/results", apiBaseUrl);
  return await fetchJsonOrThrow<ScannerRunResponse>(url);
}

export async function runScanner(apiBaseUrl: string): Promise<ScannerRunResponse> {
  const url = new URL("/scanner/run", apiBaseUrl);
  return await fetchJsonOrThrow<ScannerRunResponse>(url, { method: "POST" });
}

