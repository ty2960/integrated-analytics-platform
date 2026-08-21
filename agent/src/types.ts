/**
 * エージェントループ・ハーネスのコア型定義。
 *
 * ハーネス（エージェントループ）はモデル非依存で設計する。
 * これは Codex ハーネスの構成（タスク理解 / コンテキスト維持 / ツール呼び出し /
 * 進捗の公開 / 失敗処理 / 承認要求 / 構造化された結果の返却）に倣ったもの。
 * モデルへの接続は ModelClient インターフェースで差し替える。
 */

// ---------------------------------------------------------------------------
// ツール
// ---------------------------------------------------------------------------

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema (object) */
  inputSchema: Record<string, unknown>;
  /** true のとき、承認ポリシー "on-request" 以上で人間の承認を要求する */
  requiresApproval?: boolean;
}

export interface ToolImpl {
  spec: ToolSpec;
  run(input: Record<string, unknown>): Promise<string> | string;
}

export interface ToolCall {
  callId: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  output: string;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// モデルとの往復
// ---------------------------------------------------------------------------

/** モデルが 1 ターンで返すもの */
export interface ModelTurn {
  /**
   * このターンの推論（reasoning）。ハーネス設定 retainReasoning が有効なら
   * 履歴に保存され、次のリクエストでモデルに戻される（ARC-AGI-3 の教訓 1:
   * 行動のたびに推論を破棄するハーネスはモデルの性能を大きく損なう）。
   */
  reasoning?: string;
  /** ユーザーに見せるテキスト */
  text?: string;
  /** 実行してほしいツール呼び出し（並列呼び出し可。空配列なら無し） */
  toolCalls: ToolCall[];
  /** true ならタスク完了（最終回答） */
  done: boolean;
  /** 完了時の構造化出力（codex exec が構造化出力を返すのに倣う） */
  finalOutput?: unknown;
  /**
   * プロバイダ固有の生コンテンツブロック。同一モデルへ逐語的にエコーバック
   * するために保持する（Anthropic API の thinking ブロック等）。
   * retainReasoning が無効のとき、ハーネスはこれを破棄する。
   */
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// 会話履歴
// ---------------------------------------------------------------------------

export type HistoryItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; turn: ModelTurn }
  | { kind: "tool_results"; results: ToolResult[] }
  /** コンパクション（要約）で古い履歴を置き換えた痕跡 */
  | { kind: "compaction"; summary: string; replacedItems: number };

export interface ModelRequest {
  system: string;
  history: HistoryItem[];
  tools: ToolSpec[];
}

/** モデル接続の抽象。Mock（決定論的検証用）と Anthropic 実装を差し替える */
export interface ModelClient {
  complete(req: ModelRequest): Promise<ModelTurn>;
  /** コンパクション時に古い履歴を要約する */
  summarize(items: HistoryItem[]): Promise<string>;
}

// ---------------------------------------------------------------------------
// 承認（Codex の approval modes に倣う）
// ---------------------------------------------------------------------------

/**
 * - "auto":       承認を求めない（サンドボックス内での全自動実行を想定）
 * - "on-request": requiresApproval が付いたツールだけ承認を求める
 * - "always":     すべてのツール呼び出しに承認を求める
 */
export type ApprovalPolicy = "auto" | "on-request" | "always";

export type Approver = (call: ToolCall) => Promise<boolean> | boolean;

// ---------------------------------------------------------------------------
// コンテキスト管理（ARC-AGI-3 の教訓 2）
// ---------------------------------------------------------------------------

/**
 * - "summarize": 上限接近時、古い履歴をモデル要約 + 固定事実で置き換える（推奨）
 * - "truncate":  最古のメッセージから黙って捨てる（ARC-AGI-3 で問題になった
 *                アンチパターン。比較検証のために意図的に残している）
 * - "off":       何もしない
 */
export type CompactionStrategy = "summarize" | "truncate" | "off";

// ---------------------------------------------------------------------------
// イベントストリーム（codex app-server がイベントを流すのに倣う）
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "task_started"; task: string }
  | { type: "turn_started"; turn: number }
  | { type: "model_reasoning"; turn: number; text: string }
  | { type: "assistant_message"; turn: number; text: string }
  | { type: "tool_call"; turn: number; call: ToolCall }
  | { type: "approval_requested"; turn: number; call: ToolCall }
  | { type: "approval_decided"; turn: number; callId: string; approved: boolean }
  | { type: "tool_result"; turn: number; result: ToolResult }
  | {
      type: "compaction";
      turn: number;
      strategy: CompactionStrategy;
      estTokensBefore: number;
      estTokensAfter: number;
      replacedItems: number;
    }
  | { type: "task_completed"; status: TaskStatus; turns: number };

// ---------------------------------------------------------------------------
// 実行結果（codex exec が構造化出力で終わるのに倣う）
// ---------------------------------------------------------------------------

export type TaskStatus = "completed" | "max_turns_exceeded" | "failed";

export interface TaskResult {
  status: TaskStatus;
  /** モデルが done 時に返した構造化出力 */
  output?: unknown;
  /** 最後のアシスタントテキスト */
  finalText?: string;
  turns: number;
  events: AgentEvent[];
  history: HistoryItem[];
}

// ---------------------------------------------------------------------------
// ハーネス設定
// ---------------------------------------------------------------------------

export interface AgentConfig {
  systemPrompt: string;
  tools: ToolImpl[];
  /** 無限ループ防止の上限ターン数（bounded execution） */
  maxTurns?: number;
  /** 推論を履歴に保持して次リクエストへ戻すか（既定: true） */
  retainReasoning?: boolean;
  /** コンテキスト管理戦略（既定: "summarize"） */
  compaction?: CompactionStrategy;
  /** この推定トークン数を超えたらコンパクション発動（既定: 4000） */
  contextLimitTokens?: number;
  /** コンパクション時に必ず残す直近アイテム数（既定: 4） */
  keepRecentItems?: number;
  /** コンパクション後も逐語的に保持する重要事実 */
  pinnedFacts?: string[];
  approvalPolicy?: ApprovalPolicy;
  approver?: Approver;
  onEvent?: (event: AgentEvent) => void;
}
