import { z } from "zod";

// Common data models for BI/BA/PA integration

export const factOrderSchema = z.object({
  order_id: z.string(),
  customer_id: z.string(),
  product_id: z.string(),
  order_ts: z.string(), // ISO date string
  revenue: z.number(),
  channel: z.enum(['EC', 'Store', 'App']),
});

export const factEventSchema = z.object({
  event_id: z.string(),
  org_id: z.string(),
  user_id: z.string(),
  event_ts: z.string(),
  event_name: z.string(),
  props_json: z.record(z.any()),
});

export const dimCustomerSchema = z.object({
  customer_id: z.string(),
  segment: z.enum(['Premium', 'Standard', 'Basic']),
  lifecycle_stage: z.enum(['New', 'Active', 'At Risk', 'Churned']),
  region: z.string(),
  created_at: z.string(),
});

export const dimProductSchema = z.object({
  product_id: z.string(),
  category: z.string(),
  price_band: z.enum(['Low', 'Medium', 'High']),
  price: z.number(),
});

export const analyticsHypothesisSchema = z.object({
  hypothesis_id: z.string(),
  title: z.string(),
  text: z.string(),
  assumptions: z.array(z.string()),
  owner: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  metrics: z.object({
    target: z.string(),
    guardrail: z.array(z.string()),
  }),
  data_scope: z.string(),
});

export const predictionLogSchema = z.object({
  prediction_id: z.string(),
  entity_key: z.string(),
  target: z.string(),
  y_hat: z.number(),
  y_lo: z.number(),
  y_hi: z.number(),
  model_id: z.string(),
  drivers: z.array(z.object({
    feature: z.string(),
    importance: z.number(),
    impact: z.number(),
  })),
  ts: z.string(),
});

export const decisionLogSchema = z.object({
  decision_id: z.string(),
  context: z.string(),
  hypothesis_id: z.string().optional(),
  actor: z.string(),
  decision_ts: z.string(),
  expected_uplift: z.string(),
  guardrails: z.array(z.string()),
  evaluation_start: z.string(),
  evaluation_end: z.string(),
});

export const decisionOutcomeSchema = z.object({
  decision_id: z.string(),
  measured_metric: z.string(),
  actual_value: z.number(),
  expected_value: z.number(),
  eval_window: z.string(),
  variance: z.number(),
  notes: z.string(),
  status: z.enum(['Success', 'Partial', 'Failed', 'Ongoing']),
});

// Type exports
export type FactOrder = z.infer<typeof factOrderSchema>;
export type FactEvent = z.infer<typeof factEventSchema>;
export type DimCustomer = z.infer<typeof dimCustomerSchema>;
export type DimProduct = z.infer<typeof dimProductSchema>;
export type AnalyticsHypothesis = z.infer<typeof analyticsHypothesisSchema>;
export type PredictionLog = z.infer<typeof predictionLogSchema>;
export type DecisionLog = z.infer<typeof decisionLogSchema>;
export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>;

// Filter state for cross-tab context sharing
export const filterStateSchema = z.object({
  period: z.enum(['30days', '60days', '90days']),
  segment: z.enum(['All', 'Premium', 'Standard', 'Basic']),
  channel: z.enum(['All', 'EC', 'Store', 'App']),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type FilterState = z.infer<typeof filterStateSchema>;
