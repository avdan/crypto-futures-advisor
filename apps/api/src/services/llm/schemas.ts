import { z } from "zod";
import type { AdvisorActionType } from "@binance-advisor/shared";

const actionTypes = [
  "HOLD",
  "MOVE_STOP",
  "SCALE_OUT",
  "SCALE_IN",
  "HEDGE",
  "CLOSE"
] as const;

// Zod schemas for OpenAI structured outputs
export const advisorActionSchema = z.object({
  type: z.enum(actionTypes),
  title: z.string(),
  reason: z.string(),
  params: z.string().nullable()
});

export const advisorRecommendationSchema = z.object({
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  actions: z.array(advisorActionSchema),
  invalidation: z.array(z.string()),
  risks: z.array(z.string()),
  assumptions: z.array(z.string())
});

export const setupsSummarySchema = z.object({
  summary: z.string()
});

export type AdvisorRecommendationOutput = z.infer<typeof advisorRecommendationSchema>;
export type SetupsSummaryOutput = z.infer<typeof setupsSummarySchema>;

// JSON schemas for Anthropic tool calling
const ACTION_TYPES: AdvisorActionType[] = [
  "HOLD",
  "MOVE_STOP",
  "SCALE_OUT",
  "SCALE_IN",
  "HEDGE",
  "CLOSE"
];

export const advisorRecommendationJsonSchema = {
  name: "advisor_recommendation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ACTION_TYPES },
            title: { type: "string" },
            reason: { type: "string" },
            params: { type: "object", additionalProperties: true }
          },
          required: ["type", "title", "reason"]
        }
      },
      invalidation: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } }
    },
    required: ["summary", "confidence", "actions", "invalidation", "risks", "assumptions"]
  }
} as const;

export const setupsSummaryJsonSchema = {
  name: "setups_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" }
    },
    required: ["summary"]
  }
} as const;
