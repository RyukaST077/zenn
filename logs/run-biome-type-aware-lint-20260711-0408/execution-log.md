# 検証ログ: ESLint/oxlintしか知らない新人がBiomeの「型認識lint」を試してみた

> Zenn記事の素材。実行の一次情報（コマンド・エラー全文・所要時間）を記録。
> 記事本文は未執筆。「記事への写像」を見て articles/*.md に展開する。
> CLIツールの検証のためスクリーンショットは無し（出力テキストを一次情報として保存）。

## 実行の前提（採用した前提）

- 対象タスク: `practice/practice-biome-type-aware-lint-20260711-0406.md`
- 出典レポート: `research/search-topic-20260711-0402.md`
- 対象技術: Biome の型認識lint（type-aware linting / `types` ドメイン）
- 実行者: AIエージェント単独（非対話） <!-- 内部メタ: 記事に転記しない -->
- 実行日時 / 所要時間: 2026-07-11 04:08 / 見積もり 約4.25h → 実測 約0.9h（AI単独・連続実行の値。記事にそのまま書かない）
- 実行環境: macOS 26.5 (Darwin 25.5.0) / Node v22.17.0 / npm 10.9.2
  - @biomejs/biome 2.5.3 / TypeScript 7.0.2（ESLect検証時のみ 5.9.3 に固定）/ oxlint 1.73.0（+ oxlint-tsgolint）/ eslint 10.6.0 + typescript-eslint 8.63.0
- 採用した撤退ライン: 1タスク30分詰まったら記録して次へ（タスクファイルの既定 = 型認識が再現できなければ詰まりログ自体を成果にする）
- 判断方針: 引数は対象タスクファイルのみ指定。時間・撤退ラインは未指定のためタスクファイルの既定を採用。

## 結果サマリー

- 完了条件の判定: **達成**（3条件すべて客観的に確認）
- 作ったもの: 型依存バグ3種（未awaitPromise / number+bigint / switch網羅漏れ）を仕込んだ最小TSプロジェクトと、Biome/oxlint/ESLint の検出ログ。→ `workspace/`
- スクショ: 0 枚（CLI検証のため出力テキストで代替。`logs/*.txt`）
- 詰まった点: 3 件（うち解決 3 / 未解決・撤退 0）
- knowledge 記録: `knowledge/2026-07-11-biome-types-domain-all-not-enabling-nursery-rules.md`（新規）／ `knowledge/2026-07-09-typescript-eslint-typescript7-cjs-crash.md`（再利用）

## 完了条件の検証

| # | 完了条件 | 判定 | 根拠（ログ） |
|---|---|---|---|
| 1 | `types` 有効で型依存バグが検出される | 達成 | `logs/phase3-F-types-on-final.txt`（3件: noFloatingPromises / noUnsafePlusOperands / useExhaustiveSwitchCases, exit 1） |
| 2 | 型認識なしでは同じバグが検出されない | 達成 | `logs/phase3-H-plain-recommended.txt`（同一 bugs.ts で0件, exit 0）。素のoxlintも `logs/phase4-A-oxlint-default.txt` で0件 |
| 3 | oxlint / ESLint との検出差をログに残す | 達成 | oxlint: `phase4-A`(素0件)/`phase4-D`(--type-aware 3件)。ESLint: `phase4-E`(3件+おまけ2)。比較表は `logs/phase4-summary.txt` |

## タスク実行ログ（フェーズ別）

### フェーズ1: 事前調査（見積もり30分 → 実測 約10分）

- [x] Biome公式の型認識lintドキュメントを読み、`types` ドメインのルール名・nursery/stableを控える
  - 出典/根拠:
    - Linter Domains: https://biomejs.dev/linter/domains/
    - Roadmap 2026（tsc非依存の根拠）: https://biomejs.dev/blog/roadmap-2026/
  - 分かったこと（全文は `logs/phase1-research.txt`）:
    - `types` ドメイン stable: `useArrayFind` / `useConsistentEnumValueType` / `noUnnecessaryConditions` / `useArraySortCompare`
    - `types` ドメイン nursery: `noFloatingPromises` / `noMisusedPromises` / `noUnsafePlusOperands` / `useExhaustiveSwitchCases` / `useAwaitThenable` ほか
    - 今回仕込む3バグのルールは**全部 nursery** → `types: "recommended"` では拾えないと事前に把握
    - Roadmap 引用: "First tool to ship type-aware lint rules that don't rely on the TypeScript compiler (commonly known as `tsc`), thanks to its inference engine, sponsored by Vercel"
- [x] oxlint が型認識ルールをどう扱うかを一次情報で確認
  - 出典: https://oxc.rs/docs/guide/usage/linter/type-aware.html / https://voidzero.dev/posts/announcing-oxlint-type-aware-linting
  - ★タスク前提の更新: oxlint も 2026 時点で type-aware linting を持つ。ただし tsgolint(Go)+typescript-go に依存し、別バイナリ `oxlint-tsgolint` と tsconfig / TS7 が必要。
  - 差別化点: 「型認識lintの有無」ではなく「**tsc(typescript-go)に依存せず自前 inference engine でやる**」のが Biome の独自性。
  - 既存技術との違い: oxlint は Rust 本体 + Go(tsgolint) の二段構成。Biome は単一エンジンで完結。

### フェーズ2: 環境構築（見積もり45分 → 実測 約8分）

- [x] `npm init -y` → `npm i -D -E @biomejs/biome typescript`
  - 実行したコマンド:
    ```bash
    npm init -y
    npm i -D -E @biomejs/biome typescript
    npx @biomejs/biome --version   # => Version: 2.5.3
    npx tsc --version              # => Version 7.0.2
    ```
  - 出力: `added 4 packages ... found 0 vulnerabilities`（詰まりなし）
- [x] `npx @biomejs/biome init` で `biome.json` 生成、`tsconfig.json` 用意
  - 実行したコマンド: `npx @biomejs/biome init`
  - つまずき予測との差: 詰まりポイント表 #4 は「init が対話で止まる」を懸念していたが、**2.5.3 の init は完全非対話**で `biome.json` を生成した（headless/CIでそのまま使える）。
  - 生成 `biome.json` は `linter.rules.preset: "recommended"`・`formatter.indentStyle: "tab"` が既定。
- [x] サンプル1ファイルで `biome check`（Hello World）
  - 実行したコマンド: `npx @biomejs/biome check src/hello.ts`
  - 出力（全文 `logs/phase2-hello-check.txt`）: フォーマット差分（space→tab）のみ検出。Biome が動くことを確認。
  - 記事に書きたい気づき: init も check も認証・課金・対話なしで即動く。導入コストは限りなく低い。

### フェーズ3: 実装・検証【本編】（見積もり120分 → 実測 約25分）

- [x] 型依存バグを仕込んだ最小TSファイル `src/bugs.ts` を作成
  - 各バグが「型情報がないと検出できない」理由:
    - 未awaitPromise: 呼び出し行だけ見ても `fetchUser()` の戻り値が Promise かは型解決が要る
    - number+bigint: `+` の左右の型を解決しないと危険な加算か判定不能
    - switch網羅漏れ: union 型 `Status` の全メンバを解決しないと漏れが分からない
- [x] `types` 有効化 → `biome check`/`lint` で検出確認（有効/無効の対比）
  - 実行したコマンド（対比、全 `logs/commands.log` / 各 phase3-*.txt に保存）:
    ```bash
    # 素のrecommended（型認識OFF）
    npx @biomejs/biome lint src/bugs.ts                # => 0件 exit0  (phase3-A / phase3-H)
    # types: "recommended"（stableのみ）
    npx @biomejs/biome lint src/bugs.ts                # => 0件 exit0  (phase3-B)
    # types: "all"（nursery含むはず）
    npx @biomejs/biome lint src/bugs.ts                # => 0件 exit0  (phase3-C) ★予想外
    # types:"all" + rules.nursery で3ルールを "error" 明示
    npx @biomejs/biome lint src/bugs.ts                # => 3件 exit1  (phase3-F) ★達成
    ```
  - 検出結果（`logs/phase3-F-types-on-final.txt` 全文）:
    ```
    src/bugs.ts:12:2 lint/nursery/noFloatingPromises
      × A "floating" Promise was found, ...
    src/bugs.ts:22:10 lint/nursery/noUnsafePlusOperands
      × Numeric + operations must use either two bigint values or two number values.
      i This operation mixes number with bigint.
    src/bugs.ts:31:2 lint/nursery/useExhaustiveSwitchCases
      × The switch statement is not exhaustive.
      i These cases are missing: - "archived"
    Found 3 errors.
    ```
  - 効いた対処: nursery ルールを `rules.nursery.<rule>: "error"` で個別指定（下記「詰まった点」#1）
- [x] `types` 無効化して非検出を対比確認
  - 実行したコマンド: 素の recommended（domains/nursery なし）で同一 `bugs.ts` を lint（`phase3-H`）→ **0件 exit0**。
  - ★重要な気づき: `domains.types: "none"` にしても、ルールを明示有効化したままだと検出は消えない（`phase3-G` で3件のまま）。ルール有効化自体が型推論エンジン（scanner）を起動するため。正確な「ON/OFF対比」は domains トグルではなく**ルール自体のON/OFF**で見る。
- [x] `--verbose` で挙動観察
  - 実行したコマンド: `npx @biomejs/biome lint --verbose src/bugs.ts`（`phase3-I`）
  - 観察: 型認識ONのときだけ `Scanned project folder in 100ms` が出る＝プロジェクトscan起動を確認。実行時間は素recommended 約250ms に対し scan あり時は最大約950msまで振れた（体感差あり）。tsconfit 無しでも今回は動いたが、公式はプロジェクトscan前提。

### フェーズ4: 深掘り・比較（見積もり30分 → 実測 約25分）

- [x] oxlint と ESLint に同じ `bugs.ts` を通す
  - oxlint 実行（全文 `logs/phase4-*.txt`）:
    ```bash
    npm i -D oxlint                                    # 1.73.0
    npx oxlint src/bugs.ts                             # => 0件 exit0 (phase4-A) 素は型認識なし
    npx oxlint --type-aware src/bugs.ts               # => Failed to find tsgolint executable (phase4-B)
    npm i -D oxlint-tsgolint
    npx oxlint --type-aware src/bugs.ts               # => 1件(no-floating-promises) (phase4-C)
    npx oxlint --type-aware \
      -D typescript/no-floating-promises \
      -D typescript/restrict-plus-operands \
      -D typescript/switch-exhaustiveness-check src/bugs.ts  # => 3件 (phase4-D)
    ```
  - ESLint 実行:
    ```bash
    npm i -D eslint typescript-eslint                 # => ERESOLVE (TS7 と peer <6.1.0 が衝突)
    npm i -D -E typescript@5.9.3                       # 既知対処: peer範囲に固定
    npm i -D eslint typescript-eslint                 # => 成功
    npx eslint src/bugs.ts                            # => 5件(3バグ+require-await+no-unnecessary-type-assertion) (phase4-E)
    ```
  - 3ツール検出マトリクス（詳細 `logs/phase4-summary.txt`）:

    | バグ | Biome(types) | oxlint 素 | oxlint --type-aware | ESLint+typescript-eslint |
    |---|---|---|---|---|
    | 未awaitPromise | ✓ | ✗ | ✓ | ✓ |
    | number+bigint | ✓ | ✗ | ✓ | ✓ |
    | switch網羅漏れ | ✓ | ✗ | ✓ | ✓ |

  - 型認識の「仕組み」の違い（記事の核）:

    | 観点 | Biome | oxlint | ESLint(typescript-eslint) |
    |---|---|---|---|
    | 型情報の出どころ | 自前 inference engine（tsc非依存） | typescript-go（tsgolint経由） | tsc（TypeScript本体） |
    | 追加で要る物 | @biomejs/biome のみ | oxlint + oxlint-tsgolint 別バイナリ | typescript + parser/plugin一式 |
    | デフォルトで型認識バグを拾うか | 拾わない（domain+rule有効化が要る） | 拾わない（--type-aware必須） | recommendedTypeChecked で拾う |

### フェーズ5: 振り返り・記事化準備（見積もり30分 → 実測 約10分）

- [x] 詰まった点の棚卸し（下表）
- [x] 記事への写像を実績で埋める（後述）

## 詰まった点と解決過程（記事の核）

| # | 詰まった点 | 原因 | 効いた対処 | 所要 | 解決/撤退 | 記事での活かし方 |
|---|---|---|---|---|---|---|
| 1 | `types:"recommended"` でも `"all"` でも型依存バグが0件（exit0） | 3バグのルールが全て nursery。`recommended` は stable のみ、`all` でも自環境で自動発火せず | `rules.nursery.<rule>: "error"` で個別に明示有効化 → 3件発火 | 約10分 | 解決 | 「有効化でハマった手順」を前後の出力差で見せる。nurseryルールの罠。knowledge化済み |
| 2 | 仕込んだ `number + string` が noUnsafePlusOperands で検出されない | Biome の noUnsafePlusOperands は number+string を「文字列結合」として許容。number+bigint等の混在だけ不正 | バグを `number + bigint` に修正 → 検出 | 約5分 | 解決 | typescript-eslint の restrict-plus-operands と検出範囲が違う点。ルールの定義を読む大切さ |
| 3 | `npm i -D eslint typescript-eslint` が ERESOLVE で失敗 | typescript@7.0.2 が typescript-eslint 8.x の peer `>=4.8.4 <6.1.0` を外れる | `npm i -D -E typescript@5.9.3` で peer範囲に固定（既存knowledge再利用） | 約5分 | 解決 | 「Biome は自前エンジンなので TS7 でもこの罠を踏まない」＝依存の軽さが実運用で効く例 |

予測（詰まりポイント表）との差分:
- 予測 #4「biome init が対話で止まる」→ 実際は完全非対話で外れ（良い意味で）。
- 予測 #1「types未有効/nursery未含有で検出されない」→ 的中。さらに `"all"` でも個別有効化が要る点は予測より一段深い落とし穴だった。

## スクリーンショット一覧

なし（CLI検証のため）。ブラウザ表示を伴わないので Playwright は使わず、出力テキスト（`logs/*.txt`）を一次証跡とした。

## 記事への写像（実績で埋める）

| 記事の見出し | 使う記録 / ログ | 書くこと（メモ） |
|---|---|---|
| 1. はじめに | 前提・動機（本ファイル冒頭） | ESLint/oxlint経験者が「tsc非依存の型認識lint」に惹かれて試す動機 |
| 2. なぜBiomeの型認識lintを試すのか | `logs/phase1-research.txt` / Roadmap引用 | Vercel後援の inference engine、tsc非依存という差別化点 |
| 3. 事前に調べたこと（oxlintとの違い） | `logs/phase1-research.txt` / phase4-summary | oxlintも今は型認識を持つが typescript-go 依存。Biome独自性の再定義 |
| 4. 環境構築 | フェーズ2ログ（phase2-hello-check.txt） | install/init/実バージョン。init が非対話だった点 |
| 5. 実際に試したこと | `workspace/src/bugs.ts` 全文 / phase3-F | 仕込んだ3バグのコードと検出ログ |
| 6. 詰まった点 | 「詰まった点」表 / phase3-C・phase3-E・phase4のERESOLVE | nursery個別有効化・number+string不発・TS7×typescript-eslint |
| 7. 触ってみて分かったこと | phase3-H(OFF) vs phase3-F(ON) / phase3-I(verbose) | ルールON/OFFで検出が変わる。domainトグルの誤解と scanner起動 |
| 8. oxlint・ESLintと比べて感じたこと | `logs/phase4-summary.txt`（2つの表） | 3ツール検出マトリクス＋「仕組みの違い」表 |
| 9. どんな人に向いていそうか | フェーズ5棚卸し | 単一ツールで型認識lintまで欲しい人／TS本体のバージョン地雷を避けたい人 |
| 10. まとめ | 結果サマリー | 「有無」より「tsc非依存」が差。次は noMisusedPromises 等も試す |

## 未達・撤退した項目

なし（完了条件3つとも達成、フェーズ4のESLint比較も完走）。

## 再現性メモ（記事に転記する用）

- OS / ランタイム: macOS 26.5 / Node v22.17.0 / npm 10.9.2
- 主要バージョン: @biomejs/biome 2.5.3 / oxlint 1.73.0 + oxlint-tsgolint / eslint 10.6.0 + typescript-eslint 8.63.0
  - Biome/oxlint検証時 TypeScript 7.0.2。ESLint(typescript-eslint 8.x)は TS7 非対応のため **TypeScript 5.9.3 に固定**が必要。
- 最短の再現手順:
  ```bash
  npm init -y
  npm i -D -E @biomejs/biome typescript
  npx @biomejs/biome init
  # biome.json の linter に domains.types:"all" と rules.nursery で
  #   noFloatingPromises/noUnsafePlusOperands/useExhaustiveSwitchCases を "error" 指定
  npx @biomejs/biome lint src/bugs.ts   # 型依存バグが3件検出される
  ```
- 注意点（ハマりどころ）:
  - 型認識ルールの多くは **nursery**。`domains.types:"recommended"`／`"all"` 任せにせず `rules.nursery.<rule>:"error"` で明示する。
  - `noUnsafePlusOperands` は number+string を許容（文字列結合）。number+bigint等の混在で試す。
  - typescript-eslint 8.x は TypeScript 7.x で動かない（ERESOLVE / Cjsクラッシュ）。TS を `<6.1.0` に固定する。Biome はこの問題と無関係（自前エンジン）。

## 次のアクション（記事化）

- [ ] この execution-log.md の「記事への写像」に沿って `articles/biome-type-aware-lint.md` を作成する
- [ ] スクショは無し。コードと CLI 出力（`logs/*.txt` からの抜粋）を本文に貼る
- [ ] 完了条件・詰まった点・3ツール比較表を本文に落とす
