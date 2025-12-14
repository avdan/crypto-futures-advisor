import type { AdvisorRecommendation } from "@binance-advisor/shared";

import {
  buildAdvisorSystemPrompt,
  buildSetupsSummarySystemPrompt,
  type LlmInputWithProfile
} from "../prompts.js";
import { advisorRecommendationJsonSchema, setupsSummaryJsonSchema } from "../schemas.js";

// Default timeout: 60s for complex analysis
const DEFAULT_TIMEOUT_MS = 60_000;
// Default max tokens: 4000 for detailed recommendations
const DEFAULT_MAX_TOKENS = 4_000;

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: string; [k: string]: unknown };

type AnthropicResponse = {
  id?: string;
  type?: string;
  role?: string;
  content?: AnthropicContent[];
  model?: string;
  stop_reason?: string;
  stop_sequence?: string | null;
  usage?: { input_tokens: number; output_tokens: number };
  error?: { type: string; message: string };
};

function formatAnthropicError(err: unknown, context: string, timeoutMs: number): Error {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("aborted")) {
      return new Error(
        `Claude Timeout [${context}]: Request aborted after ${timeoutMs}ms. ` +
        `Consider increasing timeoutMs or reducing input size.`
      );
    }
    if (err.message.includes("fetch")) {
      return new Error(`Claude Network Error [${context}]: ${err.message}`);
    }
    return new Error(`Claude Error [${context}]: ${err.message}`);
  }
  return new Error(`Claude Unknown Error [${context}]: ${String(err)}`);
}

function formatResponseDebug(body: AnthropicResponse | null, status?: number): string {
  if (!body) return `status=${status}, body=null`;
  return JSON.stringify({
    id: body.id,
    type: body.type,
    model: body.model,
    stop_reason: body.stop_reason,
    usage: body.usage,
    error: body.error,
    content_types: body.content?.map(c => c.type)
  }, null, 2);
}

function getFirstToolInput(body: AnthropicResponse, toolName: string, context: string): unknown {
  const content = body.content;
  if (!Array.isArray(content)) {
    throw new Error(
      `Claude response missing content [${context}]\n` +
      `Response: ${formatResponseDebug(body)}`
    );
  }

  const toolUse = content.find(
    (c) => c.type === "tool_use" && "name" in c && c.name === toolName
  ) as { type: "tool_use"; name: string; input: unknown } | undefined;

  if (toolUse?.input !== undefined) return toolUse.input;

  const text = content.find((c) => c.type === "text" && typeof (c as any).text === "string") as
    | { type: "text"; text: string }
    | undefined;

  if (!text?.text) {
    throw new Error(
      `Claude response missing tool call "${toolName}" and text fallback [${context}]\n` +
      `Response: ${formatResponseDebug(body)}`
    );
  }

  try {
    return JSON.parse(text.text);
  } catch (err) {
    throw new Error(
      `Claude response was not valid JSON [${context}]: ${err instanceof Error ? err.message : "parse error"}\n` +
      `Text content: ${text.text.slice(0, 500)}${text.text.length > 500 ? "..." : ""}`
    );
  }
}

function assertAdvisorRecommendation(value: unknown): AdvisorRecommendation {
  if (!value || typeof value !== "object") throw new Error("Advisor recommendation is not an object");
  return value as AdvisorRecommendation;
}

export async function generateClaudeAdvisorRecommendation(params: {
  apiKey: string;
  model: string;
  maxTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<AdvisorRecommendation> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const system = buildAdvisorSystemPrompt(params.input as LlmInputWithProfile);

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
          system,
          messages: [
            {
              role: "user",
              content: JSON.stringify(params.input)
            }
          ],
          tools: [
            {
              name: advisorRecommendationJsonSchema.name,
              description: "Structured trade management recommendation",
              input_schema: advisorRecommendationJsonSchema.schema
            }
          ],
          tool_choice: {
            type: "tool",
            name: advisorRecommendationJsonSchema.name
          }
        })
      });
    } catch (err) {
      throw formatAnthropicError(err, "generateClaudeAdvisorRecommendation", timeoutMs);
    }

    const body = (await res.json().catch(() => null)) as AnthropicResponse | null;

    if (!res.ok) {
      throw new Error(
        `Claude API Error [generateClaudeAdvisorRecommendation] status=${res.status}\n` +
        `Response: ${formatResponseDebug(body, res.status)}`
      );
    }

    if (!body) {
      throw new Error(
        `Claude returned empty response [generateClaudeAdvisorRecommendation] status=${res.status}`
      );
    }

    const json = getFirstToolInput(body, advisorRecommendationJsonSchema.name, "generateClaudeAdvisorRecommendation");
    return assertAdvisorRecommendation(json);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateClaudeSetupsSummary(params: {
  apiKey: string;
  model: string;
  maxTokens?: number | null;
  input: unknown;
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const system = buildSetupsSummarySystemPrompt(params.input as LlmInputWithProfile);

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": params.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
          system,
          messages: [
            {
              role: "user",
              content: JSON.stringify(params.input)
            }
          ],
          tools: [
            {
              name: setupsSummaryJsonSchema.name,
              description: "Short summary of top setups",
              input_schema: setupsSummaryJsonSchema.schema
            }
          ],
          tool_choice: {
            type: "tool",
            name: setupsSummaryJsonSchema.name
          }
        })
      });
    } catch (err) {
      throw formatAnthropicError(err, "generateClaudeSetupsSummary", timeoutMs);
    }

    const body = (await res.json().catch(() => null)) as AnthropicResponse | null;

    if (!res.ok) {
      throw new Error(
        `Claude API Error [generateClaudeSetupsSummary] status=${res.status}\n` +
        `Response: ${formatResponseDebug(body, res.status)}`
      );
    }

    if (!body) {
      throw new Error(
        `Claude returned empty response [generateClaudeSetupsSummary] status=${res.status}`
      );
    }

    const json = getFirstToolInput(body, setupsSummaryJsonSchema.name, "generateClaudeSetupsSummary") as { summary?: unknown };
    if (!json || typeof json !== "object" || typeof json.summary !== "string") {
      throw new Error(
        `Claude summary response was invalid [generateClaudeSetupsSummary]\n` +
        `Parsed JSON: ${JSON.stringify(json)}`
      );
    }

    return json.summary;
  } finally {
    clearTimeout(timeoutId);
  }
}
