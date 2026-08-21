/**
 * 実モデル（Claude API）でエージェントループを動かすデモ。
 *
 * 実行: npm run agent:demo
 * 認証: ANTHROPIC_API_KEY 環境変数、または `ant auth login` のプロファイル。
 *
 * ハーネスは validate.ts で検証したものと同一。差し替わるのは ModelClient だけ。
 * 承認ゲートはデモ用に「save_report を 1 回だけ承認する」動作にしている。
 */
import { AgentLoop } from "./loop.ts";
import { AnthropicModelClient } from "./model/anthropic.ts";
import { buildAnalyticsTools, savedReports } from "./tools.ts";

async function main() {
  let approvalsLeft = 1;

  const loop = new AgentLoop(new AnthropicModelClient(), {
    systemPrompt:
      "あなたは統合アナリティクスプラットフォームの調査エージェント Insight Scout です。" +
      "ツールでデータを確認し、根拠を添えて簡潔に日本語で報告してください。",
    tools: buildAnalyticsTools(),
    maxTurns: 12,
    retainReasoning: true,
    compaction: "summarize",
    contextLimitTokens: 30000,
    approvalPolicy: "on-request",
    approver: (call) => {
      const ok = approvalsLeft > 0;
      if (ok) approvalsLeft--;
      console.log(`  [承認ゲート] ${call.name} → ${ok ? "承認" : "却下"}`);
      return ok;
    },
    onEvent: (e) => {
      switch (e.type) {
        case "task_started":
          console.log(`▶ タスク開始: ${e.task}`);
          break;
        case "turn_started":
          console.log(`─ ターン ${e.turn}`);
          break;
        case "tool_call":
          console.log(`  🔧 ${e.call.name}(${JSON.stringify(e.call.input)})`);
          break;
        case "tool_result":
          console.log(
            `  ${e.result.isError ? "⚠️" : "✔"} ${e.result.output.slice(0, 120)}`,
          );
          break;
        case "compaction":
          console.log(
            `  🗜 コンパクション: ${e.estTokensBefore} → ${e.estTokensAfter} tokens`,
          );
          break;
        case "assistant_message":
          console.log(`  💬 ${e.text}`);
          break;
        case "task_completed":
          console.log(`■ 終了: ${e.status}（${e.turns} ターン）`);
          break;
      }
    },
  });

  const result = await loop.run(
    "revenue メトリクスの直近30日を調査し、異常があれば原因の仮説を添えて" +
      "レポートとして保存してください。",
  );

  console.log("\n--- 実行結果 ---");
  console.log(`status: ${result.status}`);
  console.log(`最終回答: ${result.finalText ?? "(なし)"}`);
  if (savedReports.size > 0) {
    console.log("保存されたレポート:");
    savedReports.forEach((body, title) => {
      console.log(`  ■ ${title}\n${body}`);
    });
  }
}

main().catch((err) => {
  console.error("デモの実行に失敗しました:", err);
  console.error(
    "ヒント: ANTHROPIC_API_KEY を設定するか `ant auth login` を実行してください。",
  );
  process.exit(1);
});
