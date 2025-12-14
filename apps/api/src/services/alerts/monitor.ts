import type { AlertSeverity, AlertType, ScannerRunResponse, SetupCandidate } from "@binance-advisor/shared";

import { getTelegramConfig } from "../../config.js";
import { positionDirection } from "../../domain/risk/positionPlan.js";
import { createFuturesClient, fetchFuturesOpenOrders, fetchFuturesPositionRisk } from "../binance/futures.js";
import { fetchFuturesPrice } from "../binance/publicPrices.js";
import { sendTelegramMessage } from "../notifications/telegram.js";
import type { AlertStore } from "./store.js";
import { resolveApiDataDir } from "../storage/paths.js";

import fs from "node:fs/promises";
import path from "node:path";

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

type AlertsMonitorConfig = {
  enabled: boolean;
  intervalMs: number;
  dedupeWindowMs: number;
  liquidationDistancePct: number;
  stopDistancePct: number;
  takeProfitDistancePct: number;
  entryDistancePct: number;
  setupsEntryEnabled: boolean;
  topSetupsAlertEnabled: boolean;
  topSetupsCount: number;
};

function parseBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getConfig(): AlertsMonitorConfig {
  const intervalSeconds = Math.max(10, Math.min(parseNumber(process.env.ALERTS_INTERVAL_SECONDS, 30), 600));
  const dedupeMinutes = Math.max(1, Math.min(parseNumber(process.env.ALERT_DEDUPE_WINDOW_MINUTES, 30), 24 * 60));

  const liquidationDistancePct = Math.max(0.1, Math.min(parseNumber(process.env.ALERT_LIQUIDATION_DISTANCE_PCT, 5), 50));
  const stopDistancePct = Math.max(0.05, Math.min(parseNumber(process.env.ALERT_STOP_DISTANCE_PCT, 0.5), 10));
  const takeProfitDistancePct = Math.max(0.05, Math.min(parseNumber(process.env.ALERT_TP_DISTANCE_PCT, 0.6), 10));
  const entryDistancePct = Math.max(0.05, Math.min(parseNumber(process.env.ALERT_ENTRY_DISTANCE_PCT, 0.2), 5));

  const topSetupsCount = Math.max(1, Math.min(Math.floor(parseNumber(process.env.ALERT_TOP_SETUPS_COUNT, 3)), 10));

  return {
    enabled: parseBool(process.env.ALERTS_ENABLED, true),
    intervalMs: intervalSeconds * 1000,
    dedupeWindowMs: dedupeMinutes * 60_000,
    liquidationDistancePct,
    stopDistancePct,
    takeProfitDistancePct,
    entryDistancePct,
    setupsEntryEnabled: parseBool(process.env.ALERT_SETUPS_ENTRY_ENABLED, true),
    topSetupsAlertEnabled: parseBool(process.env.ALERT_TOP_SETUPS_ENABLED, true),
    topSetupsCount
  };
}

function pctDistance(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (Math.abs(a - b) / Math.abs(a)) * 100;
}

function liquidationDistancePct(params: { dir: "LONG" | "SHORT"; mark: number; liq: number }): number | null {
  if (!Number.isFinite(params.mark) || params.mark <= 0) return null;
  if (!Number.isFinite(params.liq) || params.liq <= 0) return null;
  const dist = params.dir === "LONG" ? (params.mark - params.liq) / params.mark : (params.liq - params.mark) / params.mark;
  return dist * 100;
}

function titleFor(type: AlertType, symbol: string | null) {
  const s = symbol ? ` ${symbol}` : "";
  if (type === "LIQUIDATION_RISK") return `Liquidation risk${s}`;
  if (type === "STOP_PROXIMITY") return `Stop proximity${s}`;
  if (type === "TAKE_PROFIT_PROXIMITY") return `Take-profit proximity${s}`;
  if (type === "ENTRY_ZONE_HIT") return `Entry zone hit${s}`;
  if (type === "NEW_TOP_SETUPS") return "New top setups";
  return "System";
}

function severityFor(type: AlertType): AlertSeverity {
  if (type === "LIQUIDATION_RISK") return "CRITICAL";
  if (type === "STOP_PROXIMITY") return "WARN";
  if (type === "TAKE_PROFIT_PROXIMITY") return "INFO";
  if (type === "ENTRY_ZONE_HIT") return "INFO";
  if (type === "NEW_TOP_SETUPS") return "INFO";
  return "INFO";
}

function formatSetupLine(s: SetupCandidate) {
  const entry = s.entryZone ? `${s.entryZone[0].toFixed(2)}–${s.entryZone[1].toFixed(2)}` : s.entry.toFixed(2);
  return `${s.symbol} ${s.timeframe} ${s.direction} ${s.strategy} score=${s.score} entry=${entry} SL=${s.stopLoss.toFixed(2)} TP=${s.takeProfit.toFixed(2)}`;
}

async function readLatestScan(): Promise<ScannerRunResponse | null> {
  try {
    const filePath = path.join(resolveApiDataDir(), "scanner-latest.json");
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as ScannerRunResponse;
  } catch {
    return null;
  }
}

export type AlertsMonitor = {
  start(): void;
  stop(): void;
};

export function createAlertsMonitor(params: { store: AlertStore; logger: Logger }): AlertsMonitor {
  const config = getConfig();
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function maybeSendTelegram(text: string) {
    const tg = getTelegramConfig();
    if (!tg) return;
    await sendTelegramMessage({ botToken: tg.botToken, chatId: tg.chatId, text });
  }

  async function createAlert(paramsIn: {
    type: AlertType;
    symbol: string | null;
    message: string;
    dedupeKey: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const existing = await params.store.findRecentByDedupeKey({
      dedupeKey: paramsIn.dedupeKey,
      sinceMs: config.dedupeWindowMs
    });
    if (existing) return null;

    const alert = await params.store.add({
      type: paramsIn.type,
      severity: severityFor(paramsIn.type),
      title: titleFor(paramsIn.type, paramsIn.symbol),
      message: paramsIn.message,
      symbol: paramsIn.symbol,
      dedupeKey: paramsIn.dedupeKey,
      metadata: paramsIn.metadata ?? null
    });

    try {
      await maybeSendTelegram(`⚡ ${alert.title}\n${alert.message}`);
    } catch (err) {
      params.logger.warn({ err }, "Telegram send failed");
    }

    return alert;
  }

  async function checkScanner() {
    if (!config.topSetupsAlertEnabled && !config.setupsEntryEnabled) return;

    const latest = await readLatestScan();
    if (!latest) return;
    const runAt = latest.runAt;
    const top = (latest.results ?? []).slice(0, Math.max(config.topSetupsCount, 10));

    if (config.topSetupsAlertEnabled) {
      const topLines = top.slice(0, config.topSetupsCount).map(formatSetupLine);
      const message =
        topLines.length === 0
          ? `Scanner run ${runAt}: no setups found.`
          : `Scanner run ${runAt}:\n` + topLines.map((l) => `- ${l}`).join("\n");

      await createAlert({
        type: "NEW_TOP_SETUPS",
        symbol: null,
        message,
        dedupeKey: `NEW_TOP_SETUPS:${runAt}`,
        metadata: { runAt, topCount: topLines.length }
      });
    }

    if (!config.setupsEntryEnabled || top.length === 0) return;

    const symbols = Array.from(new Set(top.map((s) => s.symbol))).slice(0, 15);
    const priceEntries = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const price = await fetchFuturesPrice(symbol);
          return [symbol, price] as const;
        } catch {
          return [symbol, null] as const;
        }
      })
    );
    const prices = new Map(priceEntries);

    for (const setup of top.slice(0, 10)) {
      const price = prices.get(setup.symbol);
      if (!price || !Number.isFinite(price)) continue;

      const zone = setup.entryZone ?? [setup.entry, setup.entry];
      const low = Math.min(zone[0], zone[1]);
      const high = Math.max(zone[0], zone[1]);

      const tol = (config.entryDistancePct / 100) * price;
      const inZone = price >= low - tol && price <= high + tol;
      if (!inZone) continue;

      await createAlert({
        type: "ENTRY_ZONE_HIT",
        symbol: setup.symbol,
        message: `Price ${price.toFixed(2)} entered entry zone ${low.toFixed(2)}–${high.toFixed(2)} (${setup.timeframe} ${setup.strategy}).`,
        dedupeKey: `ENTRY_ZONE_HIT:${runAt}:${setup.symbol}:${setup.timeframe}:${setup.strategy}`,
        metadata: { runAt, price, entryZone: [low, high], timeframe: setup.timeframe, strategy: setup.strategy }
      });
    }
  }

  async function checkPositions() {
    const client = createFuturesClient();
    if (!client) return;

    const positions = (await fetchFuturesPositionRisk(client)).filter((p) => p.amount !== 0);
    if (positions.length === 0) return;

    for (const p of positions.slice(0, 25)) {
      const dir = positionDirection(p);
      if (dir === "FLAT") continue;

      if (p.liquidationPrice) {
        const dist = liquidationDistancePct({
          dir,
          mark: p.markPrice,
          liq: p.liquidationPrice
        });
        if (dist !== null && dist <= config.liquidationDistancePct) {
          await createAlert({
            type: "LIQUIDATION_RISK",
            symbol: p.symbol,
            message: `Mark ${p.markPrice.toFixed(2)} is ${dist.toFixed(2)}% from liquidation (${p.liquidationPrice.toFixed(2)}).`,
            dedupeKey: `LIQUIDATION_RISK:${p.symbol}:${p.positionSide}`,
            metadata: {
              markPrice: p.markPrice,
              liquidationPrice: p.liquidationPrice,
              distancePct: dist,
              leverage: p.leverage
            }
          });
        }
      }

      let orders = [] as Awaited<ReturnType<typeof fetchFuturesOpenOrders>>;
      try {
        orders = await fetchFuturesOpenOrders(client, p.symbol);
      } catch (err) {
        params.logger.warn({ err, symbol: p.symbol }, "Open orders fetch failed");
        continue;
      }

      const closeSide = dir === "LONG" ? "SELL" : "BUY";
      const stopOrders = orders.filter((o) => {
        const type = (o.type ?? "").toUpperCase();
        return o.reduceOnly && Boolean(o.stopPrice) && type.includes("STOP") && o.side === closeSide;
      });

      if (stopOrders.length) {
        const candidates = stopOrders
          .map((o) => {
            const d = pctDistance(p.markPrice, o.stopPrice ?? NaN);
            return { o, d };
          })
          .filter((x): x is { o: (typeof stopOrders)[number]; d: number } => x.d !== null);

        const nearest = candidates.sort((a, b) => a.d - b.d)[0];

        if (nearest && nearest.d <= config.stopDistancePct) {
          await createAlert({
            type: "STOP_PROXIMITY",
            symbol: p.symbol,
            message: `Mark ${p.markPrice.toFixed(2)} is ${nearest.d.toFixed(2)}% from stop (${(nearest.o.stopPrice ?? 0).toFixed(2)}).`,
            dedupeKey: `STOP_PROXIMITY:${p.symbol}:${nearest.o.orderId}`,
            metadata: {
              orderId: nearest.o.orderId,
              stopPrice: nearest.o.stopPrice,
              markPrice: p.markPrice,
              distancePct: nearest.d
            }
          });
        }
      }

      const tpOrders = orders.filter((o) => {
        if (!o.reduceOnly) return false;
        if (o.side !== closeSide) return false;
        if (!Number.isFinite(o.price) || o.price <= 0) return false;
        const type = (o.type ?? "").toUpperCase();
        return type.includes("TAKE_PROFIT") || type === "LIMIT";
      });

      if (tpOrders.length) {
        const candidates = tpOrders
          .map((o) => {
            const d = pctDistance(p.markPrice, o.price);
            return { o, d };
          })
          .filter((x): x is { o: (typeof tpOrders)[number]; d: number } => x.d !== null);

        const nearest = candidates.sort((a, b) => a.d - b.d)[0];

        if (nearest && nearest.d <= config.takeProfitDistancePct) {
          await createAlert({
            type: "TAKE_PROFIT_PROXIMITY",
            symbol: p.symbol,
            message: `Mark ${p.markPrice.toFixed(2)} is ${nearest.d.toFixed(2)}% from take-profit (${nearest.o.price.toFixed(2)}).`,
            dedupeKey: `TAKE_PROFIT_PROXIMITY:${p.symbol}:${nearest.o.orderId}`,
            metadata: {
              orderId: nearest.o.orderId,
              price: nearest.o.price,
              markPrice: p.markPrice,
              distancePct: nearest.d
            }
          });
        }
      }
    }
  }

  async function tick() {
    if (!config.enabled) return;
    if (running) return;
    running = true;
    try {
      await Promise.all([checkScanner(), checkPositions()]);
    } catch (err) {
      params.logger.warn({ err }, "Alerts monitor tick failed");
    } finally {
      running = false;
    }
  }

  function start() {
    if (!config.enabled) return;
    if (timer) return;
    timer = setInterval(() => void tick(), config.intervalMs);
    void tick();
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  return { start, stop };
}
