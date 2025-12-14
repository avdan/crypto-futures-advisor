import type { AdvisorRecommendation, LlmProviderResult } from "@binance-advisor/shared";

import { getAnthropicConfig, getOpenAiConfig } from "../../config.js";
import { generateAdvisorRecommendation, generateSetupsSummary } from "../openai/client.js";
import {
  generateClaudeAdvisorRecommendation,
  generateClaudeSetupsSummary
} from "./providers/anthropic.js";

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

      const startedAt = Date.now();
      try {
        const output = (await t.run()) as AdvisorRecommendation | null;
        const ok: LlmProviderResult<AdvisorRecommendation> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs: Date.now() - startedAt,
          output,
          error: null
        };
        return ok;
      } catch (err) {
        const failed: LlmProviderResult<AdvisorRecommendation> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs: Date.now() - startedAt,
          output: null,
          error: toErrorMessage(err)
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

      const startedAt = Date.now();
      try {
        const output = (await t.run()) as string | null;
        const ok: LlmProviderResult<string> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs: Date.now() - startedAt,
          output,
          error: null
        };
        return ok;
      } catch (err) {
        const failed: LlmProviderResult<string> = {
          provider: t.provider,
          enabled: true,
          model: t.model,
          latencyMs: Date.now() - startedAt,
          output: null,
          error: toErrorMessage(err)
        };
        return failed;
      }
    })
  );

  return results;
}

