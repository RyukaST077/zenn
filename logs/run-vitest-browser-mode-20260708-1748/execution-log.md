# 検証ログ: Vitest 4 Browser Mode で `toMatchScreenshot`（ビジュアルリグレッション）を初めて書く

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-vitest-browser-mode-20260708-1746.md`
- 出典レポート: `research/search-topic-20260708-1741.md`
- 対象技術: Vitest 4 Browser Mode + `@vitest/browser-playwright`（Playwright provider）+ `toMatchScreenshot` / `vitest-browser-react`
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-08 17:48〜17:57 / 見積もり 約4.25h → 実測 約9分（AI単独・非対話の値。記事にそのまま書かない） <!-- draft-article で人の粒度に直す or 省く -->
- 実行環境: OS macOS 26.5 (build 25F71, platform=darwin) / Node v22.17.0 / pnpm 10.13.1 / npm 10.9.2
- 採用した撤退ライン: 既定（1タスク30分で進まなければ記録してスキップ or 等価手段へ）。今回は撤退なし。
- 判断方針: 引数は対象タスクファイルのみ指定。時間・スキルレベルは未指定のため対象タスクの前提（新人 / 半日）を採用。テーマ置換なしで原案どおり実行可能だった。

## 結果サマリー

- 完了条件の判定: **達成**（緑起動・ベースライン生成/コミット・CSS改変で赤+差分画像 の3点すべて客観確認）
- 作ったもの: Vite(React+TS)最小プロジェクトに Vitest 4 Browser Mode を組み込み、レンダリングテスト1本＋`toMatchScreenshot`ビジュアルリグレッションテスト1本。`workspace/my-app/`
- スクショ: 5枚（`screenshots/`）
- 詰まった点: 5件（うち解決 5 / 未解決・撤退 0）
- knowledge 記録: 2件
  - `knowledge/2026-07-08-vitest-browser-react-render-must-await.md`
  - `knowledge/2026-07-08-vitest-tomatchscreenshot-allowedmismatch-nesting.md`

## 完了条件の検証

対象タスクの「できたと言える完了条件」を1つずつ客観的に検証した結果。

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | `npx vitest run --browser.headless` が緑で終了（レンダリング＋2回目のスクショ比較） | 達成 | commands.log `17:56 [FINAL]`：`Test Files 1 passed / Tests 2 passed / exit=0` |
| 2 | `__screenshots__/` にベースライン画像 `*-chromium-<platform>.png` が生成・コミット可能 | 達成 | `src/__screenshots__/Card.test.tsx/card-chromium-darwin.png`（platform=darwin）。screenshots/02-baseline-card.png |
| 3 | CSSを意図的に変えると赤で落ち、expected/actual/diff 画像が出る | 達成 | commands.log `17:53`：`2088 pixels (ratio 0.12) differ.` / screenshots/03-expected・04-actual・05-diff |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり30分 → 実測 数分）

- [x] v3→v4変更点（provider が `@vitest/browser-playwright` に分離）と `toMatchScreenshot` の初回失敗仕様を把握
  - 効いた対処 / 試したこと: 対象タスクファイルの裏取り済み一次情報＋`knowledge/` 検索（`search-knowledge.sh "vitest" "playwright"` は該当なし）で確認。実挙動はフェーズ2〜3で裏取りした。
  - 記事に書きたい気づき: 「provider が別パッケージ化」「初回は必ず落ちる」を事前に知っていたので、後述のエラーで慌てずに済んだ。逆に知らなければ確実にハマる2大ポイント。

### フェーズ2: 環境構築（見積もり45分 → 実測 数分）

- [x] `pnpm create vite my-app --template react-ts` → `pnpm install`
  - 実行したコマンド:
    ```bash
    pnpm create vite my-app --template react-ts
    pnpm install
    ```
  - 出力（要点）: React 19.2.7 / Vite 8.1.3 / TypeScript 6.0.3 の最小プロジェクト。`exit=0`。
- [x] Vitest 4 一式導入 + Chromium バイナリ
  - 実行したコマンド:
    ```bash
    pnpm add -D vitest@4 @vitest/browser-playwright vitest-browser-react
    npx playwright install chromium
    ```
  - 出力（実バージョン）: `@vitest/browser-playwright 4.1.10 / vitest 4.1.10 / vitest-browser-react 2.2.0`。
    `playwright install chromium` は出力なし・`exit=0`（Chromium は `~/Library/Caches/ms-playwright/` に既存）。
  - つまずいた理由・分かっていなかった前提: `playwright` 本体は `@vitest/browser-playwright` の推移的依存としては入るが、pnpm は**直接依存しか `node_modules` 直下に symlink しない**。後述のスクショ用スクリプトが `import 'playwright'` を解決できず、`pnpm add -D playwright@1.61.1` で直接依存に昇格して解決した。
  - 既存技術と比べて感じた違い: v3の記事の `@vitest/browser` だけでは動かない。providerパッケージが分離した点が最大の破壊的変更。
- [x] `vitest.config.ts` に Browser Mode を設定し「テスト0件でも起動」を確認
  - 使った config（最終形）:
    ```ts
    // vitest.config.ts
    import { defineConfig } from 'vitest/config'
    import react from '@vitejs/plugin-react'
    import { playwright } from '@vitest/browser-playwright'

    export default defineConfig({
      plugins: [react()],
      test: {
        exclude: ['**/node_modules/**', '**/*.jsdom.test.tsx'],
        browser: {
          enabled: true,
          provider: playwright(),
          headless: true,
          instances: [{ browser: 'chromium' }],
        },
      },
    })
    ```
  - 出力: 0件時は `No test files found, exiting with code 1`（chromium は起動する）。設定自体は正常。
  - **詰まった点（意図的に再現）**: v3の書き方 `provider: 'playwright'`（文字列）にすると起動時エラー：
    ```
    ⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
    TypeError: The `browser.provider` configuration was changed to accept a factory instead of a string. Add an import of "playwright" from "@vitest/browser-playwright" instead. See: https://vitest.dev/config/browser/provider
    ```
  - 記事に書きたい気づき: エラーメッセージが「factory に変わった。`@vitest/browser-playwright` から import しろ」と正確に案内してくれる。破壊的変更のお手本のような誘導。
  - スクショ: screenshots/01-vite-initial.png（Vite初期表示。dev server を `--port 5199` で起動し Playwright で撮影）

### フェーズ3: 実装・検証【本編】（見積もり120分 → 実測 数分）

- [x] テスト対象コンポーネント `src/Card.tsx`（タイトル＋本文＋青いボーダー、`data-testid="card"`）を作成
  - なぜこの形か: ボーダー色/太さが「見た目の差分」として分かりやすく、1px改変で差分画像に現れやすいから。
- [x] レンダリングテスト（テキスト表示）を1本書いて緑にする
  - **詰まった点**: 最初 `const screen = render(<Card ... />)` と同期で受けたら赤：
    ```
    FAIL  |chromium| src/Card.test.tsx > Card renders title and body text
    TypeError: screen.getByText is not a function
     ❯ src/Card.test.tsx:8:30
    ```
  - 効いた対処: `vitest-browser-react` v2 の `render` は `Promise<RenderResult>` を返す。`const screen = await render(...)` で解決。→ `Tests 2 passed`。knowledge に記録。
  - 既存技術と比べて感じた違い: React Testing Library の `render` は同期だったので、その感覚のままだとハマる。
- [x] `toMatchScreenshot('card')` を追加し、**初回実行がベースライン作成で失敗**するのを確認
  - 出力（全文の要点）:
    ```
    FAIL  |chromium| src/Card.test.tsx > Card matches the visual baseline
    No existing reference screenshot found; a new one was created. Review it before running tests again.
    Reference screenshot:
      .../src/__screenshots__/Card.test.tsx/card-chromium-darwin.png
    ```
  - **詰まった点（ボーナス）**: 同時に `@vitest/browser/context` が **DEPRECATED** 警告。`import { page } from 'vitest/browser'` に変更した。
  - スクショ: screenshots/02-baseline-card.png（生成された青ボーダーのベースライン）
  - 記事に書きたい気づき: 「初回は必ず落ちる」を知らないと「壊れた」と勘違いする。ファイル名に `-darwin`（platform）が入るのが後のCI差分の伏線。
- [x] 生成画像を確認して再実行 → 緑（ベースライン一致）
  - 出力: `Tests 2 passed (2) / exit=0`（deprecation 警告も消えた）。
- [x] CSSを意図的に変更（ボーダー色 `#3b82f6`→`#ef4444`）→ 赤 + 差分画像
  - 出力（全文の要点）:
    ```
    FAIL  |chromium| src/Card.test.tsx > Card matches the visual baseline
    Screenshot does not match the stored reference.
    2088 pixels (ratio 0.12) differ.
    Actual screenshot:
      .../.vitest-attachments/src/Card.test.tsx/card-actual-chromium-darwin.png
    Diff image:
      .../.vitest-attachments/src/Card.test.tsx/card-diff-chromium-darwin.png
    ```
  - つまずいた理由・前提: expected は `__screenshots__/` に、actual/diff は `.vitest-attachments/` に出る（置き場が別）。
  - スクショ: screenshots/03-diff-expected.png / 04-diff-actual.png / 05-diff-diff.png（pixelmatch の差分。変わったボーダーが強調表示）

### フェーズ4: 深掘り・比較（見積もり30分 → 実測 数分）

- [x] `allowedMismatchedPixelRatio` で「どこまでの差なら緑にできるか」を1パターン
  - **詰まった点**: `toMatchScreenshot('card', { allowedMismatchedPixelRatio: 0.2 })` と**トップレベル**に書いたら、ratio 0.12（<0.2）なのに赤のまま：
    ```
    Screenshot does not match the stored reference.
    2088 pixels (ratio 0.12) differ.
    ```
  - 効いた対処: 型定義（`ScreenshotMatcherOptions`）を読むと、pixelmatch のパラメータは `comparatorOptions` 配下にネストする設計。トップレベルの同名キーは黙って無視される。正しい書き方で同じ差分が緑に：
    ```ts
    await expect(page.getByTestId('card')).toMatchScreenshot('card', {
      comparatorName: 'pixelmatch',
      comparatorOptions: { allowedMismatchedPixelRatio: 0.2 },
    })
    // → Tests 2 passed (2) / exit=0
    ```
  - knowledge に記録。実務での使い分け: アンチエイリアス等の微小差だけ許容したいときに使う。安易に上げると本物のリグレッションも見逃す諸刃。
- [x] JSDOM 比較（`environment: 'jsdom'`、別config `vitest.jsdom.config.ts`）
  - 書いたテスト: `src/Card.jsdom.test.tsx`（テキスト表示は検証可 / `getBoundingClientRect()` は 0）
  - **詰まった点**: `@testing-library/react` は明示 cleanup が要る。怠ると2テスト目で `Found multiple elements by: [data-testid="card"]` で落ちた（ブラウザモードの `render` は自動クリーンアップ）。`afterEach(() => cleanup())` で解決。
  - 出力（最終）: `Tests 2 passed (2)`。`rect.width===0 / rect.height===0` が通り、**JSDOM には実レイアウト/ピクセルが無い＝ビジュアルリグレッション不可**を客観確認。
  - 既存技術と比べて感じた違い: JSDOMは「DOM構造とテキスト」までは見られるが「見た目（レイアウト・色・描画）」は原理的に見られない。`toMatchScreenshot` は実ブラウザ描画が前提。

### フェーズ5: 振り返り・記事化準備

- [x] 詰まった点の棚卸し（下表）／記事への写像を実績で埋めた（後述）。撮り直しが要る図なし。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `provider: 'playwright'`（文字列）で起動エラー | v4で provider が factory 方式（別パッケージ `@vitest/browser-playwright`）に変更 | `import { playwright }` して `provider: playwright()` | 即 | 解決 | 冒頭の「古い記事が動かない」破壊的変更あるあると、親切なエラー誘導 |
| 2 | `screen.getByText is not a function` | `vitest-browser-react` v2 の `render` は `Promise` を返す | `const screen = await render(...)` | 数分 | 解決 | RTLの同期renderの感覚だとハマる。knowledge化 |
| 3 | 初回スクショが必ず失敗「No existing reference screenshot found」 | 初回はベースライン生成＋わざと失敗する仕様 | メッセージを読み画像を確認→再実行で緑 | 即 | 解決（想定どおり） | 「落ちて正しい」を新人視点で解説する山場 |
| 4 | `allowedMismatchedPixelRatio` をトップレベルに書くと無視され赤のまま | pixelmatch のオプションは `comparatorOptions` 配下にネストする設計 | `comparatorName:'pixelmatch', comparatorOptions:{...}` | 数分 | 解決 | 型を読まないと気づけない「黙って無視」系の罠。knowledge化 |
| 5 | JSDOM比較で `Found multiple elements`（要素重複） | `@testing-library/react` は明示cleanupが必要（browser modeは自動） | `afterEach(() => cleanup())` | 即 | 解決 | ブラウザモード vs JSDOM の運用差の実例 |

補足（対象タスクの詰まりポイント表との差分）:
- 予測どおり: #1 provider別パッケージ / #3 初回失敗仕様。
- 予測外で新規: #2 renderのawait漏れ / #4 allowedMismatchedのネスト / #5 JSDOMのcleanup。いずれも「v3記事・RTL経験」からの類推でハマる系。
- `@vitest/browser/context` の DEPRECATED 警告（→ `vitest/browser`）も予測外の小ハマり。

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-vite-initial.png | Vite(React-TS)初期表示（環境構築の起点） | 4. 環境構築 |
| screenshots/02-baseline-card.png | 生成された青ボーダーCardのベースライン画像 | 5. 実際に書いたテスト |
| screenshots/03-diff-expected.png | 比較の expected（元の青ボーダー） | 7. 触ってみて分かったこと |
| screenshots/04-diff-actual.png | 比較の actual（赤ボーダーに改変後） | 7. 触ってみて分かったこと |
| screenshots/05-diff-diff.png | pixelmatch の diff（変わった箇所を強調） | 6. 詰まった点 / 7. 触ってみて分かったこと |

## 記事への写像（実績で埋める）

※ ここでは素材を指し示すだけ。本文は書かない。

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機 | JSDOMしか知らなかった新人がブラウザモードを試す動機 |
| 2. なぜブラウザモードを試すのか | フェーズ1／フェーズ4のJSDOM比較 | 実ブラウザ描画でしか見た目は検証できない（rect.width=0の実測） |
| 3. 事前に調べたこと（v3との違い/provider別パッケージ化） | フェーズ1、詰まった点#1 | v4破壊的変更・初回失敗仕様 |
| 4. 環境構築 | フェーズ2ログ / screenshots/01 | 導入コマンド・実バージョン(vitest 4.1.10 等)・playwright install・config全文 |
| 5. 実際に書いたテスト | フェーズ3ログ / Card.tsx・Card.test.tsx / screenshots/02 | コンポーネントとレンダリング/スクショ両テスト |
| 6. 詰まった点 | 「詰まった点」表 / エラー全文 | provider文字列・render await漏れ・初回失敗・allowedMismatchネスト・DEPRECATED |
| 7. 触ってみて分かったこと | フェーズ3〜4 / screenshots/03-05 | 「色を変えたら2088px(ratio0.12)落ちる」体験・差分3枚・閾値の効かせ方 |
| 8. JSDOMと比べて感じたこと | フェーズ4 / Card.jsdom.test.tsx | 実DOM描画 vs 擬似DOM、rect=0、cleanup差 |
| 9. どんな人に向くか | フェーズ5棚卸し | 見た目の回帰を守りたいUIチーム。ただし環境差に注意 |
| 10. まとめ | 結果サマリー | 次: CI/Docker化（画像名 -darwin が示すOS依存） |

## 未達・撤退した項目

- なし（完了条件3点すべて達成。撤退・未解決なし）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム / 主要ライブラリ:
  - macOS 26.5（platform=darwin。スクショ名に入る＝OS依存の要注意点）
  - Node v22.17.0 / pnpm 10.13.1
  - vitest 4.1.10 / @vitest/browser-playwright 4.1.10 / vitest-browser-react 2.2.0 / playwright 1.61.1
  - React 19.2.7 / Vite 8.1.3 / TypeScript 6.0.3
  - （JSDOM比較用）jsdom 29.1.1 / @testing-library/react 16.3.2
- 実行コマンドの並び（最短の再現手順）:
  ```bash
  pnpm create vite my-app --template react-ts
  cd my-app && pnpm install
  pnpm add -D vitest@4 @vitest/browser-playwright vitest-browser-react
  npx playwright install chromium
  # vitest.config.ts を作成（provider: playwright() を import して渡す）
  # src/Card.tsx / src/Card.test.tsx を作成（render は await する）
  npx vitest run --browser.headless   # 初回=ベースライン生成で失敗（正常）
  npx vitest run --browser.headless   # 2回目=緑
  # CSSを1px/色だけ変えて再実行 → 赤 + expected/actual/diff
  ```
- 注意点:
  - `provider` は文字列でなく `playwright()`（factory）を渡す。
  - `render`（vitest-browser-react）は `await` する。
  - `toMatchScreenshot` の初回は必ず失敗（ベースライン生成）。再実行で比較。
  - 差分許容は `comparatorOptions.allowedMismatchedPixelRatio`（トップレベルは無視される）。
  - スクショ名に platform（`-darwin`）が入る＝別OS/CIでは一致しないので Docker等で環境固定が前提。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する（`/draft-article`）
- [ ] スクショを Zenn 用に `images/<slug>/` へ配置する
- [ ] 完了条件・詰まった点（特に #2/#4 の新規ハマり）・JSDOM比較を本文に落とす
