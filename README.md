# 統合アナリティクスプラットフォーム

## 概要

このプロジェクトは、BI（ビジネスインテリジェンス）、BA（ビジネスアナリティクス）、PA（予測分析）機能を統合した包括的なアナリティクスプラットフォームです。

## 主な機能

- 📊 **BIダッシュボード**: KPI監視とトレンド可視化
- 🔬 **BA作業台**: 仮説作成、仮定追跡、セグメント分析
- 🔮 **PA予測**: 時系列予測と高度な機械学習モデル
- 🔄 **学習サイクル**: 意思決定記録とROI分析
- 🌐 **リアルタイム監視**: WebSocket統合とAPI接続機能

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Express.js + TypeScript
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **データベース**: PostgreSQL (Neon) + Drizzle ORM
- **リアルタイム**: WebSocket + 外部API統合
- **機械学習**: ランダムフォレスト、ニューラルネットワーク、アンサンブル学習

## インストールと実行

```bash
npm install
npm run dev
```

外部連携 API とリアルタイム WebSocket を有効にするには、十分に長いランダムな
`REALTIME_API_TOKEN` をサーバー環境に設定してください。外部連携 API のクライアントは
`Authorization: Bearer <token>` ヘッダーを送信する必要があります。WebSocket クライアントは
同じ Bearer ヘッダー、またはブラウザでは `/realtime?token=<token>` を使用できます。
トークンが未設定の場合、これらの外部連携機能はフェイルクローズします。

## プロジェクト構造

- `client/` - React フロントエンドアプリケーション
- `server/` - Express.js バックエンドAPI
- `shared/` - 共通のスキーマと型定義
- `replit.md` - プロジェクト設定とアーキテクチャドキュメント

## ライセンス

MIT License
