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

// v3: BTC context enums
const btcRegimes = ["risk_on", "risk_off", "chop"] as const;
const btcBiases = ["bullish", "neutral", "bearish"] as const;
const btcVolatilities = ["high", "normal", "low"] as const;
const btcDriverFlags = ["btc_driving", "alt_idiosyncratic"] as const;
const altBtcRelativeStrengths = ["outperforming", "neutral", "underperforming"] as const;

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

// v2: Confidence driver schema
const confidenceDriverSchema = z.object({
  factor: z.string(),
  impact: z.enum(["positive", "negative", "neutral"]),
  weight: z.number().int().min(0).max(100)
});

// v3: BTC context schema (arrays instead of tuples for OpenAI compatibility)
const btcKeyLevelsSchema = z.object({
  support: z.array(z.number()),
  resistance: z.array(z.number())
});

const btcContextSchema = z.object({
  regime: z.enum(btcRegimes),
  bias: z.enum(btcBiases),
  volatility: z.enum(btcVolatilities),
  key_levels: btcKeyLevelsSchema,
  driver_flag: z.enum(btcDriverFlags),
  impact_on_alt: z.string()
});

// v3: ALTBTC context schema
const altBtcContextSchema = z.object({
  symbol: z.string(),
  relative_strength: z.enum(altBtcRelativeStrengths),
  structure: z.string(),
  implication: z.string()
});

export const advisorRecommendationSchema = z.object({
  // EXISTING required fields
  summary: z.string(),
  confidence: z.number().int().min(0).max(100), // v2: 0-100 integer scale
  actions: z.array(advisorActionSchema),
  invalidation: z.array(z.string()),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),

  // Enhanced output fields (nullable for OpenAI structured outputs compatibility)
  trade_quality: tradeQualitySchema.nullable(),
  position_status: z.enum(positionStatuses).nullable(),
  higher_timeframe_bias: higherTimeframeBiasSchema.nullable(),
  lower_timeframe_behavior: lowerTimeframeBehaviorSchema.nullable(),
  key_levels: keyLevelsSchema.nullable(),
  scenarios: z.array(scenarioSchema).nullable(),
  equity_potential: equityPotentialSchema.nullable(),
  management_guidance: managementGuidanceSchema.nullable(),
  verdict: z.string().nullable(),

  // v2: Confidence explanation fields
  what_would_change_mind: z.array(z.string()).nullable(),
  drivers: z.array(confidenceDriverSchema).nullable(),

  // v3: BTC market context (for ALT analysis only)
  btc_context: btcContextSchema.nullable(),
  altbtc_context: altBtcContextSchema.nullable()
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

// v3: BTC context JSON schema constants
const BTC_REGIMES = ["risk_on", "risk_off", "chop"];
const BTC_BIASES = ["bullish", "neutral", "bearish"];
const BTC_VOLATILITIES = ["high", "normal", "low"];
const BTC_DRIVER_FLAGS = ["btc_driving", "alt_idiosyncratic"];
const ALTBTC_RELATIVE_STRENGTHS = ["outperforming", "neutral", "underperforming"];

export const advisorRecommendationJsonSchema = {
  name: "advisor_recommendation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      // EXISTING required fields
      summary: { type: "string" },
      confidence: { type: "integer", minimum: 0, maximum: 100 }, // v2: 0-100 integer
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
      verdict: { type: "string" },

      // v2: Confidence explanation fields
      what_would_change_mind: {
        type: "array",
        items: { type: "string" }
      },
      drivers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            factor: { type: "string" },
            impact: { type: "string", enum: ["positive", "negative", "neutral"] },
            weight: { type: "integer", minimum: 0, maximum: 100 }
          },
          required: ["factor", "impact", "weight"]
        }
      },

      // v3: BTC market context
      btc_context: {
        type: "object",
        additionalProperties: false,
        properties: {
          regime: { type: "string", enum: BTC_REGIMES },
          bias: { type: "string", enum: BTC_BIASES },
          volatility: { type: "string", enum: BTC_VOLATILITIES },
          key_levels: {
            type: "object",
            additionalProperties: false,
            properties: {
              support: {
                type: "array",
                items: { type: "number" }
              },
              resistance: {
                type: "array",
                items: { type: "number" }
              }
            },
            required: ["support", "resistance"]
          },
          driver_flag: { type: "string", enum: BTC_DRIVER_FLAGS },
          impact_on_alt: { type: "string" }
        },
        required: ["regime", "bias", "volatility", "key_levels", "driver_flag", "impact_on_alt"]
      },
      altbtc_context: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: { type: "string" },
          relative_strength: { type: "string", enum: ALTBTC_RELATIVE_STRENGTHS },
          structure: { type: "string" },
          implication: { type: "string" }
        },
        required: ["symbol", "relative_strength", "structure", "implication"]
      }
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
