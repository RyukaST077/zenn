# 検証ログ: Vite 8（Rolldown）へ移行して、ビルド時間が実際どれだけ速くなるか測ってみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間・スクショ）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-vite8-rolldown-20260702-2113.md`
- 出典レポート: `research/search-topic-20260702-2109.md`（テーマ#1）
- 対象技術: Vite 8.1.3 + Rolldown 1.1.4（対比対象 Vite 7.3.6 / 追加検証 rolldown-vite 7.3.1）
- 実行者: AIエージェント単独（非対話 / 人手の介在なし）
- 実行日時 / 所要時間: 2026-07-02 21:16〜21:24 / 見積もり 約4.0h → 実測 約0.5h（自動実行のため大幅短縮）
- 実行環境: macOS 26.5 (arm64) / Apple M2 Pro 10コア / 16GB RAM / Node v22.17.0 / npm 10.9.2 / pnpm 10.13.1 / corepack 0.33.0
- 採用した撤退ライン: 対象タスク既定（Vite 8移行で起動不能が30分続けば rolldown-vite へ切替。それも不可なら「詰まった点まとめ」へ軸変更）。今回は撤退に至らず。
- 判断方針: 引数はタスクファイルパスのみ。時間・スキルレベルは無指定のためデフォルト前提（半日／新人）を採用。

## 結果サマリー

- 完了条件の判定: **達成**（Vite 7/8 両方で build・dev を cold/warm 各3回計測、比較表・倍率を算出、両版の画面を Playwright でスクショ）
- 作ったもの: 最小Reactアプリ（TS + react-router-dom + zustand + dayjs + recharts + lodash-es / 3ページ・約1200モジュール・JSバンドル約590KB）。`workspace/vite-bench/`
- スクショ: 6枚（`screenshots/`。Home 3版 + Dashboard 3版）
- 詰まった点: 3件（すべて解決 / 未解決・撤退 0）
- knowledge 記録: なし（いずれも既知の一般的なつまずきで、撤退・新規トラブル記録には至らず）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ / スクショ） |
|---|---|---|---|
| 1 | Vite 7 で build と dev 起動が成功し cold/warm 各3回計測 | 達成 | commands.log「MEASURE vite7」ブロック（build cold real 3.00/2.59/2.57、dev ready 108/107/107ms 他） |
| 2 | Vite 8 に移行後、同アプリで同条件の計測 | 達成 | commands.log「MEASURE vite8」ブロック（build cold real 1.49/1.36/1.33、dev ready 100/106/102ms 他） |
| 3 | 両者を1つの比較表にまとめ差（倍率）を出す | 達成 | 本ログ「比較表」節。build step 8.0x / full build real 1.9x / dev ready 1.05〜1.14x |
| 4 | preview/dev 画面を Playwright でスクショ保存 | 達成 | screenshots/02-vite7-preview.png・03-vite8-preview.png（+ dashboard 各1枚） |

## 比較表（計測の中心）

vite の「built in」表示（＝バンドル処理のみ）と、`pnpm run build` 全体の `real`（＝`tsc -b` 型チェック込み）を分けて記録した。dev は起動ログの "ready in"。

| 対象 | build cold `built in`(3回) | build warm `built in`(3回) | `pnpm build` real cold(3回) | dev cold ready(3回) | dev warm ready(3回) | 出力(JS / gzip / modules) |
|---|---|---|---|---|---|---|
| Vite 7.3.6 | 1.47 / 1.39 / 1.39 s | 1.39 / 1.36 / 1.41 s | 3.00 / 2.59 / 2.57 s | 108 / 107 / 107 ms | 103 / 108 / 108 ms | 598.82 KB / 183.99 KB / 1267 |
| Vite 8.1.3 | 185 / 173 / 167 ms | 175 / 164 / 165 ms | 1.49 / 1.36 / 1.33 s | 100 / 106 / 102 ms | 95 / 95 / 94 ms | 592.47 KB / 180.11 KB / 1235 |
| 倍率(7÷8, 中央値) | **約 8.0x** | 約 8.4x | **約 1.9x** | 約 1.05x | 約 1.14x | ほぼ同等（微減） |

**この比較表からの読み取り（記事の核）**:
- バンドル処理そのもの（Rolldown vs Rollup+esbuild）は **約8倍速い**。公式の「10〜30x」に届かないのは小規模アプリ（約1200モジュール）だから、で説明がつく。
- ところが `pnpm run build` の体感（`real`）は **約1.9倍**止まり。理由は `tsc -b`（型チェック）に約1.1〜1.2秒かかり、これが**両バージョン共通の固定コスト**として支配的になるため。「バンドラを速くしてもビルド全体は宣伝ほど速くならない」という新人がハマりやすいギャップ。
- dev の "ready in" は 100ms前後で、この規模では**ほぼ差が出ない**（1.05〜1.14x）。dev はもともと esbuild でも十分速く、Rolldown化の恩恵は本番ビルドほど見えない。
- 出力バンドルは Vite 8 の方がわずかに小さい（598.82→592.47 KB、モジュール数 1267→1235）。移行しても見た目・サイズは実質同等。

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査

- [x] Node要件確認・計測条件決定（見積もり30分 → 実測 約3分）
  - 実行したコマンド:
    ```bash
    node -v   # v22.17.0
    npm -v    # 10.9.2
    pnpm -v   # 10.13.1
    npm view vite dist-tags   # latest=8.1.3, previous=7.3.6, beta=8.1.0-beta.0
    npm view rolldown-vite dist-tags  # latest=7.3.1
    ```
  - 結果: Node v22.17.0 は Vite 8 要件（20.19+ / 22.12+）を満たす。npm 上の実バージョンは Vite latest=8.1.3・previous=7.3.6、rolldown-vite=7.3.1。
  - 決めた計測条件: cold=各回前に `rm -rf node_modules/.vite dist`、warm=キャッシュ保持で連続実行。build/dev とも3回。マシン: M2 Pro/16GB/macOS 26.5。
  - 記事に書きたい気づき: 「Vite 8 は Node 20.19+/22.12+ 必須」を冒頭に置くと読者の再現性が上がる。事前に `node -v` を確認するだけで前提エラーを回避できる。

### フェーズ2: 環境構築

- [x] 雛形作成（見積もり15分 → 実測 約2分）
  - 実行したコマンド:
    ```bash
    pnpm create vite@latest vite-bench --template react-ts
    cd vite-bench && pnpm install
    pnpm ls vite   # => vite 8.1.3
    ```
  - つまずいた（予測と違った）点: タスクは「対話プロンプトで止まる → `-- --template` が必要」と予測していたが、**`--template react-ts`（`--` なし）で対話なしに完了**した。現行の `create-vite` は引数指定でそのまま非対話スキャフォールドされる。
  - 予測どおりだった点: `create vite@latest` は**最新の Vite 8.1.3 を入れる**。比較の起点を7にするため明示固定が必要（予測#3が的中）。
- [x] Vite 7 へ固定 → プラグイン非互換に遭遇（見積もり込み → 実測 約3分）
  - 実行したコマンド / 出力（全文の要点）:
    ```bash
    pnpm add -D vite@7
    # WARN  Issues with peer dependencies found
    # └─┬ @vitejs/plugin-react 6.0.3
    #   └── ✕ unmet peer vite@^8.0.0: found 7.3.6
    ```
  - 効いた対処: プラグインも Vite 7 対応版へ下げる。
    ```bash
    npm view @vitejs/plugin-react@5 peerDependencies
    # 5.2.0 => vite: ^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0
    pnpm add -D @vitejs/plugin-react@5   # => 5.2.0（v7・v8 両対応）
    ```
  - 記事に書きたい気づき: **「Vite を7に固定したらプラグインの peer が合わない」**は新旧比較の実務的な落とし穴。plugin-react 6系は Vite 8 専用。5.2.0 は7/8両対応なので、比較検証には5.2.0で揃えると移行時にプラグインを触らずに済む。
- [x] 依存追加・コンポーネント増設（見積もり20分 → 実測 約4分）
  - 実行したコマンド:
    ```bash
    pnpm add react-router-dom zustand dayjs recharts lodash-es
    # 追加: react-router-dom 7.18.1 / zustand 5.0.14 / dayjs / recharts 3.9.1 / lodash-es 4.18.1
    ```
  - 狙い: recharts（重い）で意図的にバンドルを膨らませ、バンドラ差が見えるようにする。3ページ（Home/Dashboard/About）＋ zustand ストア。
  - `src/pages/Home.tsx`・`Dashboard.tsx`・`About.tsx`・`store.ts`・`App.tsx` を作成（`workspace/vite-bench/src/`）。
- [x] dev 起動確認（Playwright）（見積もり10分 → 実測 約3分）
  - 起動ログ: `VITE v7.3.6 ready in 167 ms` / `http://localhost:5173/`
  - スクショ: `screenshots/01-vite7-dev-home.png`（Home＝カウンタ・日付・ナビ）、`01-vite7-dev-home-dashboard.png`（Dashboard＝recharts の折れ線が描画）
  - Playwright 実行結果: `{homeVisible:true, today:"今日は 2026-07-02 です"}` → DOM 上も表示を確認。

### フェーズ3: 実装・検証【本編】

- [x] Vite 7 の build/dev を cold/warm 各3回計測（見積もり35分 → 実測 約5分）
  - 実行したコマンド:
    ```bash
    bash ../measure.sh vite7   # rm -rf node_modules/.vite dist を各回前に実行
    ```
  - 途中で遭遇したエラー（全文）と対処:
    ```
    src/pages/About.tsx(2,28): error TS7016: Could not find a declaration file for module 'lodash-es'.
      Try `npm i --save-dev @types/lodash-es` ...
    src/pages/Dashboard.tsx(3,23): error TS7016: ...'lodash-es' implicitly has an 'any' type.
    src/pages/Dashboard.tsx(5,32): error TS7006: Parameter 'm' implicitly has an 'any' type.
     ELIFECYCLE  Command failed with exit code 2.
    ```
    → 効いた対処: `pnpm add -D @types/lodash-es`。以後 `tsc -b && vite build` が通った。
  - 計測結果（本文の比較表に反映）: build cold `built in` 1.47/1.39/1.39s（real 3.00/2.59/2.57s）、dev ready 108/107/107ms。
  - 気づき: `pnpm build` は `tsc -b && vite build`。`real` に型チェック時間が乗るため、cold と warm で `real` がほぼ変わらない（`.vite` は dev 用キャッシュで、本番 build の律速ではない）。
- [x] Vite 7 の preview 画面スクショ（見積もり15分 → 実測 約2分）
  - `pnpm run preview --port 4173` → `screenshots/02-vite7-preview.png`（+ dashboard）。表示・折れ線チャート正常。
- [x] Vite 8 へ移行（見積もり20分 → 実測 約2分）
  - 実行したコマンド / 出力（全文）:
    ```bash
    pnpm add -D vite@8
    # devDependencies:
    # - vite 7.3.6
    # + vite 8.1.3
    # （peer 警告なし。plugin-react 5.2.0 が vite^8.0.0 も満たすため）
    node -e "console.log(require('vite/package.json').dependencies.rolldown)"  # ~1.1.3
    ls node_modules/.pnpm | grep -i rolldown  # rolldown@1.1.4, @rolldown+binding-darwin-arm64@1.1.4
    ```
  - Rolldown 統合の確認: Vite 8 の直接依存に `rolldown: ~1.1.3`（実体 1.1.4）。フラグ不要でデフォルト統合されている。
  - **予測した警告 `validate output options ... Invalid key` は出なかった**（デフォルト設定の素の react-ts では発生せず）。代わりにチャンクサイズ警告の文言が Vite 8 では `build.rolldownOptions.output.codeSplitting`＋`rolldown.rs` へのリンクに変化（Rollup→Rolldown へ切替わった証跡）。
  - 移行で壊れた箇所: なし（プラグインを 5.2.0 に揃えていたため無修正で移行完了）。
- [x] Vite 8 で同条件計測（見積もり20分 → 実測 約4分）
  - `bash ../measure.sh vite8`。build cold `built in` 185/173/167ms（real 1.49/1.36/1.33s）、dev ready 100/106/102ms。出力 592.47KB / 1235 modules。

### フェーズ4: 深掘り・比較

- [x] 比較表・倍率算出（本文「比較表」節）。build step 約8.0x、full build real 約1.9x、dev ready 約1.05〜1.14x。
- [x] Vite 8 の画面スクショ（`screenshots/03-vite8-preview.png` + dashboard）。Vite 7版と見た目・挙動が同一（移行で表示が壊れていない証跡）。
- [x] （任意）rolldown-vite overrides を Vite 7 上で体験（見積もり15分 → 実測 約3分）
  - 実行したコマンド:
    ```bash
    # package.json に注入
    #   "pnpm": { "overrides": { "vite": "npm:rolldown-vite@latest" } }
    pnpm install
    # + vite <- rolldown-vite 7.3.1 deprecated   ← 現在は非推奨表示
    pnpm exec vite --version   # vite/7.3.1
    pnpm run build             # rolldown-vite v7.3.1 building ... built in 214ms
    ```
  - 出た警告全文（チャンクサイズ）:
    ```
    (!) Some chunks are larger than 500 kB after minification. Consider:
    - Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/...
    ```
  - デフォルト統合(Vite 8)との体験差:
    - 速度: rolldown-vite の build も `built in 214ms` と Vite 8（167〜185ms）とほぼ同等（＝中身は同じ Rolldown）。
    - 表示: Vite 8 はチャンク警告が `build.rolldownOptions`＋`rolldown.rs`、rolldown-vite は旧来の `build.rollupOptions`＋`rollupjs.org`（API名の互換維持）。
    - **`rolldown-vite 7.3.1 deprecated`** と表示された。Vite 8 が GA になった今、先行検証用の overrides パッケージは役目を終え非推奨。**2026-07 時点では素直に Vite 8 を使うのが正解**、という現在地の記録。
  - ここでも予測の `Invalid key` 警告は未発生。検証後 package.json を復元し vite@8 に戻した（最終状態は Vite 8.1.3 クリーン）。

### フェーズ5: 振り返り・記事化準備

- [x] 詰まりポイントの棚卸し（下表）／記事への写像の割り当て（後述）。

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | Vite 7 固定で plugin-react の peer 不一致（`unmet peer vite@^8.0.0: found 7.3.6`） | scaffold 直後の plugin-react は 6.x（Vite 8 専用） | `pnpm add -D @vitejs/plugin-react@5`（5.2.0 は v7/v8 両対応） | 約3分 | 解決 | 「新旧比較の落とし穴：バージョン固定はプラグインまで揃える」。予測#3の発展形 |
| 2 | build が `TS7016: lodash-es の型が無い` で失敗（exit 2） | `pnpm build`=`tsc -b && vite build`。lodash-es に型定義が同梱されない | `pnpm add -D @types/lodash-es` | 約2分 | 解決 | 「ビルド＝型チェック込み。バンドラ速度以前にtscで落ちる」導入に |
| 3 | 予測の警告 `validate output options ... Invalid key` が出ない | 素の react-ts＋デフォルト設定では未発生（Rollup固有オプション未使用のため） | 追加対処不要。出力の挙動差（チャンク警告の文言・リンク先）で Rolldown 化を確認 | — | 解決（想定と相違） | 「BETA期の既知警告が安定版では出ないこともある。予測と実測の差を正直に」 |

（対象タスク「詰まりそうなポイント」との対応: #1=表#3的中の発展 / #2=新規 / #3=表#4は今回は不発。表#1 Node要件・#2 対話プロンプトは今回いずれも問題化せず＝新人が身構えるほどではなかった、も1つの知見。）

## スクリーンショット一覧

| ファイル | 何を示すか | 使う見出し |
|---|---|---|
| screenshots/01-vite7-dev-home.png | Vite 7 dev の Home（カウンタ・日付・ナビ） | 4. 環境構築 |
| screenshots/01-vite7-dev-home-dashboard.png | Vite 7 dev の Dashboard（recharts 折れ線） | 4. 環境構築 |
| screenshots/02-vite7-preview.png | Vite 7 本番ビルドの preview 表示 | 5. 実際に試したこと |
| screenshots/02-vite7-preview-dashboard.png | 同上 Dashboard | 5. 実際に試したこと |
| screenshots/03-vite8-preview.png | Vite 8 本番ビルドの preview 表示（7と同一） | 8. Vite 7と比べて感じたこと |
| screenshots/03-vite8-preview-dashboard.png | Vite 8 Dashboard（移行で壊れていない証跡） | 8. Vite 7と比べて感じたこと |

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / スクショ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 実行の前提節 | 新人がVite 8を試す動機・スコープ（小規模・手元計測） |
| 2. なぜVite 8を試すのか | フェーズ1 / 裏取りメモ | Rolldownデフォルト統合の意味・トレンド背景 |
| 3. 事前に調べたこと（Rolldownとは） | フェーズ1コマンド出力 | Node要件20.19+/22.12+、npm実バージョン、rolldown 1.1.4 が直接依存 |
| 4. 環境構築 | フェーズ2ログ / screenshots/01 | create vite（非対話で通った）・Vite7固定・plugin-react 5.2.0・依存追加 |
| 5. 実際に試したこと（移行と計測） | フェーズ3ログ / measure.sh / screenshots/02 | 計測手順（cold/warm定義）・移行コマンド・スクショ |
| 6. 詰まった点 | 「詰まった点」表 / エラー全文 | peer不一致・TS7016・予測警告の不発（3件、全文つき） |
| 7. 触ってみて分かったこと | 比較表の読み取り | build stepは8x、しかしtscが律速でビルド全体は1.9x |
| 8. Vite 7と比べて感じたこと | 比較表 / screenshots/02 vs 03 | 倍率・体感差・「10〜30x」とのギャップ・見た目は不変 |
| 9. どんな人に向いていそうか | フェーズ4 / rolldown-vite節 | 新規はVite 8直行推奨・rolldown-viteは非推奨に・大規模ほど恩恵 |
| 10. まとめ | 結果サマリー | 学び（バンドラ速度≠ビルド全体）・次にやること（大規模で再計測） |

## 未達・撤退した項目

- なし（すべての完了条件を達成。撤退ライン未到達）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 (arm64) / Apple M2 Pro / 16GB / Node v22.17.0 / pnpm 10.13.1
- 主要ライブラリ: vite 7.3.6 ↔ 8.1.3 / @vitejs/plugin-react 5.2.0 / react 19.2.7 / react-router-dom 7.18.1 / recharts 3.9.1 / rolldown 1.1.4
- 最短の再現手順:
  ```bash
  pnpm create vite@latest vite-bench --template react-ts
  cd vite-bench && pnpm install
  pnpm add -D vite@7 @vitejs/plugin-react@5      # 比較の起点（peerを揃える）
  pnpm add react-router-dom zustand dayjs recharts lodash-es
  pnpm add -D @types/lodash-es                    # TS7016 回避
  # ここで計測（各回前に rm -rf node_modules/.vite dist）
  pnpm run build       # Vite 7
  pnpm add -D vite@8   # 移行
  pnpm run build       # Vite 8（Rolldown）
  ```
- 注意点: 完全無料・ローカル完結・認証不要。build の `real` は `tsc -b` 込みなので、バンドラ純粋速度を見るなら vite の「built in」表示を使う。小規模アプリでは倍率が控えめに出る（断定を避ける）。ポートは 5173(dev)/4173(preview)。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って articles/<slug>.md を作成する
- [ ] スクショを Zenn 用に `images/<slug>/` へ配置し `![...](/images/<slug>/..)` で参照する
- [ ] 完了条件・詰まった点（3件）・比較表（8x vs 1.9x のギャップ）を本文に落とす
