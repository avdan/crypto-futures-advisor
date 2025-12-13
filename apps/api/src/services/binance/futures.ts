import { BinanceSignedClient } from "./signedClient.js";

type BinanceFuturesPositionRisk = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit?: string;
  unrealizedProfit?: string;
  liquidationPrice: string;
  leverage: string;
  marginType: "isolated" | "cross";
  isolatedMargin: string;
  positionSide: "BOTH" | "LONG" | "SHORT";
  notional: string;
  updateTime?: number | string;
};

type BinanceFuturesOpenOrder = {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  side: "BUY" | "SELL";
  positionSide: "BOTH" | "LONG" | "SHORT";
  type: string;
  status: string;
  timeInForce: string;
  reduceOnly: boolean;
  price: string;
  origQty: string;
  executedQty: string;
  stopPrice?: string;
  time?: number;
  updateTime?: number;
};

const TIME_OFFSET_TTL_MS = 5 * 60_000;
const TIME_OFFSET_TIMEOUT_MS = 1500;

let cachedOffsetMs: number | null = null;
let cachedOffsetAtMs = 0;
let offsetInFlight: Promise<number> | null = null;

export function createFuturesClient() {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;
  const baseUrl = process.env.BINANCE_FAPI_BASE_URL ?? "https://fapi.binance.com";

  if (!apiKey || !apiSecret) return null;

  return new BinanceSignedClient({
    apiKey,
    apiSecret,
    baseUrl
  });
}

async function getFuturesTimeOffsetMs(baseUrl: string): Promise<number> {
  const now = Date.now();
  if (cachedOffsetMs !== null && now - cachedOffsetAtMs < TIME_OFFSET_TTL_MS) {
    return cachedOffsetMs;
  }

  if (offsetInFlight) return await offsetInFlight;

  offsetInFlight = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIME_OFFSET_TIMEOUT_MS);
    try {
      const url = new URL("/fapi/v1/time", baseUrl);
      const res = await fetch(url, { signal: controller.signal });
      const body = (await res.json().catch(() => null)) as
        | { serverTime?: number }
        | null;

      if (!res.ok || typeof body?.serverTime !== "number") {
        cachedOffsetMs = 0;
        cachedOffsetAtMs = now;
        return cachedOffsetMs;
      }

      cachedOffsetMs = body.serverTime - Date.now();
      cachedOffsetAtMs = now;
      return cachedOffsetMs;
    } catch {
      cachedOffsetMs = 0;
      cachedOffsetAtMs = now;
      return cachedOffsetMs;
    } finally {
      clearTimeout(timeoutId);
      offsetInFlight = null;
    }
  })();

  return await offsetInFlight;
}

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNull(value: number | string | undefined): string | null {
  if (value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}

export async function fetchFuturesPositionRisk(client: BinanceSignedClient) {
  client.setTimestampOffsetMs(await getFuturesTimeOffsetMs(client.baseUrl));
  const rows = await client.get<BinanceFuturesPositionRisk[]>("/fapi/v2/positionRisk");

  return rows.map((row) => {
    const amount = Number(row.positionAmt);
    const liquidation = Number(row.liquidationPrice);
    const unrealized =
      row.unRealizedProfit ?? row.unrealizedProfit ?? "0";

    return {
      symbol: row.symbol,
      positionSide: row.positionSide,
      marginType: row.marginType,
      amount,
      entryPrice: Number(row.entryPrice),
      markPrice: Number(row.markPrice),
      unrealizedPnl: Number(unrealized),
      notional: Number(row.notional),
      leverage: Number(row.leverage),
      liquidationPrice: liquidation > 0 ? liquidation : null,
      isolatedMargin:
        row.marginType === "isolated" ? toNumberOrNull(row.isolatedMargin) : null,
      updatedAt: toIsoOrNull(row.updateTime)
    };
  });
}

export async function fetchFuturesOpenOrders(
  client: BinanceSignedClient,
  symbol?: string
) {
  client.setTimestampOffsetMs(await getFuturesTimeOffsetMs(client.baseUrl));
  const rows = await client.get<BinanceFuturesOpenOrder[]>("/fapi/v1/openOrders", {
    symbol
  });

  return rows.map((row) => ({
    symbol: row.symbol,
    orderId: row.orderId,
    clientOrderId: row.clientOrderId,
    side: row.side,
    positionSide: row.positionSide,
    type: row.type,
    status: row.status,
    timeInForce: row.timeInForce,
    reduceOnly: Boolean(row.reduceOnly),
    price: Number(row.price),
    origQty: Number(row.origQty),
    executedQty: Number(row.executedQty),
    stopPrice: row.stopPrice ? Number(row.stopPrice) : null,
    time: row.time ? new Date(row.time).toISOString() : null,
    updateTime: row.updateTime ? new Date(row.updateTime).toISOString() : null
  }));
}
