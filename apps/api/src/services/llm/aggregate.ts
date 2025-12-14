import type { AdvisorRecommendation, LlmProviderResult } from "@binance-advisor/shared";

import { getAnthropicConfig, getOpenAiConfig } from "../../config.js";
import { generateAdvisorRecommendation, generateSetupsSummary } from "../openai/client.js";
import {
  generateClaudeAdvisorRecommendation,
  generateClaudeSetupsSummary
} from "./providers/anthropic.js";

// ANSI colors for terminal logging
const c = {
  openai: "\x1b[33m",     // Yellow
  anthropic: "\x1b[35m",  // Magenta
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m"
};

function logLlmStart(provider: "openai" | "anthropic", context: string, model: string | null, input: unknown) {
  const color = provider === "openai" ? c.openai : c.anthropic;
  const label = provider === "openai" ? "OpenAI" : "Claude";
  const inputStr = JSON.stringify(input, null, 2);
  console.log(`${color}[${label}]${c.reset} Starting ${context}...`);
  console.log(`${c.dim}  Model: ${model ?? "unknown"}${c.reset}`);
  console.log(`${c.dim}  Input (${inputStr.length} chars):${c.reset}`);
  console.log(`${c.dim}${inputStr}${c.reset}`);
}

function logLlmEnd(provider: "openai" | "anthropic", context: string, latencyMs: number) {
  const color = provider === "openai" ? c.openai : c.anthropic;
  const label = provider === "openai" ? "OpenAI" : "Claude";
  console.log(`${color}[${label}]${c.reset} ${c.green}Completed${c.reset} ${context} in ${latencyMs}ms`);
}

function logLlmError(provider: "openai" | "anthropic", context: string, error: string, latencyMs: number) {
  const color = provider === "openai" ? c.openai : c.anthropic;
  const label = provider === "openai" ? "OpenAI" : "Claude";
  console.log(`${color}[${label}]${c.reset} ${c.red}ERROR${c.reset} ${context} after ${latencyMs}ms: ${error}`);
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export async function runAdvisorProviders(input: unknown): Promise<
  Array<LlmProviderResult<AdvisorRecommendation>>
> {
  const openAi = getOpenAiConfig();
  const anthropic = getAnthropicConfig();

  const tasks = [
    {
      provider: "openai" as const,
      enabled: Boolean(openAi),
      model: openAi?.model ?? null,
      run: async () =>
        openAi
          ? await generateAdvisorRecommendation({
              apiKey: openAi.apiKey,
              model: openAi.model,
              maxCompletionTokens: openAi.maxCompletionTokens,
              input
            })
          : null
    },
    {
      provider: "anthropic" as const,
      enabled: Boolean(anthropic),
      model: anthropic?.model ?? null,
      run: async () =>
        anthropic
          ? await generateClaudeAdvisorRecommendation({
              apiKey: anthropic.apiKey,
              model: anthropic.model,
              maxTokens: anthropic.maxTokens,
              input
            })
          : null
    }
  ] as const;

  const results = await Promise.all(
    tasks.map(async (t) => {
      if (!t.enabled) {
        const disabled: LlmProviderResult<AdvisorRecommendation> = {
          provider: t.provider,
          enabled: false,
          model: t.model,
          latencyMs: null,
          output: null,
          error: null
        };
        return disabled;
      }

      logLlmStart(t.provider, "advisor", t.model, input);
      const startedAt = Date.now();

      try {
        const output = (await t.run()) as AdvisorRecommendation | null;
        const latencyMs = Date.now() - startedAt;
        logLlmEnd(t.provider, "advisor", latencyMs);

        const ok: LlmProviderResult<AdvisorRecommendation> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs,
          output,
          error: null
        };
        return ok;
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        const errorMsg = toErrorMessage(err);
        logLlmError(t.provider, "advisor", errorMsg, latencyMs);

        const failed: LlmProviderResult<AdvisorRecommendation> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs,
          output: null,
          error: errorMsg
        };
        return failed;
      }
    })
  );

  return results;
}

export async function runSetupsSummaryProviders(input: unknown): Promise<Array<LlmProviderResult<string>>> {
  const openAi = getOpenAiConfig();
  const anthropic = getAnthropicConfig();

  const tasks = [
    {
      provider: "openai" as const,
      enabled: Boolean(openAi),
      model: openAi?.model ?? null,
      run: async () =>
        openAi
          ? await generateSetupsSummary({
              apiKey: openAi.apiKey,
              model: openAi.model,
              maxCompletionTokens: openAi.maxCompletionTokens,
              input
            })
          : null
    },
    {
      provider: "anthropic" as const,
      enabled: Boolean(anthropic),
      model: anthropic?.model ?? null,
      run: async () =>
        anthropic
          ? await generateClaudeSetupsSummary({
              apiKey: anthropic.apiKey,
              model: anthropic.model,
              maxTokens: anthropic.maxTokens,
              input
            })
          : null
    }
  ] as const;

  const results = await Promise.all(
    tasks.map(async (t) => {
      if (!t.enabled) {
        const disabled: LlmProviderResult<string> = {
          provider: t.provider,
          enabled: false,
          model: t.model,
          latencyMs: null,
          output: null,
          error: null
        };
        return disabled;
      }

      logLlmStart(t.provider, "setups-summary", t.model, input);
      const startedAt = Date.now();

      try {
        const output = (await t.run()) as string | null;
        const latencyMs = Date.now() - startedAt;
        logLlmEnd(t.provider, "setups-summary", latencyMs);

        const ok: LlmProviderResult<string> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs,
          output,
          error: null
        };
        return ok;
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        const errorMsg = toErrorMessage(err);
        logLlmError(t.provider, "setups-summary", errorMsg, latencyMs);

        const failed: LlmProviderResult<string> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs,
          output: null,
          error: errorMsg
        };
        return failed;
      }
    })
  );

  return results;
}

