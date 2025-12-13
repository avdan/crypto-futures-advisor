import crypto from "node:crypto";

import { BinanceHttpError } from "./errors.js";

export type BinanceSignedClientOptions = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  recvWindowMs?: number;
};

type QueryValue = string | number | boolean | undefined;

function toSortedSearchParams(params: Record<string, QueryValue>): URLSearchParams {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, String(value)] as const);

  return new URLSearchParams(entries);
}

function signHmacSha256(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export class BinanceSignedClient {
  readonly #apiKey: string;
  readonly #apiSecret: string;
  readonly #baseUrl: string;
  readonly #recvWindowMs: number;
  #timestampOffsetMs: number;

  constructor(options: BinanceSignedClientOptions) {
    this.#apiKey = options.apiKey;
    this.#apiSecret = options.apiSecret;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#recvWindowMs = options.recvWindowMs ?? 5000;
    this.#timestampOffsetMs = 0;
  }

  get baseUrl() {
    return this.#baseUrl;
  }

  setTimestampOffsetMs(offsetMs: number) {
    if (!Number.isFinite(offsetMs)) return;
    this.#timestampOffsetMs = offsetMs;
  }

  async get<TResponse>(
    path: string,
    params: Record<string, QueryValue> = {}
  ): Promise<TResponse> {
    const withTimestamp: Record<string, QueryValue> = {
      ...params,
      recvWindow: this.#recvWindowMs,
      timestamp: Date.now() + this.#timestampOffsetMs
    };

    const searchParams = toSortedSearchParams(withTimestamp);
    const signature = signHmacSha256(this.#apiSecret, searchParams.toString());
    searchParams.set("signature", signature);

    const url = new URL(path, this.#baseUrl);
    url.search = searchParams.toString();

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": this.#apiKey
      }
    });

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    const body = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const code =
        typeof body === "object" && body && "code" in body && typeof body.code === "number"
          ? body.code
          : null;
      const message =
        typeof body === "object" && body && "msg" in body && typeof body.msg === "string"
          ? body.msg
          : `Binance request failed (${res.status})`;

      throw new BinanceHttpError(res.status, code, message, body);
    }

    return body as TResponse;
  }
}
