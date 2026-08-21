/**
 * コンテキスト管理（コンパクション）。
 *
 * ARC-AGI-3 の教訓 2:
 * 「コンテキスト超過時に最古のメッセージから黙って切り捨てる」ハーネスは、
 * 序盤に得た重要な事実（ルール・発見・決定）を失い、モデルは同じ探索を
 * 何度も繰り返す。要約（コンパクション）で置き換えると、スコアが向上した
 * だけでなく出力トークンが 1/6 になった。
 *
 * ここでは両方の戦略を実装している。"truncate" は比較検証用のアンチパターン。
 */
import type { HistoryItem, ModelClient } from "./types.ts";

/** ざっくりしたトークン推定（≒ 4 文字 / トークン） */
export function estimateTokens(items: HistoryItem[]): number {
  return Math.ceil(JSON.stringify(items).length / 4);
}

export interface CompactionOutcome {
  history: HistoryItem[];
  replacedItems: number;
  estTokensBefore: number;
  estTokensAfter: number;
}

/**
 * 古い履歴（先頭の user タスクと直近 keepRecentItems 件を除く）を
 * 「モデルによる要約 + 固定事実」の 1 アイテムに置き換える。
 */
export async function compactBySummarize(
  history: HistoryItem[],
  model: ModelClient,
  keepRecentItems: number,
  pinnedFacts: string[],
): Promise<CompactionOutcome> {
  const estTokensBefore = estimateTokens(history);
  // 先頭のタスク指示は常に残す
  const head = history.slice(0, 1);
  const tail = history.slice(-keepRecentItems);
  const middle = history.slice(1, history.length - keepRecentItems);
  if (middle.length === 0) {
    return { history, replacedItems: 0, estTokensBefore, estTokensAfter: estTokensBefore };
  }
  const summary = await model.summarize(middle);
  const pinned =
    pinnedFacts.length > 0
      ? `\n【固定事実（逐語的に保持）】\n- ${pinnedFacts.join("\n- ")}`
      : "";
  const compacted: HistoryItem = {
    kind: "compaction",
    summary: `${summary}${pinned}`,
    replacedItems: middle.length,
  };
  const next = [...head, compacted, ...tail];
  return {
    history: next,
    replacedItems: middle.length,
    estTokensBefore,
    estTokensAfter: estimateTokens(next),
  };
}

/**
 * アンチパターン: 上限を下回るまで最古のアイテムから黙って捨てる。
 * （ツール呼び出しと結果の対応が壊れないよう、assistant と直後の
 *  tool_results はペアで捨てる）
 */
export function compactByTruncate(
  history: HistoryItem[],
  contextLimitTokens: number,
): CompactionOutcome {
  const estTokensBefore = estimateTokens(history);
  const next = [...history];
  let dropped = 0;
  while (next.length > 2 && estimateTokens(next) > contextLimitTokens) {
    const removed = next.splice(0, 1)[0];
    dropped++;
    if (
      removed.kind === "assistant" &&
      next.length > 0 &&
      next[0].kind === "tool_results"
    ) {
      next.splice(0, 1);
      dropped++;
    }
  }
  return {
    history: next,
    replacedItems: dropped,
    estTokensBefore,
    estTokensAfter: estimateTokens(next),
  };
}
