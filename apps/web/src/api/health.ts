import type { HealthzResponse } from "@binance-advisor/shared";

export async function fetchHealthz(
  apiBaseUrl: string
): Promise<HealthzResponse> {
  const url = new URL("/healthz", apiBaseUrl);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }

  return (await res.json()) as HealthzResponse;
}

