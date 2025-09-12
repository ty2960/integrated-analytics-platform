import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Brain, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { prediction } from "@/lib/prediction";
import { advancedML, type AdvancedPredictionResult } from "@/lib/ml-models";
import type { FilterState, PredictionResult, DecisionLog, AnalyticsHypothesis } from "@/types/analytics";
import PredictionChart from "@/components/charts/prediction-chart";
import { useToast } from "@/hooks/use-toast";

interface PAPredictionProps {
  filterState: FilterState;
  hypothesisId?: string;
  predictionContext?: {
    hypothesis_id: string;
    target_metric: string;
  };
  onDecisionRecorded: () => void;
}

export default function PAPrediction({ 
  filterState, 
  hypothesisId, 
  predictionContext, 
  onDecisionRecorded 
}: PAPredictionProps) {
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [advancedPrediction, setAdvancedPrediction] = useState<AdvancedPredictionResult | null>(null);
  const [useAdvancedModel, setUseAdvancedModel] = useState(true);
  const [isGeneratingPrediction, setIsGeneratingPrediction] = useState(false);
  const [hypothesis, setHypothesis] = useState<AnalyticsHypothesis | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    context: "",
    expected_uplift: "",
    guardrails: ["", ""],
    actor: "",
    evaluation_period_start: new Date().toISOString().split('T')[0],
    evaluation_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const { toast } = useToast();

  useEffect(() => {
    if (hypothesisId) {
      const h = storage.getHypotheses().find(h => h.hypothesis_id === hypothesisId);
      setHypothesis(h || null);
      
      if (h) {
        generatePrediction(h);
      }
    }
  }, [hypothesisId, filterState, useAdvancedModel]);

  const generatePrediction = async (h: AnalyticsHypothesis) => {
    setIsGeneratingPrediction(true);
    
    try {
      if (useAdvancedModel) {
        // 高度な機械学習モデルを使用
        const targetMetric = h.metrics.target.includes('CVR') || h.metrics.target.includes('コンバージョン') ? 'CVR' : 'AOV';
        const advancedResult = await advancedML.predictAdvanced(targetMetric, filterState);
        setAdvancedPrediction(advancedResult);
        
        // 従来の予測結果も併用
        const result = targetMetric === 'CVR' ? prediction.predictCVR(hypothesisId!, filterState) : prediction.predictAOV(hypothesisId!, filterState);
        setPredictionResult(result);
        
        // 予測ログを保存
        storage.addPredictionLog({
          prediction_id: advancedResult.prediction_id,
          entity_key: `${filterState.segment}-${filterState.channel}`,
          target: advancedResult.target_metric,
          y_hat: advancedResult.predicted_value,
          y_lo: advancedResult.confidence_lower,
          y_hi: advancedResult.confidence_upper,
          model_id: `advanced-${advancedResult.model_performance.algorithm}-v2`,
          drivers: advancedResult.feature_importance.map(f => ({
            feature: f.feature,
            importance: f.importance,
            impact: f.impact
          })),
          ts: new Date().toISOString(),
        });
      } else {
        // 従来の簡易モデルを使用
        const targetMetric = h.metrics.target.includes('CVR') || h.metrics.target.includes('コンバージョン') ? 'CVR' : 'AOV';
        const result = targetMetric === 'CVR' ? prediction.predictCVR(hypothesisId!, filterState) : prediction.predictAOV(hypothesisId!, filterState);
        setPredictionResult(result);
        setAdvancedPrediction(null);
        
        storage.addPredictionLog({
          prediction_id: result.prediction_id,
          entity_key: `${filterState.segment}-${filterState.channel}`,
          target: result.target_metric,
          y_hat: result.predicted_value,
          y_lo: result.confidence_lower,
          y_hi: result.confidence_upper,
          model_id: 'simple-regression-v1',
          drivers: result.key_drivers,
          ts: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Prediction generation failed:', error);
      // フォールバック：簡易モデルを使用（目標指標に応じて選択）
      const targetMetric = h.metrics.target.includes('CVR') || h.metrics.target.includes('コンバージョン') ? 'CVR' : 'AOV';
      const result = targetMetric === 'CVR' ? prediction.predictCVR(hypothesisId!, filterState) : prediction.predictAOV(hypothesisId!, filterState);
      setPredictionResult(result);
      setAdvancedPrediction(null);
    } finally {
      setIsGeneratingPrediction(false);
    }
  };

  const handleRecordDecision = () => {
    if (!decisionForm.context.trim() || !decisionForm.actor.trim()) {
      toast({
        title: "エラー",
        description: "決定内容と担当者は必須です",
        variant: "destructive",
      });
      return;
    }

    const decision: DecisionLog = {
      decision_id: `DEC-${new Date().toISOString().split('T')[0]}-${String(Date.now()).slice(-3)}`,
      context: decisionForm.context,
      hypothesis_id: hypothesisId,
      actor: decisionForm.actor,
      decision_ts: new Date().toISOString(),
      expected_uplift: decisionForm.expected_uplift,
      guardrails: decisionForm.guardrails.filter(g => g.trim()),
      evaluation_start: decisionForm.evaluation_period_start,
      evaluation_end: decisionForm.evaluation_period_end,
    };

    storage.addDecisionLog(decision);

    toast({
      title: "記録完了",
      description: "意思決定が正常に記録されました",
    });

    onDecisionRecorded();
  };

  if (!predictionResult || !hypothesis) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            予測を実行するには、BAタブで仮説を選択してください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Prediction Results */}
      <div className="lg:col-span-2 space-y-6">
        {/* Current Context */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-primary" />
              予測コンテキスト
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">仮説ID:</span>
                  <span className="ml-2 font-mono" data-testid="context-hypothesis-id">
                    {hypothesis.hypothesis_id}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">目標指標:</span>
                  <span className="ml-2" data-testid="context-target-metric">
                    {hypothesis.metrics.target}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">対象セグメント:</span>
                  <span className="ml-2">{filterState.segment}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">予測期間:</span>
                  <span className="ml-2">
                    {decisionForm.evaluation_period_start} 〜 {decisionForm.evaluation_period_end}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              <span className="flex items-center">
                <Brain className="w-5 h-5 mr-2 text-primary" />
                モデル選択
              </span>
              {isGeneratingPrediction && (
                <div className="text-sm text-muted-foreground">予測計算中...</div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Button
                variant={useAdvancedModel ? "default" : "outline"}
                size="sm"
                onClick={() => setUseAdvancedModel(true)}
                disabled={isGeneratingPrediction}
                data-testid="button-advanced-model"
              >
                高度機械学習モデル
              </Button>
              <Button
                variant={!useAdvancedModel ? "default" : "outline"}
                size="sm"
                onClick={() => setUseAdvancedModel(false)}
                disabled={isGeneratingPrediction}
                data-testid="button-simple-model"
              >
                簡易モデル
              </Button>
            </div>
            {useAdvancedModel && advancedPrediction && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">アルゴリズム:</span>
                    <span className="font-mono text-xs">{advancedPrediction.model_performance.model_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">精度 (R²):</span>
                    <span>{(advancedPrediction.model_performance.r_squared * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RMSE:</span>
                    <span>{advancedPrediction.model_performance.rmse.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">トレーニングサンプル:</span>
                    <span>{advancedPrediction.model_performance.training_samples}件</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prediction Results */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">予測結果</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Main Prediction */}
            <div className="prediction-confidence rounded-lg p-6 mb-6">
              <div className="text-center">
                <div 
                  className="text-4xl font-bold text-foreground mb-2"
                  data-testid="prediction-value"
                >
                  {useAdvancedModel && advancedPrediction 
                    ? advancedPrediction.predicted_value.toFixed(1)
                    : predictionResult.predicted_value.toFixed(1)
                  }{useAdvancedModel && advancedPrediction && advancedPrediction.target_metric === 'AOV' ? '円' : '%'}
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  予測{useAdvancedModel && advancedPrediction ? advancedPrediction.target_metric : predictionResult.target_metric}
                  {useAdvancedModel && advancedPrediction && (
                    <span className="ml-2 px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                      {advancedPrediction.model_performance.algorithm.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center space-x-8 text-sm">
                  <div className="text-center">
                    <div 
                      className="text-lg font-semibold text-destructive"
                      data-testid="prediction-lower"
                    >
                      {useAdvancedModel && advancedPrediction 
                        ? advancedPrediction.confidence_lower.toFixed(1)
                        : predictionResult.confidence_lower.toFixed(1)
                      }{useAdvancedModel && advancedPrediction && advancedPrediction.target_metric === 'AOV' ? '円' : '%'}
                    </div>
                    <div className="text-xs text-muted-foreground">下限 (95%信頼区間)</div>
                  </div>
                  <div className="text-center">
                    <div 
                      className="text-lg font-semibold text-chart-2"
                      data-testid="prediction-upper"
                    >
                      {useAdvancedModel && advancedPrediction 
                        ? advancedPrediction.confidence_upper.toFixed(1)
                        : predictionResult.confidence_upper.toFixed(1)
                      }{useAdvancedModel && advancedPrediction && advancedPrediction.target_metric === 'AOV' ? '円' : '%'}
                    </div>
                    <div className="text-xs text-muted-foreground">上限 (95%信頼区間)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prediction Chart */}
            <PredictionChart predictionResult={predictionResult} />

            {/* Key Drivers */}
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-3">
                重要因子 (Top {useAdvancedModel && advancedPrediction ? '10' : '5'})
                {useAdvancedModel && advancedPrediction && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    特徴量エンジニアリング適用
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                {(useAdvancedModel && advancedPrediction 
                  ? advancedPrediction.feature_importance 
                  : predictionResult.key_drivers
                ).map((driver, index) => (
                  <div key={driver.feature} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium flex items-center">
                          {driver.feature}
                          {useAdvancedModel && advancedPrediction && 'category' in driver && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {driver.category === 'temporal' ? '時系列' :
                               driver.category === 'demographic' ? '属性' :
                               driver.category === 'behavioral' ? '行動' : '商品'}
                            </Badge>
                          )}
                        </span>
                        <span 
                          className="text-sm text-muted-foreground"
                          data-testid={`driver-impact-${index}`}
                        >
                          +{useAdvancedModel && advancedPrediction && advancedPrediction.target_metric === 'AOV' 
                            ? `${driver.impact.toFixed(0)}円` 
                            : `${(driver.impact * 100).toFixed(1)}%`} 影響
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full bg-chart-${(index % 5) + 1}`}
                          style={{ width: `${driver.importance * 100}%` }}
                          data-testid={`driver-bar-${index}`}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Information */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">モデル情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">モデル種別:</span>
                  <span>
                    {useAdvancedModel && advancedPrediction 
                      ? advancedPrediction.model_performance.model_type 
                      : predictionResult.model_info.model_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">学習期間:</span>
                  <span>過去90日</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">特徴量数:</span>
                  <span>
                    {useAdvancedModel && advancedPrediction 
                      ? `${advancedPrediction.feature_importance.length}変数` 
                      : `${predictionResult.key_drivers.length}変数`}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">精度:</span>
                  <span data-testid="model-accuracy">
                    {useAdvancedModel && advancedPrediction 
                      ? `${advancedPrediction.model_performance.accuracy.toFixed(1)}%` 
                      : `${predictionResult.model_info.accuracy}%`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最終更新:</span>
                  <span>
                    {useAdvancedModel && advancedPrediction 
                      ? new Date(advancedPrediction.model_performance.last_updated).toLocaleString('ja-JP')
                      : new Date(predictionResult.model_info.last_updated).toLocaleString('ja-JP')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">次回更新:</span>
                  <span>
                    {useAdvancedModel && advancedPrediction 
                      ? new Date(advancedPrediction.model_performance.next_update).toLocaleString('ja-JP')
                      : new Date(predictionResult.model_info.next_update).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Decision Recording */}
      <div className="space-y-6">
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">意思決定記録</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">決定内容</label>
                <Textarea
                  data-testid="textarea-decision-context"
                  placeholder="実行する施策や変更内容を記述"
                  value={decisionForm.context}
                  onChange={(e) => setDecisionForm({ ...decisionForm, context: e.target.value })}
                  className="h-20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">期待効果</label>
                <Input
                  data-testid="input-expected-uplift"
                  type="text"
                  placeholder="例: CVR 15%向上"
                  value={decisionForm.expected_uplift}
                  onChange={(e) => setDecisionForm({ ...decisionForm, expected_uplift: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">評価期間</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    data-testid="input-eval-start"
                    type="date"
                    value={decisionForm.evaluation_period_start}
                    onChange={(e) => setDecisionForm({ ...decisionForm, evaluation_period_start: e.target.value })}
                  />
                  <Input
                    data-testid="input-eval-end"
                    type="date"
                    value={decisionForm.evaluation_period_end}
                    onChange={(e) => setDecisionForm({ ...decisionForm, evaluation_period_end: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">ガードレール</label>
                <div className="space-y-2">
                  <Input
                    data-testid="input-decision-guardrail-1"
                    type="text"
                    placeholder="30日LTV >= 2,800円"
                    value={decisionForm.guardrails[0]}
                    onChange={(e) => setDecisionForm({ 
                      ...decisionForm, 
                      guardrails: [e.target.value, decisionForm.guardrails[1]]
                    })}
                  />
                  <Input
                    data-testid="input-decision-guardrail-2"
                    type="text"
                    placeholder="返金率 <= 3%"
                    value={decisionForm.guardrails[1]}
                    onChange={(e) => setDecisionForm({ 
                      ...decisionForm, 
                      guardrails: [decisionForm.guardrails[0], e.target.value]
                    })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">担当者</label>
                <Input
                  data-testid="input-decision-actor"
                  type="text"
                  placeholder="決定者・責任者名"
                  value={decisionForm.actor}
                  onChange={(e) => setDecisionForm({ ...decisionForm, actor: e.target.value })}
                />
              </div>

              <Button
                data-testid="button-record-decision"
                onClick={handleRecordDecision}
                className="w-full"
              >
                意思決定として記録
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assumptions & Constraints */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">前提・制約条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="font-medium text-xs text-muted-foreground mb-1">前提条件</div>
                <ul className="space-y-1 text-xs">
                  {hypothesis.assumptions.map((assumption, index) => (
                    <li key={index}>• {assumption}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-3">
                <div className="font-medium text-xs text-muted-foreground mb-1">ガードレール</div>
                <ul className="space-y-1 text-xs">
                  {hypothesis.metrics.guardrail.map((guardrail, index) => (
                    <li key={index}>• {guardrail}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">リスクアセスメント</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                <div>
                  <div className="font-medium text-sm">収益性リスク</div>
                  <div className="text-xs text-muted-foreground">LTV低下の可能性</div>
                </div>
                <Badge variant="outline" className="bg-chart-3/20 text-chart-3">中</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                <div>
                  <div className="font-medium text-sm">ブランドリスク</div>
                  <div className="text-xs text-muted-foreground">過度な値引き印象</div>
                </div>
                <Badge variant="outline" className="bg-chart-2/20 text-chart-2">低</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                <div>
                  <div className="font-medium text-sm">実行リスク</div>
                  <div className="text-xs text-muted-foreground">システム負荷増加</div>
                </div>
                <Badge variant="outline" className="bg-chart-2/20 text-chart-2">低</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
