/**
 * 検証用エージェント「Insight Scout」のツール群。
 *
 * このリポジトリ（統合アナリティクスプラットフォーム）のドメインに合わせ、
 * KPI 調査を行うツールを提供する。データは決定論的に生成し、外部依存無しで
 * 検証を再現可能にしている。
 *
 * save_report のみ requiresApproval: true —— 副作用を持つ操作は承認ゲートを
 * 通す（Codex の approval modes / サンドボックス境界の考え方）。
 */
import type { ToolImpl } from "./types.ts";

// 決定論的な擬似メトリクスデータ（seed 固定の線形合同法）
function makeSeries(seed: number, days: number, base: number, spread: number) {
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const series: { day: number; value: number }[] = [];
  for (let d = 1; d <= days; d++) {
    series.push({ day: d, value: Math.round(base + (next() - 0.5) * spread) });
  }
  return series;
}

const METRICS: Record<string, { day: number; value: number }[]> = {
  revenue: makeSeries(7, 30, 1200, 200),
  active_users: makeSeries(11, 30, 850, 120),
  conversion_rate: makeSeries(13, 30, 32, 6),
};
// revenue の 23 日目に異常値を注入（異常検知シナリオ用）
METRICS.revenue[22].value = 310;

/** save_report が書き込む先（検証コードから中身を確認できるよう公開） */
export const savedReports = new Map<string, string>();

export function buildAnalyticsTools(): ToolImpl[] {
  return [
    {
      spec: {
        name: "list_metrics",
        description: "利用可能なメトリクス名の一覧を返す",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      run: () => JSON.stringify(Object.keys(METRICS)),
    },
    {
      spec: {
        name: "get_metric_series",
        description: "指定メトリクスの日次時系列（直近 days 日）を返す",
        inputSchema: {
          type: "object",
          properties: {
            metric: { type: "string" },
            days: { type: "integer", minimum: 1, maximum: 30 },
          },
          required: ["metric"],
          additionalProperties: false,
        },
      },
      run: (input) => {
        const metric = String(input.metric);
        const series = METRICS[metric];
        if (!series) throw new Error(`メトリクスが存在しません: ${metric}`);
        const days = typeof input.days === "number" ? input.days : 30;
        return JSON.stringify(series.slice(-days));
      },
    },
    {
      spec: {
        name: "detect_anomaly",
        description: "指定メトリクスの z スコア外れ値（|z| > 3）を検出する",
        inputSchema: {
          type: "object",
          properties: { metric: { type: "string" } },
          required: ["metric"],
          additionalProperties: false,
        },
      },
      run: (input) => {
        const metric = String(input.metric);
        const series = METRICS[metric];
        if (!series) throw new Error(`メトリクスが存在しません: ${metric}`);
        const values = series.map((p) => p.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sd = Math.sqrt(
          values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
        );
        const anomalies = series.filter((p) => Math.abs((p.value - mean) / sd) > 3);
        return JSON.stringify({ mean: Math.round(mean), sd: Math.round(sd), anomalies });
      },
    },
    {
      spec: {
        name: "save_report",
        description: "調査結果をレポートとして保存する（承認が必要な副作用操作）",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["title", "body"],
          additionalProperties: false,
        },
        requiresApproval: true,
      },
      run: (input) => {
        savedReports.set(String(input.title), String(input.body));
        return `レポート「${input.title}」を保存しました`;
      },
    },
  ];
}
