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

// NEW: Enhanced output enums
const tradeQualityGrades = ["A", "B", "DEGRADED"] as const;
const thesisStatuses = ["INTACT", "WEAKENING", "INVALIDATED"] as const;
const positionStatuses = ["VALID", "INVALIDATED"] as const;
const timeframeBiases = ["bearish", "neutral", "bullish"] as const;
const managementActions = ["HOLD", "PARTIAL_DERISK", "FULL_EXIT"] as const;

// Zod schemas for OpenAI structured outputs
export const advisorActionSchema = z.object({
  type: z.enum(actionTypes),
  title: z.string(),
  reason: z.string(),
  params: z.string().nullable()
});

// NEW: Enhanced output sub-schemas
const tradeQualitySchema = z.object({
  grade: z.enum(tradeQualityGrades),
  original_thesis_status: z.enum(thesisStatuses)
});

const higherTimeframeBiasSchema = z.object({
  daily: z.enum(timeframeBiases),
  h4: z.enum(timeframeBiases)
});

const lowerTimeframeBehaviorSchema = z.object({
  h1: z.string(),
  m15: z.string()
});

const keyLevelsSchema = z.object({
  invalidation: z.array(z.number()),
  continuation: z.array(z.number())
});

const scenarioSchema = z.object({
  scenario: z.string(),
  probability: z.number().min(0).max(1)
});

const equityPotentialSchema = z.object({
  minimum_target_10pct: z.object({
    reachable: z.boolean(),
    required_price_level: z.number().nullable()
  }),
  stretch_target_20_30pct: z.object({
    reachable: z.boolean(),
    required_price_levels: z.array(z.number())
  })
});

const managementGuidanceSchema = z.object({
  recommended_action: z.enum(managementActions),
  rationale: z.string()
});

export const advisorRecommendationSchema = z.object({
  // EXISTING required fields
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  actions: z.array(advisorActionSchema),
  invalidation: z.array(z.string()),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),

  // NEW optional fields
  trade_quality: tradeQualitySchema.optional(),
  position_status: z.enum(positionStatuses).optional(),
  higher_timeframe_bias: higherTimeframeBiasSchema.optional(),
  lower_timeframe_behavior: lowerTimeframeBehaviorSchema.optional(),
  key_levels: keyLevelsSchema.optional(),
  scenarios: z.array(scenarioSchema).optional(),
  equity_potential: equityPotentialSchema.optional(),
  management_guidance: managementGuidanceSchema.optional(),
  verdict: z.string().optional()
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

const TRADE_QUALITY_GRADES = ["A", "B", "DEGRADED"];
const THESIS_STATUSES = ["INTACT", "WEAKENING", "INVALIDATED"];
const POSITION_STATUSES = ["VALID", "INVALIDATED"];
const TIMEFRAME_BIASES = ["bearish", "neutral", "bullish"];
const MANAGEMENT_ACTIONS = ["HOLD", "PARTIAL_DERISK", "FULL_EXIT"];

export const advisorRecommendationJsonSchema = {
  name: "advisor_recommendation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      // EXISTING required fields
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
      assumptions: { type: "array", items: { type: "string" } },

      // NEW optional fields
      trade_quality: {
        type: "object",
        additionalProperties: false,
        properties: {
          grade: { type: "string", enum: TRADE_QUALITY_GRADES },
          original_thesis_status: { type: "string", enum: THESIS_STATUSES }
        },
        required: ["grade", "original_thesis_status"]
      },
      position_status: { type: "string", enum: POSITION_STATUSES },
      higher_timeframe_bias: {
        type: "object",
        additionalProperties: false,
        properties: {
          daily: { type: "string", enum: TIMEFRAME_BIASES },
          h4: { type: "string", enum: TIMEFRAME_BIASES }
        },
        required: ["daily", "h4"]
      },
      lower_timeframe_behavior: {
        type: "object",
        additionalProperties: false,
        properties: {
          h1: { type: "string" },
          m15: { type: "string" }
        },
        required: ["h1", "m15"]
      },
      key_levels: {
        type: "object",
        additionalProperties: false,
        properties: {
          invalidation: { type: "array", items: { type: "number" } },
          continuation: { type: "array", items: { type: "number" } }
        },
        required: ["invalidation", "continuation"]
      },
      scenarios: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            scenario: { type: "string" },
            probability: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["scenario", "probability"]
        }
      },
      equity_potential: {
        type: "object",
        additionalProperties: false,
        properties: {
          minimum_target_10pct: {
            type: "object",
            additionalProperties: false,
            properties: {
              reachable: { type: "boolean" },
              required_price_level: { type: ["number", "null"] }
            },
            required: ["reachable", "required_price_level"]
          },
          stretch_target_20_30pct: {
            type: "object",
            additionalProperties: false,
            properties: {
              reachable: { type: "boolean" },
              required_price_levels: { type: "array", items: { type: "number" } }
            },
            required: ["reachable", "required_price_levels"]
          }
        },
        required: ["minimum_target_10pct", "stretch_target_20_30pct"]
      },
      management_guidance: {
        type: "object",
        additionalProperties: false,
        properties: {
          recommended_action: { type: "string", enum: MANAGEMENT_ACTIONS },
          rationale: { type: "string" }
        },
        required: ["recommended_action", "rationale"]
      },
      verdict: { type: "string" }
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
