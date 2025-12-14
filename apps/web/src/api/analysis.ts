import type {
  ApiErrorResponse,
  FuturesPositionAnalysisRequest,
  FuturesPositionAnalysisResponse
} from "@binance-advisor/shared";

async function fetchJsonOrThrow<T>(url: URL, init: RequestInit): Promise<T> {
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

export async function analyzeFuturesPosition(
  apiBaseUrl: string,
  body: FuturesPositionAnalysisRequest
): Promise<FuturesPositionAnalysisResponse> {
  const url = new URL("/futures/analysis/position", apiBaseUrl);
  return await fetchJsonOrThrow<FuturesPositionAnalysisResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

