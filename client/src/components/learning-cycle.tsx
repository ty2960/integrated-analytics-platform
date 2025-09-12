import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, RotateCcw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import type { DecisionLogWithOutcome } from "@/types/analytics";
import ROIAnalysisChart from "@/components/charts/roi-analysis";
import { useToast } from "@/hooks/use-toast";

interface LearningCycleProps {
  onBIReflection: () => void;
  onNewHypothesis: () => void;
}

export default function LearningCycle({ onBIReflection, onNewHypothesis }: LearningCycleProps) {
  const [decisions, setDecisions] = useState<DecisionLogWithOutcome[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    ongoing: 0,
    failed: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    const decisionLogs = storage.getDecisionLogs();
    const outcomes = storage.getDecisionOutcomes();
    
    const decisionsWithOutcomes: DecisionLogWithOutcome[] = decisionLogs.map(decision => {
      const outcome = outcomes.find(o => o.decision_id === decision.decision_id);
      return { ...decision, outcome };
    });

    setDecisions(decisionsWithOutcomes);

    // Calculate stats
    const total = decisionsWithOutcomes.length;
    const completed = decisionsWithOutcomes.filter(d => d.outcome && d.outcome.status === 'Success').length;
    const ongoing = decisionsWithOutcomes.filter(d => !d.outcome || d.outcome.status === 'Ongoing').length;
    const failed = decisionsWithOutcomes.filter(d => d.outcome && ['Failed', 'Partial'].includes(d.outcome.status)).length;

    setStats({ total, completed, ongoing, failed });

    // Auto-generate outcomes for decisions past evaluation period (simulation)
    generateSimulatedOutcomes(decisionsWithOutcomes);
  }, []);

  const generateSimulatedOutcomes = (decisions: DecisionLogWithOutcome[]) => {
    const now = new Date();
    
    decisions.forEach(decision => {
      if (!decision.outcome && new Date(decision.evaluation_end) < now) {
        // Simulate outcome for expired evaluation periods
        const mockOutcome = {
          decision_id: decision.decision_id,
          measured_metric: decision.expected_uplift,
          actual_value: Math.random() * 20 + 5, // Random 5-25% improvement
          expected_value: parseFloat(decision.expected_uplift.match(/\d+/)?.[0] || '10'),
          eval_window: `${decision.evaluation_start} - ${decision.evaluation_end}`,
          variance: (Math.random() - 0.5) * 10, // ±5% variance
          notes: '自動生成された結果（デモ用）',
          status: (Math.random() > 0.3 ? 'Success' : 'Partial') as 'Success' | 'Partial' | 'Failed' | 'Ongoing',
        };
        
        storage.addDecisionOutcome(mockOutcome);
      }
    });
  };

  const getStatusBadge = (decision: DecisionLogWithOutcome) => {
    if (!decision.outcome) {
      return <Badge variant="outline" className="bg-chart-3/20 text-chart-3">実行中</Badge>;
    }
    
    switch (decision.outcome.status) {
      case 'Success':
        return <Badge variant="outline" className="bg-chart-2/20 text-chart-2">成功</Badge>;
      case 'Failed':
        return <Badge variant="outline" className="bg-destructive/20 text-destructive">失敗</Badge>;
      case 'Partial':
        return <Badge variant="outline" className="bg-chart-3/20 text-chart-3">要改善</Badge>;
      default:
        return <Badge variant="outline" className="bg-chart-3/20 text-chart-3">実行中</Badge>;
    }
  };

  const handleBIReflection = () => {
    toast({
      title: "BIへ反映",
      description: "最新の効果測定結果をBIダッシュボードに反映しました",
    });
    onBIReflection();
  };

  return (
    <div className="space-y-8">
      {/* Decision Log Overview */}
      <Card className="glass-effect">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary" />
              意思決定ログ管理
            </CardTitle>
            <div className="flex space-x-3">
              <Button
                data-testid="button-bi-reflection"
                onClick={handleBIReflection}
                size="sm"
              >
                BIへ反映
              </Button>
              <Button
                data-testid="button-export-report"
                variant="outline"
                size="sm"
              >
                レポート出力
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border border-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-card-foreground" data-testid="stat-total">
                  {stats.total}
                </div>
                <div className="text-sm text-muted-foreground">総意思決定数</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border border-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-chart-2" data-testid="stat-completed">
                  {stats.completed}
                </div>
                <div className="text-sm text-muted-foreground">評価完了</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border border-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-chart-3" data-testid="stat-ongoing">
                  {stats.ongoing}
                </div>
                <div className="text-sm text-muted-foreground">実行中</div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border border-border">
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-destructive" data-testid="stat-failed">
                  {stats.failed}
                </div>
                <div className="text-sm text-muted-foreground">効果不十分</div>
              </CardContent>
            </Card>
          </div>

          {/* Decision Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">決定ID</th>
                  <th className="text-left py-3 px-4 font-medium">内容</th>
                  <th className="text-left py-3 px-4 font-medium">期待効果</th>
                  <th className="text-left py-3 px-4 font-medium">実測結果</th>
                  <th className="text-left py-3 px-4 font-medium">評価期間</th>
                  <th className="text-left py-3 px-4 font-medium">ステータス</th>
                  <th className="text-left py-3 px-4 font-medium">アクション</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((decision) => (
                  <tr key={decision.decision_id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4 font-mono text-xs">{decision.decision_id}</td>
                    <td className="py-3 px-4 max-w-48 truncate">{decision.context}</td>
                    <td className="py-3 px-4">{decision.expected_uplift}</td>
                    <td className="py-3 px-4">
                      {decision.outcome ? (
                        <span className={decision.outcome.status === 'Success' ? 'text-chart-2' : 'text-destructive'}>
                          {decision.outcome.actual_value.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {new Date(decision.evaluation_start).toLocaleDateString()} - {new Date(decision.evaluation_end).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(decision)}
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" className="text-xs">
                        詳細
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance Analysis */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">効果測定分析</CardTitle>
          </CardHeader>
          <CardContent>
            {/* ROI Chart */}
            <ROIAnalysisChart decisions={decisions} />

            {/* Key Insights */}
            <div className="space-y-3 mt-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-chart-2 rounded-full mt-2 mr-3"></div>
                  <div>
                    <div className="font-medium text-sm">最高ROI施策</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      新規顧客向け初回割引キャンペーン (ROI: 284%)
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-chart-3 rounded-full mt-2 mr-3"></div>
                  <div>
                    <div className="font-medium text-sm">改善必要</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      既存顧客アップセル施策の効果が期待を下回る
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start">
                  <div className="w-2 h-2 bg-chart-1 rounded-full mt-2 mr-3"></div>
                  <div>
                    <div className="font-medium text-sm">予測精度</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      CVR予測の平均誤差: 8.2% (許容範囲内)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Loop */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">学習フィードバック</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Learning Insights */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">モデル精度向上</h3>
                  <Badge variant="outline" className="text-xs bg-chart-2/20 text-chart-2">自動更新</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  過去30日の意思決定結果を学習データに追加
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>CVR予測精度</span>
                    <span className="text-chart-2">92.1% → 94.3%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>AOV予測精度</span>
                    <span className="text-chart-2">87.8% → 89.1%</span>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">仮説検証結果</h3>
                  <Badge variant="outline" className="text-xs bg-chart-3/20 text-chart-3">要確認</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  「価格弾性の低いセグメント」仮説に矛盾
                </p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 高額商品でも割引効果が高い</li>
                  <li>• セグメント別の弾性見直しが必要</li>
                  <li>• 次回BA分析で詳細調査を推奨</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">推奨アクション</h3>
                  <Badge variant="outline" className="text-xs bg-chart-1/20 text-chart-1">新規提案</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  成功パターンの水平展開を検討
                </p>
                <Button
                  data-testid="button-generate-hypothesis"
                  onClick={onNewHypothesis}
                  size="sm"
                  className="w-full text-xs"
                >
                  新規仮説を生成してBAへ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
