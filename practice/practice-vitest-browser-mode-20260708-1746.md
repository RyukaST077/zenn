# 実践タスク: Vitest 4のブラウザモードで「見た目が崩れたら落ちる」テストを新人が初めて書いてみた（toMatchScreenshot）

## このタスクの前提

- 出典レポート: `research/search-topic-20260708-1741.md`
- 元テーマ: テーマ1（優先度: 高 / レポートの「最初に試すべき1本」）
- 対象技術: Vitest 4 Browser Mode + Playwright provider + `toMatchScreenshot`（ビジュアルリグレッション）
- 記事の方向性（記事タイプ）: 「試してみた」「初めて触った」「詰まった点まとめ」＋検証ログ
- 想定筆者 / 想定読者: Web系の新人エンジニア（Vitest/Jestは触ったが Browser Mode・ビジュアルリグレッションは未経験）/ 新人〜実務2年目
- 検証に使える想定時間: 半日（約3〜4時間）※引数指定なしのためデフォルト採用
- 判断方針: 引数はレポートパスのみ指定。テーマ・時間・スキルレベルは未指定のため、レポートの「最初に試すべき1本」＋デフォルト前提（新人 / 半日）を採用
- 実行環境の担保: すべて npm/CLI・コード・Playwright ヘッドレスChromiumで完結。認証・課金・人手サインアップ・手動デプロイなし。完了確認は `vitest` の緑/赤の終了コードと、生成された `__screenshots__/*.png`・差分画像を Playwright/ファイル存在チェックで確認する。**テーマの置き換えは不要**（原案どおり実行可能）

> 裏取り済み一次情報（2026-07-08 時点 / Vitest 公式 docs）
> - 現行バージョン: **Vitest v4.1.9**
> - provider は別パッケージ: **`@vitest/browser-playwright`**（v3の `@vitest/browser` から変更）
> - config は `import { playwright } from '@vitest/browser-playwright'` して `provider: playwright()` を渡す
> - スクショ保存先: テストファイル隣の `__screenshots__/` に `<name>-<browser>-<platform>.png`（例 `hero-chromium-darwin.png`）。**要コミット**
> - 初回実行は「参照が無いので作成した」と言って**必ず失敗**する仕様。レビュー後に再実行で比較
> - ベースライン更新は `vitest --update`
> - 比較は既定 `pixelmatch`、`threshold` / `allowedMismatchedPixelRatio` で調整
> - 公式が「ビジュアルテストは環境差（フォント描画）で不安定。CIはDocker/クラウド推奨」と明記

## 完成イメージ（成果物）

- 作るもの: `pnpm create vite`（React + TS）ベースの最小プロジェクトに、Vitest 4 Browser Mode を組み込み、
  1. 小コンポーネント（例: `Card` / `Button`）の**レンダリングテスト**を1本
  2. 同コンポーネントの **`toMatchScreenshot` ビジュアルリグレッションテスト**を1本
  を用意し、「初回=ベースライン生成 → 再実行=緑 → CSSを1px改変で赤・差分画像」までを再現した検証プロジェクト
- 「できた」と言える完了条件:
  - `npx vitest run --browser.headless` が緑で終了（レンダリングテスト＋2回目のスクショ比較）
  - `__screenshots__/` にベースライン画像（`*-chromium-<platform>.png`）が生成・コミットされている
  - CSSを意図的に変えて再実行すると**赤で落ち**、差分（actual/expected/diff）画像が出力される
- 完了確認の方法:
  - CLI: `vitest run` の終了コード（0=緑 / 非0=赤）と出力ログ
  - ファイル: `__screenshots__/` とエラー時の差分画像の**存在確認**（`ls` / Playwright でスクショ）
  - Playwright: 生成された差分画像や `vitest --browser` のUIを開いてスクショ保存（記事の図版用）
- 記事タイトル案（そのまま使える形）:
  1. Vitest 4のブラウザモードで「見た目が崩れたら落ちる」テストを初めて書いてみた
  2. JSDOMしか知らなかった新人が、Vitest 4の`toMatchScreenshot`を試してみた（詰まった点つき）
  3. Vitest 4でビジュアルリグレッションを新人が動かすまで：provider別パッケージ化とベースライン運用

## 事前準備チェックリスト

- [ ] 認証・APIキー: **不要**。npm パッケージと Playwright のブラウザバイナリのみ（課金/サインアップなし）
- [ ] ローカル環境: Node **20+**（22 LTS 推奨） / pnpm（or npm）。`node -v` / `pnpm -v` を記録
- [ ] インストールするもの: `vitest@4`, `@vitest/browser-playwright`, `vitest-browser-react`（Reactレンダリング用）, Playwright の Chromium バイナリ（`npx playwright install chromium`）
- [ ] 無料枠 / コストの確認: すべて OSS・完全ローカル。課金トリガーなし
- [ ] 記録用の準備: 検証用リポジトリ（`vitest4-browser-visual-regression` 等）を新規作成し、`__screenshots__/` とログ・スクショの置き場を決める

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] Vitest 公式 Browser Mode Guide と Visual Regression Testing ページを読み、v3→v4の変更点（provider が `@vitest/browser-playwright` に分離）を1行でメモする（目安: 15分）
  - 記録すること: 「v3では何が違ったか」の自分の理解／公式が挙げる環境依存の注意書きの引用／参照URL
- [ ] `toMatchScreenshot` の挙動（初回はベースライン生成で必ず失敗 / 保存先 `__screenshots__` / 命名 `<name>-<browser>-<platform>` / `--update`）を先に把握する（目安: 15分）
  - 記録すること: 「初回は落ちる」を知らずにハマりそうか、事前に知って助かった点

### フェーズ2: 環境構築（目安: 45分）

- [ ] `pnpm create vite@latest my-app --template react-ts` で最小Reactを作り、`pnpm i` → `pnpm dev` の起動をPlaywrightで確認（スクショ）する（目安: 15分）
  - 記録すること: 実行コマンド全文／Viteの初期表示スクショ／Node・pnpmバージョン
- [ ] `pnpm add -D vitest@4 @vitest/browser-playwright vitest-browser-react` を実行し、`npx playwright install chromium` でブラウザバイナリを入れる（目安: 15分）
  - 記録すること: 導入したパッケージの**実バージョン**（`pnpm ls vitest`）／`playwright install` の出力／ダウンロード容量・所要時間
- [ ] `vitest.config.ts` に Browser Mode を設定して `npx vitest run --browser.headless` が「テスト0件でも起動」するところまで確認（目安: 15分）
  - 記録すること: 使った config 全文（下記）／初回起動ログ／`provider` を文字列 `'playwright'` と書いて失敗した等の差分

  ```ts
  // vitest.config.ts
  import { defineConfig } from 'vitest/config'
  import { playwright } from '@vitest/browser-playwright'

  export default defineConfig({
    test: {
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
    },
  })
  ```

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] テスト対象の小コンポーネント（例 `src/Card.tsx`：タイトル＋本文＋色付きボーダー）を1つ作る（目安: 20分）
  - 記録すること: コンポーネントのコード／なぜ「見た目が分かりやすい」ものにしたか
- [ ] `vitest-browser-react` の `render` を使い、テキスト表示を確認する**レンダリングテスト**を1本書いて緑にする（目安: 30分）
  - 記録すること: テストコード全文／`render`のimport元でハマった点／`npx vitest run --browser.headless` の緑ログ
- [ ] 同コンポーネントに `await expect(page.getByTestId('card')).toMatchScreenshot('card')` を追加し、**初回実行が「ベースライン作成」で失敗する**のを確認・スクショする（目安: 25分）
  - 記録すること: 初回のエラーメッセージ全文（"No existing reference screenshot found..."）／生成された `__screenshots__/card-chromium-<platform>.png`／「落ちて正しい」と分かるまでの戸惑い
- [ ] 生成画像を確認して再実行し、**緑（ベースラインと一致）**になることを確認する（目安: 15分）
  - 記録すること: 2回目の緑ログ／ベースライン画像のスクショ／`__screenshots__` を git 管理に入れる判断
- [ ] CSSを意図的に変える（例 ボーダー色 or `padding` を数px変更）→ 再実行して**赤で落ち**、actual/expected/diff の差分画像が出るのを確認・スクショする（目安: 30分）
  - 記録すること: 変更差分（before/after CSS）／赤のエラーログ全文／差分画像3枚（expected/actual/diff）／mismatch ピクセル数の値

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] `threshold` / `allowedMismatchedPixelRatio` を `vitest.config` で調整し、「どのくらいの差までなら緑にできるか」を1パターン試す（目安: 15分）
  - 記録すること: 調整前後の config／同じ1px変更が緑/赤どちらに変わったか／実務でどう使い分けるかの所感
- [ ] 同じレンダリング確認を JSDOM（`environment: 'jsdom'`）でも書いてみて、「JSDOMでは `toMatchScreenshot` 相当ができない／見た目は検証できない」ことを体感し比較する（目安: 15分）
  - 記録すること: JSDOMで書いたテスト／ブラウザモードとの違い（実DOM描画 vs 擬似DOM）／`--update` の使いどころ

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返し、詰まった点（provider別パッケージ・playwright install忘れ・初回失敗仕様・platform名入り画像名）を棚卸しする（目安: 15分）
  - 記録すること: 詰まりポイント表の埋め込み／「知っていれば早かった」順のランキング
- [ ] 「記事への写像」に沿って本文ドラフトの見出しに記録を割り当て、貼るスクショを選ぶ（目安: 15分）
  - 記録すること: 見出しごとの素材リンク／不足している素材（撮り直しが要る図）

> 目安時間の合計: 約 4 時間 15 分（事前30 + 構築45 + 本編120 + 深掘り30 + 振り返り30）。半日枠にほぼ収まる。溢れる場合はフェーズ4のJSDOM比較を先に削る。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | provider を `@vitest/browser` で入れる／`provider: 'playwright'`（文字列）と書いて起動しない | v4で provider が **`@vitest/browser-playwright`** に分離し、config は `playwright()` を import して渡す仕様に変わった（v3の記事が動かない） | `pnpm add -D @vitest/browser-playwright`、config を `import { playwright }` + `provider: playwright()` に直す | 「古い記事のコマンドが動かない」破壊的変更あるあるとして冒頭に置く |
| 2 | Playwright のブラウザバイナリが無くテストが起動しない | `@vitest/browser-playwright` を入れても Chromium 実体は別途DLが必要 | `npx playwright install chromium` を実行、エラー全文を確認 | 環境構築の「見落としやすい一手」として記録 |
| 3 | `toMatchScreenshot` の初回が必ず失敗して「壊れた」と誤解する | 初回はベースライン画像が無いため、生成して**わざと失敗**させる設計（"No existing reference screenshot found..."） | メッセージを読み、生成画像を確認して**再実行**する | 「落ちて正しい」という仕様を新人視点で解説。記事の山場 |
| 4 | ベースライン画像がCIや他PCで一致せず落ちる | 画像名が `<name>-<browser>-<platform>` で、フォント描画がOS差で揺れる（公式も不安定と明記） | 同一環境で撮る前提を明記／`allowedMismatchedPixelRatio` で許容／CIはDocker前提 | 「環境差でスクショが揺れる」を実測付きで注意喚起 |
| 5 | ヘッドレス/非対話で `vitest`（watch）が終わらない | `vitest` はデフォルトwatchで待ち続ける | 必ず `vitest run --browser.headless` を使う | headless実行の定番の落とし穴として記録 |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（JSDOM / 従来のVitest）と比べて感じた違い:
- スクショを撮った箇所:（Vite初期表示 / 初回ベースライン失敗ログ / ベースライン画像 / 差分画像3枚 / 赤の落ちたログ）
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの記事構成案に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | JSDOMしか知らなかった新人がなぜブラウザモードを試すか |
| 2. なぜブラウザモードを試すのか | フェーズ1 | 実ブラウザテスト標準化・JSDOM卒業の流れ |
| 3. 事前に調べたこと（v3との違い/provider別パッケージ化） | フェーズ1の記録 | v4破壊的変更・`toMatchScreenshot`の初回仕様 |
| 4. 環境構築 | フェーズ2の記録 | 導入コマンド・実バージョン・playwright install・config全文 |
| 5. 実際に書いたテスト | フェーズ3の記録（コンポーネント/レンダリング/スクショ） | 作ったコンポーネントとテストコード |
| 6. 詰まった点 | 詰まりポイント表・記録テンプレ | provider未導入・初回失敗・ベースライン差分のエラー全文 |
| 7. 触ってみて分かったこと | フェーズ3〜4の記録 | 「1px変えたら落ちる」体験・差分画像 |
| 8. JSDOMと比べて感じたこと | フェーズ4の記録 | 実DOM描画 vs 擬似DOM、向き不向き |
| 9. どんな人に向くか | フェーズ5の棚卸し | ビジュアルリグレッションが刺さるチーム像 |
| 10. まとめ | フェーズ5の棚卸し | 次にやること（CI・Docker化への展望） |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない
- うまくいった点だけでなく、初回失敗・provider未導入などの詰まりと解決過程を書く
- 実行ログ・スクリーンショット（特に expected/actual/diff の3枚）・config/テストコードを残して貼る
- Vitest 公式 Browser Mode Guide / Visual Regression Testing へのリンクを入れる
- 再現性（Vitest v4.1.9 / Node バージョン / OS＝画像名の platform）を明記する

## 参考リンク

- 公式ドキュメント: Vitest Browser Mode Guide `https://vitest.dev/guide/browser/`
- 公式ドキュメント: Visual Regression Testing（`toMatchScreenshot`）`https://vitest.dev/guide/browser/visual-regression-testing`
- チュートリアル / クイックスタート: `npx vitest init browser`（Browser Mode 初期化コマンド）
- 関連: `vitest-browser-react`（React レンダリング用ライブラリ）、VoidZero「Announcing Vitest 4.0」ブログ
- 既知の詰まりポイント: 公式の「Visual regression tests are inherently unstable across different environments」注意書き（環境差・フォント描画）

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: なし（OSS・完全ローカル）
- ライセンス / 規約: Vitest / Playwright ともに OSS（MIT系）。生成スクショは自作物のみ
- セキュリティ（APIキーの扱い等）: 秘密情報なし。`__screenshots__` にPCのフォント/描画が写る程度に留意
- 撤退ライン: (a) Playwright ブラウザDLが環境で通らない → WebKit/Firefox など別ブラウザやDocker実行を検討、(b) スクショが環境差で毎回揺れて安定しない → `allowedMismatchedPixelRatio` を上げても不安定なら「環境差で不安定だった」ことを記事の結論にして撤退（それ自体が経験談になる）

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める（コマンド・エラー全文・所要時間・スクショ）
- [ ] 完了条件を満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/run-practice` → `/draft-article`）
