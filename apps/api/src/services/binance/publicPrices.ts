type BinanceTickerPrice = {
  symbol?: string;
  price?: string;
};

export async function fetchFuturesPrice(symbol: string): Promise<number> {
  const baseUrl = process.env.BINANCE_FAPI_BASE_URL ?? "https://fapi.binance.com";

  const url = new URL("/fapi/v1/ticker/price", baseUrl);
  url.searchParams.set("symbol", symbol);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ticker price (${res.status})`);
  }

  const body = (await res.json().catch(() => null)) as BinanceTickerPrice | null;
  const price = body?.price ? Number(body.price) : NaN;
  if (!Number.isFinite(price)) {
    throw new Error("Ticker price was invalid");
  }
  return price;
}

