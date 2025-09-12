import { storage } from './storage';
import { semantics } from './semantics';
import type { PredictionResult, FilterState } from '@/types/analytics';

export class PredictionEngine {
  // Simple prediction algorithms for PA demo
  
  predictCVR(hypothesisId: string, filter: FilterState): PredictionResult {
    const orders = storage.getFactOrders();
    const customers = storage.getDimCustomers();
    
    // Simple moving average with seasonal adjustment
    const historicalData = this.getHistoricalCVR(filter);
    const trend = this.calculateTrend(historicalData);
    const seasonality = this.calculateSeasonality(historicalData);
    
    // Base prediction from trend
    const basePrediction = historicalData[historicalData.length - 1] * (1 + trend);
    const seasonalAdjustment = basePrediction * seasonality;
    const predicted_value = Math.max(0, basePrediction + seasonalAdjustment);
    
    // Confidence intervals (±1.96σ for 95% CI)
    const variance = this.calculateVariance(historicalData);
    const confidenceMargin = 1.96 * Math.sqrt(variance);
    
    const confidence_lower = Math.max(0, predicted_value - confidenceMargin);
    const confidence_upper = predicted_value + confidenceMargin;
    
    // Generate key drivers using simplified feature importance
    const key_drivers = this.calculateFeatureImportance(orders, customers, filter);
    
    return {
      prediction_id: `PRED-${Date.now()}`,
      target_metric: 'CVR',
      predicted_value: predicted_value * 100, // Convert to percentage
      confidence_lower: confidence_lower * 100,
      confidence_upper: confidence_upper * 100,
      key_drivers,
      model_info: {
        model_type: '時系列回帰 + 季節性補正',
        accuracy: 91.8, // Mock accuracy percentage
        last_updated: new Date().toISOString(),
        next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  predictAOV(hypothesisId: string, filter: FilterState): PredictionResult {
    const orders = storage.getFactOrders();
    const products = storage.getDimProducts();
    
    // Calculate current AOV trend
    const timeSeriesData = semantics.getTimeSeriesData(filter);
    const aovHistory = timeSeriesData.map(d => d.revenue / Math.max(1, d.new_customers));
    
    const trend = this.calculateTrend(aovHistory);
    const currentAOV = aovHistory[aovHistory.length - 1] || 0;
    const predicted_value = currentAOV * (1 + trend);
    
    // Confidence calculation
    const variance = this.calculateVariance(aovHistory);
    const confidenceMargin = 1.96 * Math.sqrt(variance);
    
    return {
      prediction_id: `PRED-${Date.now()}`,
      target_metric: 'AOV',
      predicted_value,
      confidence_lower: Math.max(0, predicted_value - confidenceMargin),
      confidence_upper: predicted_value + confidenceMargin,
      key_drivers: this.calculateAOVDrivers(orders, products, filter),
      model_info: {
        model_type: '回帰分析 + 商品ミックス調整',
        accuracy: 87.4,
        last_updated: new Date().toISOString(),
        next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  private getHistoricalCVR(filter: FilterState): number[] {
    // Simplified CVR calculation for past weeks
    const timeSeriesData = semantics.getTimeSeriesData(filter);
    
    return timeSeriesData.map(d => {
      // Mock CVR calculation: new_customers / (impressions estimate)
      const estimatedImpressions = d.new_customers * 20; // Assume 5% CVR baseline
      return estimatedImpressions > 0 ? d.new_customers / estimatedImpressions : 0;
    });
  }

  private calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    // Simple linear regression slope
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope / 100; // Convert to small trend factor
  }

  private calculateSeasonality(data: number[]): number {
    // Mock weekly seasonality (simplified)
    const dayOfWeek = new Date().getDay();
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.15 : -0.05;
    return weekendMultiplier;
  }

  private calculateVariance(data: number[]): number {
    if (data.length < 2) return 0;
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  }

  private calculateFeatureImportance(orders: any[], customers: any[], filter: FilterState): Array<{
    feature: string;
    importance: number;
    impact: number;
  }> {
    // Simplified feature importance calculation
    return [
      {
        feature: '割引率',
        importance: 0.85,
        impact: 0.008 // +0.8% CVR impact
      },
      {
        feature: '商品カテゴリ',
        importance: 0.65,
        impact: 0.005 // +0.5% CVR impact
      },
      {
        feature: '時間帯',
        importance: 0.45,
        impact: 0.003 // +0.3% CVR impact
      },
      {
        feature: '流入チャネル',
        importance: 0.35,
        impact: 0.002 // +0.2% CVR impact
      },
      {
        feature: 'デバイスタイプ',
        importance: 0.25,
        impact: 0.001 // +0.1% CVR impact
      },
    ];
  }

  private calculateAOVDrivers(orders: any[], products: any[], filter: FilterState): Array<{
    feature: string;
    importance: number;
    impact: number;
  }> {
    return [
      {
        feature: '商品価格帯',
        importance: 0.90,
        impact: 1200 // +1200円 AOV impact
      },
      {
        feature: '顧客セグメント',
        importance: 0.75,
        impact: 800 // +800円 AOV impact
      },
      {
        feature: 'クロスセル施策',
        importance: 0.60,
        impact: 450 // +450円 AOV impact
      },
      {
        feature: '配送オプション',
        importance: 0.40,
        impact: 200 // +200円 AOV impact
      },
      {
        feature: '決済方法',
        importance: 0.30,
        impact: 150 // +150円 AOV impact
      },
    ];
  }
}

export const prediction = new PredictionEngine();
