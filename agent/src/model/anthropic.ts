/**
 * Claude API（Anthropic SDK）向けの ModelClient アダプタ。
 *
 * ハーネス側の設計（推論の保持・コンパクション・承認・失敗処理）は
 * モデル非依存だが、実モデルに接続するとそれぞれが実際の API 機能に対応する:
 *
 * - retainReasoning → 応答の生コンテンツ（thinking ブロックを含む）を
 *   ModelTurn.raw に保持し、次のリクエストで逐語的にエコーバックする。
 *   ハーネスが raw を破棄した場合（retainReasoning: false）は
 *   テキストとツール呼び出しだけを再構成して送る —— これが ARC-AGI-3 で
 *   スコアを 1/3 にしていた「推論を毎回捨てる」挙動の再現になる。
 * - ツール呼び出し → tool_use / tool_result ブロックの往復。
 *   並列呼び出しの結果は 1 つの user メッセージにまとめて返す。
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  HistoryItem,
  ModelClient,
  ModelRequest,
  ModelTurn,
  ToolResult,
} from "../types.ts";

const MODEL = "claude-opus-5";

export class AnthropicModelClient implements ModelClient {
  private readonly client: Anthropic;

  constructor(client?: Anthropic) {
    // 認証は SDK の既定解決（ANTHROPIC_API_KEY / ant auth プロファイル等）に任せる
    this.client = client ?? new Anthropic();
  }

  async complete(req: ModelRequest): Promise<ModelTurn> {
    const response = await this.client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // ポリシー起因の拒否時に同一リクエスト内でフォールバックさせる
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: req.system,
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Beta.BetaTool["input_schema"],
      })),
      messages: toMessages(req.history),
    });

    if (response.stop_reason === "refusal") {
      return {
        text: "（モデルがこのリクエストを拒否しました）",
        toolCalls: [],
        done: true,
      };
    }

    let reasoning: string | undefined;
    let text: string | undefined;
    const toolCalls: ModelTurn["toolCalls"] = [];
    for (const block of response.content) {
      if (block.type === "thinking" && block.thinking) {
        reasoning = (reasoning ?? "") + block.thinking;
      } else if (block.type === "text") {
        text = (text ?? "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          callId: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    const done = response.stop_reason === "end_turn";
    return {
      reasoning,
      text,
      toolCalls,
      done,
      finalOutput: done ? text : undefined,
      // thinking ブロックを含む全コンテンツを保持 → 次ターンで逐語エコーバック
      raw: response.content,
    };
  }

  async summarize(items: HistoryItem[]): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content:
            "以下はエージェントの作業履歴です。後続の作業に必要な事実・決定・" +
            "未解決事項を落とさないよう、簡潔に要約してください。\n\n" +
            JSON.stringify(items, null, 2),
        },
      ],
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return textBlock?.text ?? "（要約に失敗しました）";
  }
}

function toMessages(history: HistoryItem[]): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const item of history) {
    switch (item.kind) {
      case "user":
        messages.push({ role: "user", content: item.text });
        break;
      case "compaction":
        messages.push({
          role: "user",
          content: `【これまでの作業の要約（コンパクション済み）】\n${item.summary}`,
        });
        break;
      case "assistant": {
        // raw があれば逐語エコーバック（thinking ブロック含む）。
        // 無ければテキスト + tool_use のみ再構成（= 推論は失われる）。
        const content = item.turn.raw
          ? (item.turn.raw as Anthropic.Beta.BetaContentBlockParam[])
          : reconstruct(item.turn);
        messages.push({ role: "assistant", content });
        break;
      }
      case "tool_results":
        messages.push({
          role: "user",
          content: item.results.map(
            (r: ToolResult): Anthropic.Beta.BetaToolResultBlockParam => ({
              type: "tool_result",
              tool_use_id: r.callId,
              content: r.output,
              is_error: r.isError,
            }),
          ),
        });
        break;
    }
  }
  return messages;
}

function reconstruct(turn: ModelTurn): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (turn.text) blocks.push({ type: "text", text: turn.text });
  for (const call of turn.toolCalls) {
    blocks.push({
      type: "tool_use",
      id: call.callId,
      name: call.name,
      input: call.input,
    });
  }
  if (blocks.length === 0) blocks.push({ type: "text", text: "（続行）" });
  return blocks;
}
