import type { AdvisorRecommendation, AdvisorAction } from "@binance-advisor/shared";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  buildAdvisorSystemPrompt,
  buildSetupsSummarySystemPrompt,
  type LlmInputWithProfile
} from "../llm/prompts.js";
import {
  advisorRecommendationSchema,
  setupsSummarySchema,
  type AdvisorRecommendationOutput
} from "./schemas.js";

function parseActionParams(output: AdvisorRecommendationOutput): AdvisorRecommendation {
  return {
    ...output,
    actions: output.actions.map((action): AdvisorAction => {
      let params: Record<string, unknown> | undefined;
      if (action.params) {
        try {
          params = JSON.parse(action.params);
        } catch {
          params = undefined;
        }
      }
      return {
        type: action.type,
        title: action.title,
        reason: action.reason,
        params
      };
    })
  };
}

function formatOpenAIError(err: unknown, context: string): Error {
  if (err instanceof OpenAI.APIError) {
    const details = {
      context,
      status: err.status,
      code: err.code,
      type: err.type,
      message: err.message,
      headers: err.headers ? Object.fromEntries(Object.entries(err.headers)) : undefined
    };
    return new Error(`OpenAI API Error: ${JSON.stringify(details, null, 2)}`);
  }

  if (err instanceof OpenAI.APIConnectionError) {
    return new Error(`OpenAI Connection Error [${context}]: ${err.message} (cause: ${err.cause})`);
  }

  if (err instanceof OpenAI.RateLimitError) {
    return new Error(`OpenAI Rate Limit [${context}]: ${err.message}`);
  }

  if (err instanceof OpenAI.AuthenticationError) {
    return new Error(`OpenAI Auth Error [${context}]: ${err.message}`);
  }

  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("aborted")) {
      return new Error(`OpenAI Timeout [${context}]: Request was aborted (timeout exceeded)`);
    }
    return new Error(`OpenAI Error [${context}]: ${err.message}`);
  }

  return new Error(`OpenAI Unknown Error [${context}]: ${String(err)}`);
}

function formatResponseDebug(response: unknown): string {
  try {
    const r = response as Record<string, unknown>;
    return JSON.stringify({
      id: r.id,
      status: r.status,
      output: r.output,
      output_parsed: r.output_parsed,
      error: r.error,
      usage: r.usage
    }, null, 2);
  } catch {
    return String(response);
  }
}

function checkIncompleteResponse(response: unknown, context: string): void {
  const r = response as Record<string, unknown>;
  if (r.status === "incomplete") {
    const usage = r.usage as { output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } } | undefined;
    const outputTokens = usage?.output_tokens ?? 0;
    const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? 0;

    let hint = "";
    if (reasoningTokens > 0 && reasoningTokens >= outputTokens * 0.9) {
      hint = ` The model used ${reasoningTokens}/${outputTokens} tokens for reasoning with none left for output. ` +
        `Increase OPENAI_MAX_COMPLETION_TOKENS to 8000+ for reasoning models (gpt-5, o1, o3).`;
    }

    throw new Error(
      `OpenAI response incomplete [${context}]: Model did not finish generating.${hint}\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }
}

// Default timeout: 60s for reasoning models which can take longer
const DEFAULT_TIMEOUT_MS = 60_000;
// Default max tokens: 16000 for reasoning models (they need room for both reasoning + output)
// Reasoning can use 2k-8k+ tokens internally, plus ~500-1k for actual JSON output
const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;

export async function generateAdvisorRecommendation(params: {
  apiKey: string;
  model: string;
  maxCompletionTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<AdvisorRecommendation> {
  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  const instructions = buildAdvisorSystemPrompt(params.input as LlmInputWithProfile);

  let response: unknown;

  try {
    response = await client.responses.parse({
      model: params.model,
      max_output_tokens: params.maxCompletionTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "medium" },
      instructions,
      input: JSON.stringify(params.input),
      text: {
        format: zodTextFormat(advisorRecommendationSchema, "advisor_recommendation")
      }
    });
  } catch (err) {
    throw formatOpenAIError(err, "generateAdvisorRecommendation");
  }

  // Check for incomplete response (common with reasoning models when token limit is too low)
  checkIncompleteResponse(response, "generateAdvisorRecommendation");

  const parsed = (response as { output_parsed?: AdvisorRecommendationOutput }).output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI response missing parsed output [generateAdvisorRecommendation]\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }

  return parseActionParams(parsed);
}

export async function generateSetupsSummary(params: {
  apiKey: string;
  model: string;
  maxCompletionTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<string> {
  const client = new OpenAI({
    apiKey: params.apiKey,
    timeout: params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  const instructions = buildSetupsSummarySystemPrompt(params.input as LlmInputWithProfile);

  let response: unknown;

  try {
    response = await client.responses.parse({
      model: params.model,
      max_output_tokens: params.maxCompletionTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "low" },
      instructions,
      input: JSON.stringify(params.input),
      text: {
        format: zodTextFormat(setupsSummarySchema, "setups_summary")
      }
    });
  } catch (err) {
    throw formatOpenAIError(err, "generateSetupsSummary");
  }

  // Check for incomplete response (common with reasoning models when token limit is too low)
  checkIncompleteResponse(response, "generateSetupsSummary");

  const parsed = (response as { output_parsed?: { summary: string } }).output_parsed;
  if (!parsed) {
    throw new Error(
      `OpenAI response missing parsed output [generateSetupsSummary]\n` +
      `Response: ${formatResponseDebug(response)}`
    );
  }

  return parsed.summary;
}
