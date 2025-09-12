import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, UserPlus, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { semantics } from "@/lib/semantics";
import type { FilterState, KPIData } from "@/types/analytics";
import RevenueTrendChart from "@/components/charts/revenue-trend";

interface BIDashboardProps {
  filterState: FilterState;
  onFilterChange: (filter: FilterState) => void;
  onDeepDive: () => void;
}

export default function BIDashboard({ filterState, onFilterChange, onDeepDive }: BIDashboardProps) {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);

  useEffect(() => {
    const data = semantics.calculateKPIs(filterState);
    setKpiData(data);
  }, [filterState]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (change: number) => {
    return change >= 0 ? (
      <TrendingUp className="h-4 w-4 text-chart-2" />
    ) : (
      <TrendingDown className="h-4 w-4 text-destructive" />
    );
  };

  const getTrendColor = (change: number) => {
    return change >= 0 ? "text-chart-2" : "text-destructive";
  };

  if (!kpiData) {
    return <div>データを読み込み中...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Filters Section */}
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center">
            <Filter className="w-5 h-5 mr-2 text-primary" />
            フィルタ設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">期間</label>
              <Select
                value={filterState.period}
                onValueChange={(value) => 
                  onFilterChange({ ...filterState, period: value as FilterState['period'] })
                }
              >
                <SelectTrigger data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30days">過去30日</SelectItem>
                  <SelectItem value="60days">過去60日</SelectItem>
                  <SelectItem value="90days">過去90日</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">セグメント</label>
              <Select
                value={filterState.segment}
                onValueChange={(value) => 
                  onFilterChange({ ...filterState, segment: value as FilterState['segment'] })
                }
              >
                <SelectTrigger data-testid="select-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">全セグメント</SelectItem>
                  <SelectItem value="Premium">プレミアム</SelectItem>
                  <SelectItem value="Standard">スタンダード</SelectItem>
                  <SelectItem value="Basic">ベーシック</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">チャネル</label>
              <Select
                value={filterState.channel}
                onValueChange={(value) => 
                  onFilterChange({ ...filterState, channel: value as FilterState['channel'] })
                }
              >
                <SelectTrigger data-testid="select-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">全チャネル</SelectItem>
                  <SelectItem value="EC">EC</SelectItem>
                  <SelectItem value="Store">店舗</SelectItem>
                  <SelectItem value="App">アプリ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                data-testid="button-deep-dive"
                onClick={onDeepDive}
                className="w-full"
              >
                BAで深掘り
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="kpi-card bg-card border border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">売上 (Revenue)</h3>
              <div className="w-10 h-10 bg-chart-1/10 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-chart-1" />
              </div>
            </div>
            <div className="flex items-baseline">
              <span 
                className="text-3xl font-bold text-card-foreground"
                data-testid="kpi-revenue"
              >
                {formatCurrency(kpiData.revenue)}
              </span>
              <span className={`ml-2 text-sm flex items-center ${getTrendColor(kpiData.revenue_change)}`}>
                {getTrendIcon(kpiData.revenue_change)}
                {formatPercentage(kpiData.revenue_change)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">前月比</p>
          </CardContent>
        </Card>

        <Card className="kpi-card bg-card border border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">リテンション (D30)</h3>
              <div className="w-10 h-10 bg-chart-2/10 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-chart-2" />
              </div>
            </div>
            <div className="flex items-baseline">
              <span 
                className="text-3xl font-bold text-card-foreground"
                data-testid="kpi-retention"
              >
                {kpiData.retention_d30.toFixed(1)}%
              </span>
              <span className={`ml-2 text-sm flex items-center ${getTrendColor(kpiData.retention_change)}`}>
                {getTrendIcon(kpiData.retention_change)}
                {formatPercentage(kpiData.retention_change)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">前月比</p>
          </CardContent>
        </Card>

        <Card className="kpi-card bg-card border border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">AOV</h3>
              <div className="w-10 h-10 bg-chart-3/10 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-chart-3" />
              </div>
            </div>
            <div className="flex items-baseline">
              <span 
                className="text-3xl font-bold text-card-foreground"
                data-testid="kpi-aov"
              >
                {formatCurrency(kpiData.aov)}
              </span>
              <span className={`ml-2 text-sm flex items-center ${getTrendColor(kpiData.aov_change)}`}>
                {getTrendIcon(kpiData.aov_change)}
                {formatPercentage(kpiData.aov_change)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">前月比</p>
          </CardContent>
        </Card>

        <Card className="kpi-card bg-card border border-border hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">新規顧客数</h3>
              <div className="w-10 h-10 bg-chart-4/10 rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-chart-4" />
              </div>
            </div>
            <div className="flex items-baseline">
              <span 
                className="text-3xl font-bold text-card-foreground"
                data-testid="kpi-new-customers"
              >
                {kpiData.new_customers.toLocaleString()}
              </span>
              <span className={`ml-2 text-sm flex items-center ${getTrendColor(kpiData.new_customers_change)}`}>
                {getTrendIcon(kpiData.new_customers_change)}
                {formatPercentage(kpiData.new_customers_change)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">前月比</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      <Card className="glass-effect">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">売上トレンド</CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-chart-1 rounded-full mr-2"></div>
                <span>売上</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-chart-2 rounded-full mr-2"></div>
                <span>新規顧客数</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueTrendChart filterState={filterState} />
        </CardContent>
      </Card>
    </div>
  );
}
