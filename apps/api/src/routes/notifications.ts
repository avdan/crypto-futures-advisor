import type { FastifyPluginAsync } from "fastify";
import type { ApiErrorResponse, TelegramTestRequest, TelegramTestResponse } from "@binance-advisor/shared";

import { getTelegramConfig } from "../config.js";
import { sendTelegramMessage } from "../services/notifications/telegram.js";

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/notifications/telegram/test", async (req, reply) => {
    const cfg = getTelegramConfig();
    if (!cfg) {
      return reply.code(503).send(
        errorResponse(
          "TELEGRAM_NOT_CONFIGURED",
          "Telegram is not configured. Set TELEGRAM_ENABLED=true, TELEGRAM_BOT_TOKEN, and TELEGRAM_CHAT_ID."
        )
      );
    }

    const body = (req.body ?? {}) as TelegramTestRequest;
    const message = typeof body.message === "string" && body.message.trim()
      ? body.message.trim()
      : `✅ Binance Advisor Telegram test (${new Date().toISOString()})`;

    try {
      await sendTelegramMessage({ botToken: cfg.botToken, chatId: cfg.chatId, text: message });
      const res: TelegramTestResponse = { sentAt: new Date().toISOString(), ok: true, error: null };
      return res;
    } catch (err) {
      const res: TelegramTestResponse = {
        sentAt: new Date().toISOString(),
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error"
      };
      return reply.code(502).send(res);
    }
  });
};

