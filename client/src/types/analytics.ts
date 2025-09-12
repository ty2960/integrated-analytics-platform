import type { 
  FactOrder, 
  DimCustomer, 
  DimProduct, 
  AnalyticsHypothesis,
  PredictionLog,
  DecisionLog,
  DecisionOutcome,
  FilterState 
} from "@shared/schema";

export interface KPIData {
  revenue: number;
  retention_d30: number;
  aov: number;
  new_customers: number;
  revenue_change: number;
  retention_change: number;
  aov_change: number;
  new_customers_change: number;
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  new_customers: number;
}

export interface SegmentData {
  segment: string;
  revenue: number;
  revenue_change: number;
  aov: number;
  conversion_rate: number;
}

export interface PredictionResult {
  prediction_id: string;
  target_metric: string;
  predicted_value: number;
  confidence_lower: number;
  confidence_upper: number;
  key_drivers: Array<{
    feature: string;
    importance: number;
    impact: number;
  }>;
  model_info: {
    model_type: string;
    accuracy: number;
    last_updated: string;
    next_update: string;
  };
}

export interface DecisionLogWithOutcome extends DecisionLog {
  outcome?: DecisionOutcome;
}

export interface TabState {
  active_tab: 'bi' | 'ba' | 'pa' | 'learn' | 'realtime';
  filter_state: FilterState;
  selected_hypothesis_id?: string;
  prediction_context?: {
    hypothesis_id: string;
    target_metric: string;
  };
}

// Re-export shared types
export type {
  FactOrder,
  DimCustomer, 
  DimProduct,
  AnalyticsHypothesis,
  PredictionLog,
  DecisionLog,
  DecisionOutcome,
  FilterState
};
