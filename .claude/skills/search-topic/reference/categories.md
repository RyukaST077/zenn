# 調査カテゴリ

`search-topic` の Step 1（範囲決め）/ Step 4（抽出）で使う分類。調査対象は以下のカテゴリに分ける。

> どのカテゴリでも「実行環境の制約」（`reference/evaluation.md` の AI Agent Executability）を必ず適用する。
> 特に 4. Database and BaaS / 5. Infra and Deployment のクラウド系は、`wrangler dev` や
> `supabase start` のように **ローカルCLI・Dockerで完結する範囲**のみ対象にする
> （手動サインアップ・課金キー・手動デプロイが要るものは除外）。

## 1. AI Developer Tools

AIを活用した開発支援ツール。

例:

* AIコーディングエージェント
* コードレビュー支援
* テスト生成
* ドキュメント生成
* リファクタリング支援
* プロンプト管理
* LLMアプリ開発フレームワーク
* ローカルLLM開発環境

## 2. Frontend

フロントエンド周辺の最新技術。

例:

* React周辺
* Next.js周辺
* Vue / Nuxt
* Svelte / SvelteKit
* Astro
* Remix
* Vite
* UIコンポーネントライブラリ
* CSSフレームワーク
* 状態管理
* フォームライブラリ
* テストツール

## 3. Backend

バックエンド周辺の最新技術。

例:

* Node.js
* Bun
* Deno
* Hono
* FastAPI
* Goフレームワーク
* Ruby on Rails周辺
* API設計
* GraphQL
* tRPC
* gRPC
* 認証・認可

## 4. Database and BaaS

個人開発や小規模検証で試しやすいデータ基盤。

例:

* Supabase
* Firebase
* PlanetScale
* Neon
* Turso
* Drizzle ORM
* Prisma
* Vector Database
* Redis系サービス
* Search as a Service

## 5. Infra and Deployment

新人でも検証しやすいインフラ・デプロイ技術。

例:

* Vercel
* Cloudflare Workers
* Cloudflare Pages
* Railway
* Render
* Fly.io
* Docker
* Docker Compose
* GitHub Actions
* Terraform入門
* OpenTelemetry入門

## 6. Testing and Quality

テスト・品質改善系の技術。

例:

* Playwright
* Vitest
* Storybook
* Chromatic
* Cypress
* Testing Library
* MSW
* Biome
* ESLint新機能
* Prettier周辺
* CIでの自動テスト

## 7. Productivity Tools

開発効率化ツール。

例:

* CLIツール
* タスクランナー
* モノレポ管理
* パッケージマネージャー
* ドキュメントツール
* APIクライアント
* ローカル開発環境
* エディタ拡張
