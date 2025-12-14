import fs from "node:fs/promises";
import path from "node:path";

import type { Watchlist } from "@binance-advisor/shared";

import { resolveApiDataDir } from "../storage/paths.js";

const DEFAULT_WATCHLIST: string[] = [
  "BTCUSDC",
  "XRPUSDC",
  "SOLUSDC",
  "ZECUSDC",
  "ETHUSDC",
  "BNBUSDC",
  "BCHUSDC",
  "SUIUSDC",
  "TONUSDC",
  "DOGEUSDC"
];

function normalizeSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  if (!symbol) return null;
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) return null;
  return symbol;
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function parseSymbolsEnv(): string[] | null {
  const raw = process.env.WATCHLIST_SYMBOLS?.trim();
  if (!raw) return null;

  const symbols = raw
    .split(",")
    .map((s) => normalizeSymbol(s))
    .filter((s): s is string => Boolean(s));

  return symbols.length ? uniq(symbols) : null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmp = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export type WatchlistStore = {
  get(): Promise<Watchlist>;
  set(symbols: string[]): Promise<Watchlist>;
};

export function createWatchlistStore(): WatchlistStore {
  const dataDir = resolveApiDataDir();
  const filePath = path.join(dataDir, "watchlist.json");

  async function get(): Promise<Watchlist> {
    const existing = await readJsonFile<Watchlist>(filePath);
    if (existing?.symbols?.length) return existing;

    const symbols = parseSymbolsEnv() ?? DEFAULT_WATCHLIST;
    const watchlist: Watchlist = {
      symbols,
      updatedAt: new Date().toISOString()
    };

    // Persist initial watchlist so it’s editable via the API.
    await writeJsonFile(filePath, watchlist);
    return watchlist;
  }

  async function set(symbolsRaw: string[]): Promise<Watchlist> {
    const symbols = uniq(
      symbolsRaw
        .map((s) => normalizeSymbol(s))
        .filter((s): s is string => Boolean(s))
    );

    if (symbols.length === 0) {
      throw new Error("Watchlist must contain at least one valid symbol.");
    }
    if (symbols.length > 50) {
      throw new Error("Watchlist is too large (max 50 symbols).");
    }

    const watchlist: Watchlist = { symbols, updatedAt: new Date().toISOString() };
    await writeJsonFile(filePath, watchlist);
    return watchlist;
  }

  return { get, set };
}
