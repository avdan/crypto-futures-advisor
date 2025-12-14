import type {
  ApiErrorResponse,
  CreateOrderPlanDraftRequest,
  CreateOrderPlanDraftResponse
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

export async function createOrderPlanDraft(
  apiBaseUrl: string,
  body: CreateOrderPlanDraftRequest
): Promise<CreateOrderPlanDraftResponse> {
  const url = new URL("/futures/order-plan/draft", apiBaseUrl);
  return await fetchJsonOrThrow<CreateOrderPlanDraftResponse>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

