/**
 * エージェントループ（ハーネス）本体。
 *
 * 一次ソースの教訓を 1 ループに凝縮している:
 *
 * 1. Codex as a platform / openai/codex:
 *    「タスクを理解し、コンテキストを維持し、ツールを呼び、進捗を公開し、
 *     失敗を処理し、必要なら承認を求め、有用な結果を返す」実行系がハーネス。
 *    → run() は bounded / observable / approval-aware / failure-tolerant。
 *
 * 2. ARC-AGI-3（2 設定でスコア 3 倍）:
 *    モデルを変えずにハーネスの 2 設定（推論の保持・コンパクション）を直した
 *    だけでスコアが 13.3% → 38.3%、出力トークンは 1/6 になった。
 *    → retainReasoning と compaction はこのループの一級設定であり、
 *      validate.ts で ON/OFF の挙動差を検証できる。
 */
import {
  compactBySummarize,
  compactByTruncate,
  estimateTokens,
} from "./compaction.ts";
import type {
  AgentConfig,
  AgentEvent,
  HistoryItem,
  ModelClient,
  ModelTurn,
  TaskResult,
  ToolCall,
  ToolImpl,
  ToolResult,
} from "./types.ts";

export class AgentLoop {
  private readonly model: ModelClient;
  private readonly cfg: Required<
    Pick<
      AgentConfig,
      | "maxTurns"
      | "retainReasoning"
      | "compaction"
      | "contextLimitTokens"
      | "keepRecentItems"
      | "pinnedFacts"
      | "approvalPolicy"
    >
  > &
    AgentConfig;
  private readonly toolsByName: Map<string, ToolImpl>;

  constructor(model: ModelClient, config: AgentConfig) {
    this.model = model;
    this.cfg = {
      maxTurns: 12,
      retainReasoning: true,
      compaction: "summarize",
      contextLimitTokens: 4000,
      keepRecentItems: 4,
      pinnedFacts: [],
      approvalPolicy: "on-request",
      ...config,
    };
    this.toolsByName = new Map(config.tools.map((t) => [t.spec.name, t]));
  }

  async run(task: string): Promise<TaskResult> {
    const events: AgentEvent[] = [];
    const emit = (e: AgentEvent) => {
      events.push(e);
      this.cfg.onEvent?.(e);
    };

    let history: HistoryItem[] = [{ kind: "user", text: task }];
    let finalText: string | undefined;
    let output: unknown;
    let status: TaskResult["status"] = "max_turns_exceeded";
    let turn = 0;

    emit({ type: "task_started", task });

    while (turn < this.cfg.maxTurns) {
      turn++;
      emit({ type: "turn_started", turn });

      // --- コンテキスト管理: モデル呼び出し前に上限を確認する ---
      history = await this.maybeCompact(history, turn, emit);

      const modelTurn = await this.model.complete({
        system: this.cfg.systemPrompt,
        history,
        tools: Array.from(this.toolsByName.values(), (t) => t.spec),
      });

      if (modelTurn.reasoning) {
        emit({ type: "model_reasoning", turn, text: modelTurn.reasoning });
      }
      if (modelTurn.text) {
        finalText = modelTurn.text;
        emit({ type: "assistant_message", turn, text: modelTurn.text });
      }

      // --- 推論の保持: 無効時は reasoning と生ブロックを捨てて保存する ---
      // （捨てるのが ARC-AGI-3 で問題になった挙動。既定では保持する）
      history.push({
        kind: "assistant",
        turn: this.cfg.retainReasoning
          ? modelTurn
          : this.stripReasoning(modelTurn),
      });

      if (modelTurn.done) {
        status = "completed";
        output = modelTurn.finalOutput;
        break;
      }

      if (modelTurn.toolCalls.length === 0) {
        // ツールも最終回答も無いターン。そのまま続行すると空転するため、
        // ハーネスから続行を促す（失敗処理の一種）。
        history.push({
          kind: "user",
          text: "（ハーネス）ツールを呼ぶか、done で最終回答を返してください。",
        });
        continue;
      }

      // --- ツール実行（並列呼び出しはすべて実行し、結果を 1 バッチで返す） ---
      const results: ToolResult[] = [];
      for (const call of modelTurn.toolCalls) {
        results.push(await this.executeTool(call, turn, emit));
      }
      history.push({ kind: "tool_results", results });
    }

    emit({ type: "task_completed", status, turns: turn });
    return { status, output, finalText, turns: turn, events, history };
  }

  /** 承認ゲートと失敗処理を含むツール実行 */
  private async executeTool(
    call: ToolCall,
    turn: number,
    emit: (e: AgentEvent) => void,
  ): Promise<ToolResult> {
    emit({ type: "tool_call", turn, call });

    const tool = this.toolsByName.get(call.name);
    if (!tool) {
      // 存在しないツール名はエラーとしてモデルに返し、ループは継続する
      const result: ToolResult = {
        callId: call.callId,
        name: call.name,
        output: `未知のツールです: ${call.name}`,
        isError: true,
      };
      emit({ type: "tool_result", turn, result });
      return result;
    }

    // --- 承認ゲート（Codex の approval modes に倣う） ---
    const needsApproval =
      this.cfg.approvalPolicy === "always" ||
      (this.cfg.approvalPolicy === "on-request" && tool.spec.requiresApproval);
    if (needsApproval) {
      emit({ type: "approval_requested", turn, call });
      const approved = this.cfg.approver ? await this.cfg.approver(call) : false;
      emit({ type: "approval_decided", turn, callId: call.callId, approved });
      if (!approved) {
        // 却下はクラッシュではなくエラー結果としてモデルに返す。
        // モデルは別の手段を選ぶか、承認無しでできる範囲で完了できる。
        const result: ToolResult = {
          callId: call.callId,
          name: call.name,
          output: `ユーザーが ${call.name} の実行を却下しました。別の方法を検討してください。`,
          isError: true,
        };
        emit({ type: "tool_result", turn, result });
        return result;
      }
    }

    // --- 失敗処理: 例外はループを止めず、エラー結果としてモデルに返す ---
    let result: ToolResult;
    try {
      const output = await tool.run(call.input);
      result = { callId: call.callId, name: call.name, output, isError: false };
    } catch (err) {
      result = {
        callId: call.callId,
        name: call.name,
        output: `ツール実行エラー: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
    emit({ type: "tool_result", turn, result });
    return result;
  }

  private stripReasoning(turn: ModelTurn): ModelTurn {
    const { reasoning: _reasoning, raw: _raw, ...rest } = turn;
    return { ...rest };
  }

  private async maybeCompact(
    history: HistoryItem[],
    turn: number,
    emit: (e: AgentEvent) => void,
  ): Promise<HistoryItem[]> {
    if (this.cfg.compaction === "off") return history;
    if (estimateTokens(history) <= this.cfg.contextLimitTokens) return history;

    const outcome =
      this.cfg.compaction === "summarize"
        ? await compactBySummarize(
            history,
            this.model,
            this.cfg.keepRecentItems,
            this.cfg.pinnedFacts,
          )
        : compactByTruncate(history, this.cfg.contextLimitTokens);

    if (outcome.replacedItems > 0) {
      emit({
        type: "compaction",
        turn,
        strategy: this.cfg.compaction,
        estTokensBefore: outcome.estTokensBefore,
        estTokensAfter: outcome.estTokensAfter,
        replacedItems: outcome.replacedItems,
      });
    }
    return outcome.history;
  }
}
