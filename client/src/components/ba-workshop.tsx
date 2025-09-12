import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { semantics } from "@/lib/semantics";
import type { FilterState, AnalyticsHypothesis, SegmentData } from "@/types/analytics";
import SegmentComparisonChart from "@/components/charts/segment-comparison";
import { useToast } from "@/hooks/use-toast";

interface BAWorkshopProps {
  filterState: FilterState;
  onPredictionRequest: (hypothesisId: string) => void;
}

export default function BAWorkshop({ filterState, onPredictionRequest }: BAWorkshopProps) {
  const [hypotheses, setHypotheses] = useState<AnalyticsHypothesis[]>([]);
  const [segmentData, setSegmentData] = useState<SegmentData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    assumptions: "",
    target_metric: "",
    guardrails: ["", ""],
    tags: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    setHypotheses(storage.getHypotheses());
    setSegmentData(semantics.getSegmentData(filterState));
  }, [filterState]);

  const filteredHypotheses = hypotheses.filter(h =>
    h.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveHypothesis = () => {
    if (!formData.title.trim()) {
      toast({
        title: "エラー",
        description: "タイトルは必須です",
        variant: "destructive",
      });
      return;
    }

    const newHypothesis: AnalyticsHypothesis = {
      hypothesis_id: `HYP-${new Date().toISOString().split('T')[0]}-${String(Date.now()).slice(-3)}`,
      title: formData.title,
      text: `${formData.title}についての詳細な分析と検証`,
      assumptions: formData.assumptions.split('\n').filter(a => a.trim()),
      owner: "分析チーム",
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      created_at: new Date().toISOString(),
      metrics: {
        target: formData.target_metric,
        guardrail: formData.guardrails.filter(g => g.trim()),
      },
      data_scope: `${filterState.period} / ${filterState.channel}チャネル`,
    };

    storage.addHypothesis(newHypothesis);
    setHypotheses(storage.getHypotheses());
    setFormData({
      title: "",
      assumptions: "",
      target_metric: "",
      guardrails: ["", ""],
      tags: "",
    });
    setShowForm(false);

    toast({
      title: "保存完了",
      description: "仮説が正常に保存されました",
    });
  };

  const generateYamlPreview = () => {
    if (!formData.title) return "";

    return `hypothesis_id: HYP-${new Date().toISOString().split('T')[0]}-XXX
title: ${formData.title}
assumptions:
${formData.assumptions.split('\n').filter(a => a.trim()).map(a => `  - ${a.trim()}`).join('\n')}
metrics:
  target: ${formData.target_metric}
  guardrail:
${formData.guardrails.filter(g => g.trim()).map(g => `    - "${g.trim()}"`).join('\n')}
data_scope: "${filterState.period} / ${filterState.channel}チャネル"`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Analysis */}
      <div className="lg:col-span-2 space-y-6">
        {/* Trend Analysis */}
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              トレンド分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Segment Comparison Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">セグメント</th>
                    <th className="text-right py-3 px-4 font-medium">売上</th>
                    <th className="text-right py-3 px-4 font-medium">前月比</th>
                    <th className="text-right py-3 px-4 font-medium">AOV</th>
                    <th className="text-right py-3 px-4 font-medium">コンバージョン率</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentData.map((segment) => (
                    <tr key={segment.segment} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">{segment.segment}</td>
                      <td className="text-right py-3 px-4 font-semibold">
                        ¥{segment.revenue.toLocaleString()}
                      </td>
                      <td className={`text-right py-3 px-4 ${segment.revenue_change >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                        {segment.revenue_change >= 0 ? '+' : ''}{segment.revenue_change.toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-4">
                        ¥{segment.aov.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4">
                        {segment.conversion_rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SegmentComparisonChart filterState={filterState} />
          </CardContent>
        </Card>

        {/* Hypothesis Search and List */}
        <Card className="glass-effect">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">仮説・前提メモ</CardTitle>
              <Button 
                data-testid="button-new-hypothesis"
                onClick={() => setShowForm(!showForm)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                新規作成
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="input-search-hypothesis"
                  type="text"
                  placeholder="仮説を検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Hypothesis Cards */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredHypotheses.map((hypothesis) => (
                <Card 
                  key={hypothesis.hypothesis_id} 
                  className="bg-card border border-border hover:shadow-md transition-all duration-200 cursor-pointer"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm">{hypothesis.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {hypothesis.hypothesis_id}
                        </p>
                      </div>
                      {hypothesis.tags.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {hypothesis.tags[0]}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      {hypothesis.assumptions.length > 0 && (
                        <p><strong>前提:</strong> {hypothesis.assumptions[0]}</p>
                      )}
                      <p><strong>目標:</strong> {hypothesis.metrics.target}</p>
                      {hypothesis.metrics.guardrail.length > 0 && (
                        <p><strong>ガードレール:</strong> {hypothesis.metrics.guardrail[0]}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">
                        作成: {new Date(hypothesis.created_at).toLocaleDateString('ja-JP')}
                      </span>
                      <Button
                        data-testid={`button-predict-${hypothesis.hypothesis_id}`}
                        size="sm"
                        variant="outline"
                        onClick={() => onPredictionRequest(hypothesis.hypothesis_id)}
                        className="text-xs"
                      >
                        この仮説でPA予測
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Hypothesis Form */}
      <div className="space-y-6">
        <Card className="glass-effect">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">仮説作成・編集</CardTitle>
          </CardHeader>
          <CardContent>
            {showForm ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">タイトル</label>
                  <Input
                    data-testid="input-hypothesis-title"
                    type="text"
                    placeholder="仮説のタイトルを入力"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">前提条件</label>
                  <Textarea
                    data-testid="textarea-assumptions"
                    placeholder="前提条件を改行区切りで入力"
                    value={formData.assumptions}
                    onChange={(e) => setFormData({ ...formData, assumptions: e.target.value })}
                    className="h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">目標メトリクス</label>
                  <Input
                    data-testid="input-target-metric"
                    type="text"
                    placeholder="例: 初回CVR"
                    value={formData.target_metric}
                    onChange={(e) => setFormData({ ...formData, target_metric: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">ガードレール</label>
                  <div className="space-y-2">
                    <Input
                      data-testid="input-guardrail-1"
                      type="text"
                      placeholder="例: LTV >= 2,800円"
                      value={formData.guardrails[0]}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        guardrails: [e.target.value, formData.guardrails[1]]
                      })}
                    />
                    <Input
                      data-testid="input-guardrail-2"
                      type="text"
                      placeholder="例: 返金率 <= 3%"
                      value={formData.guardrails[1]}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        guardrails: [formData.guardrails[0], e.target.value]
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">タグ</label>
                  <Input
                    data-testid="input-tags"
                    type="text"
                    placeholder="カンマ区切りで入力"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    data-testid="button-save-hypothesis"
                    onClick={handleSaveHypothesis}
                    className="flex-1"
                  >
                    保存
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  新規仮説を作成するには「新規作成」ボタンをクリックしてください
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新規作成
                </Button>
              </div>
            )}

            {/* YAML Preview */}
            {showForm && formData.title && (
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">YAML プレビュー</label>
                <pre className="bg-muted p-4 rounded-md text-xs text-muted-foreground overflow-x-auto">
                  <code data-testid="yaml-preview">{generateYamlPreview()}</code>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
