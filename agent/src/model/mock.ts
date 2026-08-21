/**
 * 決定論的なスクリプト駆動モデル（検証用）。
 *
 * ARC-AGI-3 の一次ソースが示した核心は「ハーネスの品質はモデルと独立に
 * 評価・改善できる（そして効果が非常に大きい）」ということ。
 * このモッククライアントは、APIキー無し・ネットワーク無しで
 * エージェントループそのものを検証するために存在する。
 *
 * ハーネスから受け取った ModelRequest をすべて記録するため、
 * 「前ターンの推論が次のリクエストに含まれているか」等をアサートできる。
 */
import type {
  HistoryItem,
  ModelClient,
  ModelRequest,
  ModelTurn,
} from "../types.ts";

export type ScriptStep = ModelTurn | ((req: ModelRequest) => ModelTurn);

export class ScriptedModelClient implements ModelClient {
  /** ハーネスが送ってきたリクエストの記録（ディープコピー） */
  readonly requests: ModelRequest[] = [];
  readonly summarizeCalls: HistoryItem[][] = [];
  private step = 0;

  constructor(private readonly script: ScriptStep[]) {}

  async complete(req: ModelRequest): Promise<ModelTurn> {
    this.requests.push(structuredClone(req));
    const entry = this.script[Math.min(this.step, this.script.length - 1)];
    this.step++;
    return typeof entry === "function" ? entry(req) : structuredClone(entry);
  }

  async summarize(items: HistoryItem[]): Promise<string> {
    this.summarizeCalls.push(structuredClone(items));
    const toolNames = new Set<string>();
    for (const item of items) {
      if (item.kind === "assistant") {
        for (const c of item.turn.toolCalls) toolNames.add(c.name);
      }
    }
    return `（要約）${items.length} 件の履歴を圧縮。実行済みツール: ${
      Array.from(toolNames).join(", ") || "なし"
    }`;
  }
}

/** ツール呼び出しステップを簡潔に書くためのヘルパー */
export function callTool(
  name: string,
  input: Record<string, unknown>,
  opts: { reasoning?: string; callId?: string } = {},
): ModelTurn {
  return {
    reasoning: opts.reasoning,
    toolCalls: [
      { callId: opts.callId ?? `call_${name}_${Math.abs(hash(name + JSON.stringify(input)))}`, name, input },
    ],
    done: false,
  };
}

export function finish(text: string, finalOutput?: unknown, reasoning?: string): ModelTurn {
  return { reasoning, text, toolCalls: [], done: true, finalOutput };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
