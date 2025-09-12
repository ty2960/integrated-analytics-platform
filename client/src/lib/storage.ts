import type {
  FactOrder,
  DimCustomer,
  DimProduct,
  AnalyticsHypothesis,
  PredictionLog,
  DecisionLog,
  DecisionOutcome,
  FilterState,
  TabState
} from "@/types/analytics";

class AnalyticsStorage {
  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  // Fact tables
  getFactOrders(): FactOrder[] {
    return this.getItem('fact_orders', []);
  }

  setFactOrders(orders: FactOrder[]): void {
    this.setItem('fact_orders', orders);
  }

  // Dimension tables
  getDimCustomers(): DimCustomer[] {
    return this.getItem('dim_customers', []);
  }

  setDimCustomers(customers: DimCustomer[]): void {
    this.setItem('dim_customers', customers);
  }

  getDimProducts(): DimProduct[] {
    return this.getItem('dim_products', []);
  }

  setDimProducts(products: DimProduct[]): void {
    this.setItem('dim_products', products);
  }

  // Hypothesis management
  getHypotheses(): AnalyticsHypothesis[] {
    return this.getItem('analytics_hypotheses', []);
  }

  setHypotheses(hypotheses: AnalyticsHypothesis[]): void {
    this.setItem('analytics_hypotheses', hypotheses);
  }

  addHypothesis(hypothesis: AnalyticsHypothesis): void {
    const hypotheses = this.getHypotheses();
    hypotheses.push(hypothesis);
    this.setHypotheses(hypotheses);
  }

  updateHypothesis(hypothesis: AnalyticsHypothesis): void {
    const hypotheses = this.getHypotheses();
    const index = hypotheses.findIndex(h => h.hypothesis_id === hypothesis.hypothesis_id);
    if (index >= 0) {
      hypotheses[index] = hypothesis;
      this.setHypotheses(hypotheses);
    }
  }

  deleteHypothesis(hypothesis_id: string): void {
    const hypotheses = this.getHypotheses();
    const filtered = hypotheses.filter(h => h.hypothesis_id !== hypothesis_id);
    this.setHypotheses(filtered);
  }

  // Prediction logs
  getPredictionLogs(): PredictionLog[] {
    return this.getItem('prediction_logs', []);
  }

  addPredictionLog(prediction: PredictionLog): void {
    const logs = this.getPredictionLogs();
    logs.push(prediction);
    this.setItem('prediction_logs', logs);
  }

  // Decision management
  getDecisionLogs(): DecisionLog[] {
    return this.getItem('decision_logs', []);
  }

  addDecisionLog(decision: DecisionLog): void {
    const logs = this.getDecisionLogs();
    logs.push(decision);
    this.setItem('decision_logs', logs);
  }

  getDecisionOutcomes(): DecisionOutcome[] {
    return this.getItem('decision_outcomes', []);
  }

  addDecisionOutcome(outcome: DecisionOutcome): void {
    const outcomes = this.getDecisionOutcomes();
    const index = outcomes.findIndex(o => o.decision_id === outcome.decision_id);
    if (index >= 0) {
      outcomes[index] = outcome;
    } else {
      outcomes.push(outcome);
    }
    this.setItem('decision_outcomes', outcomes);
  }

  // Tab state management
  getTabState(): TabState {
    return this.getItem('tab_state', {
      active_tab: 'bi',
      filter_state: {
        period: '30days',
        segment: 'All',
        channel: 'All'
      }
    });
  }

  setTabState(state: TabState): void {
    this.setItem('tab_state', state);
  }

  // Data initialization check
  isDataInitialized(): boolean {
    return this.getItem('data_initialized', false);
  }

  setDataInitialized(): void {
    this.setItem('data_initialized', true);
  }

  // Clear all data (for reset)
  clearAllData(): void {
    const keys = [
      'fact_orders',
      'dim_customers', 
      'dim_products',
      'analytics_hypotheses',
      'prediction_logs',
      'decision_logs',
      'decision_outcomes',
      'tab_state',
      'data_initialized'
    ];
    keys.forEach(key => localStorage.removeItem(key));
  }
}

export const storage = new AnalyticsStorage();
