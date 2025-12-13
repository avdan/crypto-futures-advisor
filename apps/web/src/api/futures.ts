import type {
  ApiErrorResponse,
  FuturesOpenOrdersResponse,
  FuturesPositionsResponse
} from "@binance-advisor/shared";

async function fetchJsonOrThrow<T>(url: URL): Promise<T> {
  const res = await fetch(url);
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

export async function fetchFuturesPositions(
  apiBaseUrl: string,
  opts: { nonZero?: boolean } = {}
): Promise<FuturesPositionsResponse> {
  const url = new URL("/futures/positions", apiBaseUrl);
  if (opts.nonZero) url.searchParams.set("nonZero", "true");
  return await fetchJsonOrThrow<FuturesPositionsResponse>(url);
}

export async function fetchFuturesOpenOrders(
  apiBaseUrl: string,
  symbol?: string
): Promise<FuturesOpenOrdersResponse> {
  const url = new URL("/futures/open-orders", apiBaseUrl);
  if (symbol) url.searchParams.set("symbol", symbol);
  return await fetchJsonOrThrow<FuturesOpenOrdersResponse>(url);
}

