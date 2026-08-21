/**
 * エージェントループ検証スイート。
 *
 * 実行: npm run agent:validate
 *
 * APIキー・ネットワーク不要。スクリプト駆動のモックモデル（ScriptedModelClient）で
 * ハーネス（エージェントループ）そのものの性質を決定論的に検証する。
 * 「モデルを固定してハーネスだけを評価できる」ことは ARC-AGI-3 の一次ソースが
 * 示した核心であり、このスイートの存在理由でもある。
 *
 * 検証観点:
 *   V1 基本ループ: ツール往復と構造化された完了
 *   V2 並列ツール呼び出し: 全結果が 1 バッチで返る
 *   V3 有界実行: maxTurns で必ず停止する（codex exec の bounded run）
 *   V4 推論の保持: retainReasoning ON/OFF で次リクエストの内容が変わる（ARC-AGI-3 設定1）
 *   V5 コンパクション: 要約は序盤の重要事実を保持し、切り捨ては失う（ARC-AGI-3 設定2）
 *   V6 承認ゲート: 却下は副作用を防ぎ、ループはクラッシュしない（Codex approval modes）
 *   V7 失敗処理: ツール例外はエラー結果としてモデルに返り、回復できる
 *   V8 イベントストリーム: 進捗が正しい順序で観測できる（codex app-server）
 */
import { AgentLoop } from "./loop.ts";
import { ScriptedModelClient, callTool, finish } from "./model/mock.ts";
import { buildAnalyticsTools, savedReports } from "./tools.ts";
import type { AgentConfig, AgentEvent } from "./types.ts";

// ---------------------------------------------------------------------------
// 極小テストランナー
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n━━ ${title}`);
}

const SYSTEM = "あなたはアナリティクスプラットフォームの調査エージェントです。";

function baseConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    systemPrompt: SYSTEM,
    tools: buildAnalyticsTools(),
    maxTurns: 10,
    compaction: "off",
    approvalPolicy: "on-request",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// V1 基本ループ
// ---------------------------------------------------------------------------
async function v1() {
  section("V1 基本ループ: ツール往復と構造化された完了");
  const model = new ScriptedModelClient([
    callTool("list_metrics", {}, { reasoning: "まず利用可能なメトリクスを確認する" }),
    callTool("get_metric_series", { metric: "revenue", days: 7 }),
    finish("revenue は安定しています。", { verdict: "stable", metric: "revenue" }),
  ]);
  const result = await new AgentLoop(model, baseConfig()).run(
    "revenue の状態を調査して",
  );

  check("status が completed", result.status === "completed");
  check("3 ターンで完了", result.turns === 3, `turns=${result.turns}`);
  check(
    "構造化出力が返る",
    JSON.stringify(result.output) ===
      JSON.stringify({ verdict: "stable", metric: "revenue" }),
  );
  check("最終テキストが返る", result.finalText === "revenue は安定しています。");
  const secondReq = model.requests[1];
  const fedBack =
    secondReq &&
    JSON.stringify(secondReq.history).includes("revenue") &&
    secondReq.history.some((h) => h.kind === "tool_results");
  check("ツール結果が次のリクエストに反映される", Boolean(fedBack));
  check(
    "ツール定義が毎リクエストでモデルに渡る",
    model.requests.every((r) => r.tools.some((t) => t.name === "list_metrics")),
  );
}

// ---------------------------------------------------------------------------
// V2 並列ツール呼び出し
// ---------------------------------------------------------------------------
async function v2() {
  section("V2 並列ツール呼び出し: 全結果が 1 バッチで返る");
  const model = new ScriptedModelClient([
    {
      toolCalls: [
        { callId: "c1", name: "get_metric_series", input: { metric: "revenue", days: 3 } },
        { callId: "c2", name: "get_metric_series", input: { metric: "active_users", days: 3 } },
      ],
      done: false,
    },
    finish("両方確認しました。"),
  ]);
  const result = await new AgentLoop(model, baseConfig()).run(
    "revenue と active_users を比較して",
  );

  const batch = model.requests[1]?.history.find((h) => h.kind === "tool_results");
  check("status が completed", result.status === "completed");
  check(
    "2 件の結果が 1 つの tool_results バッチに入る",
    batch?.kind === "tool_results" && batch.results.length === 2,
  );
  check(
    "結果の順序が呼び出し順と一致（callId で対応付く）",
    batch?.kind === "tool_results" &&
      batch.results[0].callId === "c1" &&
      batch.results[1].callId === "c2",
  );
}

// ---------------------------------------------------------------------------
// V3 有界実行
// ---------------------------------------------------------------------------
async function v3() {
  section("V3 有界実行: maxTurns で必ず停止する");
  // 永遠にツールを呼び続けるモデル
  const model = new ScriptedModelClient([callTool("list_metrics", {})]);
  const result = await new AgentLoop(model, baseConfig({ maxTurns: 5 })).run(
    "終わらないタスク",
  );

  check("status が max_turns_exceeded", result.status === "max_turns_exceeded");
  check("ちょうど maxTurns で停止", result.turns === 5, `turns=${result.turns}`);
  check(
    "停止後も task_completed イベントが出る（クラッシュではなく構造化終了）",
    result.events.at(-1)?.type === "task_completed",
  );
}

// ---------------------------------------------------------------------------
// V4 推論の保持（ARC-AGI-3 設定 1）
// ---------------------------------------------------------------------------
async function v4() {
  section("V4 推論の保持: ON では次リクエストに前ターンの推論が含まれる");
  const script = () => [
    callTool("list_metrics", {}, { reasoning: "REASONING_MARKER_ターン1の思考" }),
    callTool("get_metric_series", { metric: "revenue" }, { reasoning: "ターン2の思考" }),
    finish("完了"),
  ];

  const modelOn = new ScriptedModelClient(script());
  await new AgentLoop(modelOn, baseConfig({ retainReasoning: true })).run("調査して");
  const req3On = JSON.stringify(modelOn.requests[2]?.history ?? []);
  check(
    "ON: ターン1の推論が第3リクエストの履歴に残る",
    req3On.includes("REASONING_MARKER_ターン1の思考"),
  );

  const modelOff = new ScriptedModelClient(script());
  await new AgentLoop(modelOff, baseConfig({ retainReasoning: false })).run("調査して");
  const req3Off = JSON.stringify(modelOff.requests[2]?.history ?? []);
  check(
    "OFF: 推論が履歴から破棄される（ARC-AGI-3 で問題だった挙動の再現）",
    !req3Off.includes("REASONING_MARKER"),
  );
  check(
    "OFF でもテキスト・ツール往復は保持される（推論だけが失われる）",
    (modelOff.requests[2]?.history ?? []).some((h) => h.kind === "tool_results"),
  );
}

// ---------------------------------------------------------------------------
// V5 コンパクション（ARC-AGI-3 設定 2）
// ---------------------------------------------------------------------------
async function v5() {
  const KEY_FACT = "重要制約: 予算しきい値は42万円";
  const script = () => [
    callTool("get_metric_series", { metric: "revenue" }),
    callTool("get_metric_series", { metric: "active_users" }),
    callTool("get_metric_series", { metric: "conversion_rate" }),
    callTool("detect_anomaly", { metric: "revenue" }),
    finish("調査完了"),
  ];
  const cfg = (compaction: "summarize" | "truncate"): AgentConfig =>
    baseConfig({
      compaction,
      contextLimitTokens: 400,
      keepRecentItems: 2,
      pinnedFacts: [KEY_FACT],
    });

  section("V5a コンパクション(要約): 序盤の重要事実が保持される");
  const modelSum = new ScriptedModelClient(script());
  const resultSum = await new AgentLoop(modelSum, cfg("summarize")).run(
    `全メトリクスを調査して。${KEY_FACT}`,
  );
  const compEvents = resultSum.events.filter((e) => e.type === "compaction");
  check("コンパクションイベントが発火する", compEvents.length > 0);
  check(
    "コンパクションで推定トークンが減る",
    compEvents.every(
      (e) => e.type === "compaction" && e.estTokensAfter < e.estTokensBefore,
    ),
  );
  const lastReqSum = JSON.stringify(modelSum.requests.at(-1)?.history ?? []);
  check(
    "要約後も先頭のタスク指示（重要事実を含む）が残る",
    lastReqSum.includes(KEY_FACT),
  );
  check(
    "固定事実(pinnedFacts)が要約に逐語的に埋め込まれる",
    JSON.stringify(resultSum.history).includes("固定事実"),
  );
  check(
    "要約はモデルに委譲される（summarize が呼ばれる）",
    modelSum.summarizeCalls.length > 0,
  );
  check("status が completed", resultSum.status === "completed");

  section("V5b 切り捨て(アンチパターン): 序盤の重要事実が失われる");
  const modelTrunc = new ScriptedModelClient(script());
  const resultTrunc = await new AgentLoop(modelTrunc, cfg("truncate")).run(
    `全メトリクスを調査して。${KEY_FACT}`,
  );
  const lastReqTrunc = JSON.stringify(modelTrunc.requests.at(-1)?.history ?? []);
  check(
    "切り捨てでは先頭のタスク指示ごと重要事実が消える",
    !lastReqTrunc.includes(KEY_FACT),
  );
  check(
    "切り捨てイベントも観測できる（何が起きたか隠さない）",
    resultTrunc.events.some((e) => e.type === "compaction" && e.strategy === "truncate"),
  );
}

// ---------------------------------------------------------------------------
// V6 承認ゲート（Codex approval modes）
// ---------------------------------------------------------------------------
async function v6() {
  section("V6 承認ゲート: 却下は副作用を防ぎ、ループは継続する");
  savedReports.clear();
  const script = () => [
    callTool("save_report", { title: "却下されるレポート", body: "..." }),
    finish("レポート保存は却下されたため、結果を口頭で報告します。"),
  ];

  const modelDeny = new ScriptedModelClient(script());
  const resultDeny = await new AgentLoop(
    modelDeny,
    baseConfig({ approvalPolicy: "on-request", approver: () => false }),
  ).run("調査してレポートを保存して");
  check(
    "却下されたツールは実行されない（副作用なし）",
    !savedReports.has("却下されるレポート"),
  );
  const denyBatch = modelDeny.requests[1]?.history.find(
    (h) => h.kind === "tool_results",
  );
  check(
    "却下はエラー結果としてモデルに返る（クラッシュしない）",
    denyBatch?.kind === "tool_results" && denyBatch.results[0].isError,
  );
  check("却下後もタスクは正常終了する", resultDeny.status === "completed");
  check(
    "approval_requested / approval_decided イベントが出る",
    resultDeny.events.some((e) => e.type === "approval_requested") &&
      resultDeny.events.some((e) => e.type === "approval_decided" && !e.approved),
  );

  savedReports.clear();
  const modelApprove = new ScriptedModelClient([
    callTool("save_report", { title: "承認されたレポート", body: "本文" }),
    finish("保存しました。"),
  ]);
  await new AgentLoop(
    modelApprove,
    baseConfig({ approvalPolicy: "on-request", approver: () => true }),
  ).run("調査してレポートを保存して");
  check("承認されたツールは実行される", savedReports.has("承認されたレポート"));

  savedReports.clear();
  const modelAuto = new ScriptedModelClient([
    callTool("save_report", { title: "自動実行レポート", body: "本文" }),
    finish("保存しました。"),
  ]);
  const resultAuto = await new AgentLoop(
    modelAuto,
    baseConfig({ approvalPolicy: "auto" }),
  ).run("調査してレポートを保存して");
  check(
    "auto ポリシーでは承認を求めず実行する",
    savedReports.has("自動実行レポート") &&
      !resultAuto.events.some((e) => e.type === "approval_requested"),
  );

  // 読み取り専用ツールは on-request でも承認不要
  const modelRead = new ScriptedModelClient([
    callTool("list_metrics", {}),
    finish("確認しました。"),
  ]);
  const resultRead = await new AgentLoop(
    modelRead,
    baseConfig({ approvalPolicy: "on-request", approver: () => false }),
  ).run("メトリクス一覧を見せて");
  check(
    "読み取り専用ツールは on-request でも承認不要",
    resultRead.status === "completed" &&
      !resultRead.events.some((e) => e.type === "approval_requested"),
  );
}

// ---------------------------------------------------------------------------
// V7 失敗処理
// ---------------------------------------------------------------------------
async function v7() {
  section("V7 失敗処理: ツール例外はエラー結果として返り、回復できる");
  const model = new ScriptedModelClient([
    callTool("get_metric_series", { metric: "存在しないメトリクス" }),
    // モデルはエラーを見て正しいメトリクス名でリトライする、という筋書き
    (req) => {
      const lastBatch = req.history.at(-1);
      const sawError =
        lastBatch?.kind === "tool_results" && lastBatch.results[0].isError;
      return sawError
        ? callTool("get_metric_series", { metric: "revenue" })
        : finish("エラーが伝わっていません", { bug: true });
    },
    finish("回復して調査を完了しました。", { recovered: true }),
  ]);
  const result = await new AgentLoop(model, baseConfig()).run("調査して");

  check(
    "例外がエラー結果としてモデルに渡る",
    JSON.stringify(model.requests[1]?.history ?? []).includes("ツール実行エラー"),
  );
  check(
    "モデルはエラーから回復してタスクを完了できる",
    result.status === "completed" &&
      JSON.stringify(result.output) === JSON.stringify({ recovered: true }),
  );

  const modelUnknown = new ScriptedModelClient([
    { toolCalls: [{ callId: "x1", name: "no_such_tool", input: {} }], done: false },
    finish("未知ツールには頼らず完了しました。"),
  ]);
  const resultUnknown = await new AgentLoop(modelUnknown, baseConfig()).run("調査して");
  check(
    "未知のツール名もエラー結果になりループは継続する",
    resultUnknown.status === "completed" &&
      JSON.stringify(modelUnknown.requests[1]?.history ?? []).includes("未知のツール"),
  );
}

// ---------------------------------------------------------------------------
// V8 イベントストリーム
// ---------------------------------------------------------------------------
async function v8() {
  section("V8 イベントストリーム: 進捗が正しい順序で観測できる");
  const streamed: AgentEvent[] = [];
  const model = new ScriptedModelClient([
    callTool("list_metrics", {}, { reasoning: "確認する" }),
    finish("完了"),
  ]);
  const result = await new AgentLoop(
    model,
    baseConfig({ onEvent: (e) => streamed.push(e) }),
  ).run("調査して");

  check(
    "onEvent で全イベントがリアルタイムに流れる",
    streamed.length === result.events.length && streamed.length > 0,
  );
  const types = result.events.map((e) => e.type);
  const order: AgentEvent["type"][] = [
    "task_started",
    "turn_started",
    "model_reasoning",
    "tool_call",
    "tool_result",
    "assistant_message",
    "task_completed",
  ];
  let idx = -1;
  const ordered = order.every((t) => {
    const next = types.indexOf(t, idx + 1);
    if (next === -1) return false;
    idx = next;
    return true;
  });
  check("イベントが期待順序で並ぶ", ordered, `actual=${types.join(" → ")}`);
  check(
    "tool_call は必ず対応する tool_result より先",
    types.indexOf("tool_call") < types.indexOf("tool_result"),
  );
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("エージェントループ検証スイート（モックモデル・決定論的）");
  await v1();
  await v2();
  await v3();
  await v4();
  await v5();
  await v6();
  await v7();
  await v8();

  console.log(`\n結果: ${passed} 件成功 / ${failed} 件失敗`);
  if (failed > 0) {
    console.log("失敗した検証:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("すべての検証に成功しました 🎉");
}

main().catch((err) => {
  console.error("検証スイート自体がクラッシュしました:", err);
  process.exit(1);
});
