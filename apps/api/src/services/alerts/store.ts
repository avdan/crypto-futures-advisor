import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { Alert } from "@binance-advisor/shared";

import { resolveApiDataDir } from "../storage/paths.js";

type StoredAlert = Alert;

type AlertStoreConfig = {
  maxAlerts: number;
};

function parseIntSafe(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function getAlertStoreConfig(): AlertStoreConfig {
  const maxAlerts = Math.max(100, Math.min(parseIntSafe(process.env.ALERTS_MAX, 1000), 20_000));
  return { maxAlerts };
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

function nowIso() {
  return new Date().toISOString();
}

export type CreateAlertInput = Omit<Alert, "id" | "createdAt" | "acknowledgedAt"> & {
  id?: string;
  createdAt?: string;
  acknowledgedAt?: string | null;
};

export type AlertStore = {
  list(params?: { limit?: number; includeAcknowledged?: boolean }): Promise<Alert[]>;
  add(input: CreateAlertInput): Promise<Alert>;
  acknowledge(id: string): Promise<Alert | null>;
  findRecentByDedupeKey(params: { dedupeKey: string; sinceMs: number }): Promise<Alert | null>;
};

export function createAlertStore(): AlertStore {
  const config = getAlertStoreConfig();
  const dataDir = resolveApiDataDir();
  const filePath = path.join(dataDir, "alerts.json");

  let loaded = false;
  let alerts: StoredAlert[] = [];
  let writeQueue: Promise<void> = Promise.resolve();

  async function ensureLoaded() {
    if (loaded) return;
    const existing = await readJsonFile<StoredAlert[]>(filePath);
    alerts = Array.isArray(existing) ? existing : [];
    loaded = true;
  }

  async function persist(): Promise<void> {
    const snapshot = alerts.slice(0, config.maxAlerts);
    writeQueue = writeQueue.then(() => writeJsonFile(filePath, snapshot));
    await writeQueue;
  }

  async function list(params?: { limit?: number; includeAcknowledged?: boolean }): Promise<Alert[]> {
    await ensureLoaded();
    const includeAcknowledged = Boolean(params?.includeAcknowledged);
    const limit = Math.max(1, Math.min(params?.limit ?? 200, config.maxAlerts));

    const filtered = includeAcknowledged ? alerts : alerts.filter((a) => !a.acknowledgedAt);
    return filtered.slice(0, limit);
  }

  async function add(input: CreateAlertInput): Promise<Alert> {
    await ensureLoaded();

    const alert: Alert = {
      id: input.id ?? crypto.randomUUID(),
      createdAt: input.createdAt ?? nowIso(),
      acknowledgedAt: input.acknowledgedAt ?? null,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      symbol: input.symbol ?? null,
      dedupeKey: input.dedupeKey,
      metadata: input.metadata ?? null
    };

    alerts.unshift(alert);
    if (alerts.length > config.maxAlerts) alerts = alerts.slice(0, config.maxAlerts);
    await persist();
    return alert;
  }

  async function acknowledge(id: string): Promise<Alert | null> {
    await ensureLoaded();
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const existing = alerts[idx]!;
    if (existing.acknowledgedAt) return existing;
    const next: Alert = { ...existing, acknowledgedAt: nowIso() };
    alerts[idx] = next;
    await persist();
    return next;
  }

  async function findRecentByDedupeKey(params: { dedupeKey: string; sinceMs: number }): Promise<Alert | null> {
    await ensureLoaded();
    const since = Date.now() - Math.max(0, params.sinceMs);
    for (const a of alerts) {
      if (a.dedupeKey !== params.dedupeKey) continue;
      const createdMs = Date.parse(a.createdAt);
      if (Number.isFinite(createdMs) && createdMs >= since) return a;
    }
    return null;
  }

  return { list, add, acknowledge, findRecentByDedupeKey };
}
