# 実践タスク: Zodしか知らない新人がArkTypeを型主導構文で書き比べてみた

## このタスクの前提

- 出典レポート: `research/search-topic-20260718-0402.md`
- 元テーマ: テーマ1「Zodしか知らない新人がArkTypeを型主導構文で書き比べてみた」（レポートの「最初に試すべき1本」）
- 対象技術: ArkType 2.2.x（比較対象として Zod v4）
- 記事の方向性（記事タイプ）: 書き比べてみた / 試してみた / 詰まった点をまとめた
- 想定筆者 / 想定読者: Web系の新人エンジニア（ArkType未経験） / 新人〜実務2年目（Zodは使ったことがある層）
- 検証に使える想定時間: 半日（約3〜4時間）
- 判断方針: 引数は「対象レポート」のみ指定。テーマ・時間・スキルレベルは未指定のため、レポートの推奨1本とデフォルト前提（半日、新人）を採用した。
- 実行環境の担保: `npm i arktype zod typescript` と `tsc` / `node` だけで完結する。認証・課金・手動デプロイ・ブラウザ操作は一切不要で、AIエージェント単独で実装から検証（型チェック・実行ログ）まで完結できる。型ホバーの確認は「エディタでのホバー」ではなく `tsc` の型出力（`.infer` を経由した代入エラーや型テスト）で客観判定する。

> 裏取りメモ（一次情報 / WebFetch確認済み・2026-07-18）:
> - ArkType 2.2 は GA。公式Blogで `type.fn` / ArkRegex / 双方向JSON Schema / Standard Schema 直接埋め込みが追加と確認（arktype.io/docs/blog/2.2）。
>   - レポート記載の「2.2.3 が最新」は公式Blogでは 2.2.0 GA としか確認できなかった。**実際のインストール時に `npm ls arktype` で入るパッチ版を記録する（要確認）**。
> - セットアップ要件（arktype.io/docs/intro/setup）: **TypeScript 5.1 以上**、tsconfig で `strict`（または `strictNullChecks`）必須、`skipLibCheck: true` 強く推奨、`exactOptionalPropertyTypes: true` 推奨。
> - 基本構文（arktype.io/docs/intro/your-first-type）: `type({ name: "string", "versions?": "(number | string)[]" })`。文字列リテラルのunionは `"'android' | 'ios'"` のように**内側にクォート**が要る。検証は `const out = User(data)`、失敗判定は `out instanceof type.errors`、エラー要約は `out.summary`、静的型は `typeof User.infer`。

## 完成イメージ（成果物）

- 作るもの: 同一の「ユーザー登録フォーム」バリデーションを **Zod v4** と **ArkType 2.2** の2ファイルで実装し、正常系・異常系データを流して結果を突き合わせる最小プロジェクト（`src/zod-schema.ts` / `src/arktype-schema.ts` / `src/run.ts`）。
- 「できた」と言える完了条件:
  1. `npx tsc --noEmit` が両ファイルとも型エラーなしで通る。
  2. `node --experimental-strip-types src/run.ts`（または `tsx src/run.ts`）を実行し、正常系1件・異常系3件（型違い/必須欠落/regex不一致）に対して Zod と ArkType 双方の検証結果とエラーメッセージがコンソールに出力される。
  3. 型推論の一致を確認する型テスト（`const _t: MyStaticType = out` 相当）が両ライブラリで通る（またはズレを記録する）。
- 完了確認の方法: CLI出力（`tsc` の結果 + `node` 実行ログ）。ブラウザ確認は不要のため Playwright は使わない。
- 記事タイトル案（そのまま使える形）:
  1. Zodしか知らない新人がArkTypeを触って書き比べてみた
  2. ArkTypeの型主導構文をZodと同じschemaで書いてみた
  3. Zod → ArkType、最初に詰まった型の書き方の違い

## 事前準備チェックリスト

- [ ] 認証・APIキー: 不要（npm パッケージのみ。課金・サインアップ一切なし）
- [ ] ローカル環境: Node.js LTS（型ストリップ実行のため v22 以上推奨 / なければ `tsx` を使う）、npm、TypeScript **5.1以上**
- [ ] インストールするもの: `arktype` / `zod` / `typescript`（必要なら `tsx`）
- [ ] 無料枠 / コストの確認: すべてOSS・完全無料
- [ ] 記録用の準備: 検証用の空プロジェクト（例 `arktype-vs-zod/`）、`logs/` にコマンド出力を保存、型ホバー相当は `tsc` 出力で保存

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] ArkType 2.2 公式Blog（arktype.io/docs/blog/2.2）とセットアップ手順（intro/setup, intro/your-first-type）を読み、Zodとの構文の違い（文字列DSL・`instanceof type.errors`・`.infer`）を3点メモする（目安: 20分）
  - 記録すること: 「Zodと違うと感じた点」を先に3つ言語化（後で答え合わせに使う）／読んだURLとバージョン
- [ ] 作る成果物（ユーザー登録フォームのフィールド）を確定する。例: `name: string(1〜)`, `email: メール形式`, `age: number>=0`, `role: "admin" | "user"`, `tags?: string[]`（目安: 10分）
  - 記録すること: 決めたフィールド定義（正常系・異常系データの設計根拠になる）

### フェーズ2: 環境構築（目安: 45分）

- [ ] `mkdir arktype-vs-zod && cd arktype-vs-zod && npm init -y` でプロジェクトを作る（目安: 5分）
  - 記録すること: 実行コマンドと生成物
- [ ] `npm i arktype zod typescript` を実行し、`npm ls arktype zod typescript` で**実際に入ったバージョン**を記録する（目安: 10分）
  - 記録すること: 各パッケージの実バージョン（レポートの「2.2.3」との一致/差異を確認＝要確認事項の答え合わせ）
- [ ] `tsconfig.json` を作成し、`strict: true` / `skipLibCheck: true` / `exactOptionalPropertyTypes: true` / `target: "ES2022"` / `module: "NodeNext"` を設定する（目安: 15分）
  - 記録すること: tsconfig 全文。`strict` を入れないと ArkType が動かない旨を実際に外して確認できれば記録
- [ ] Hello World: `src/hello.ts` で `type({ name: "string" })("x")` を書き、`npx tsc --noEmit` が通り `node`（または `tsx`）で実行できることを確認する（目安: 15分）
  - 記録すること: 最初に出たエラー全文（型ストリップ実行 or tsx のどちらを採ったか）、起動できたコマンド

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] `src/zod-schema.ts` に Zod v4 で登録フォーム schema を実装し、`z.infer` で静的型をexportする（目安: 25分）
  - 記録すること: Zodのコード全文、書くのにかかった時間
- [ ] `src/arktype-schema.ts` に**同じ内容**を ArkType の `type({...})` で実装する（email は `"string.email"`、`age` は `"number>=0"`、union は `"'admin' | 'user'"`、optional は `"tags?"`）。`.infer` で静的型をexportする（目安: 35分）
  - 記録すること: ArkTypeのコード全文、Zodと**1対1で対応しなかった書き方**（文字列DSLで迷った箇所を逐一）
- [ ] `src/run.ts` を作り、正常系1件＋異常系3件（型違い/必須欠落/regex(email)不一致）を両schemaに流し、`out instanceof type.errors`（ArkType）と `safeParse`（Zod）の結果・エラー要約をコンソール出力する（目安: 40分）
  - 記録すること: 実行ログ全文、両ライブラリのエラーメッセージの**文言・構造の違い**（1件ずつ並べる）
- [ ] 型推論の一致確認: 各schemaの `.infer` 型に正しい値を代入するテストと、わざと誤った値を代入して型エラーが出るテストを書き、`tsc --noEmit` の結果を記録する（目安: 20分）
  - 記録すること: `tsc` の型エラー全文（誤代入時）、両ライブラリで推論型がズレた点があれば記録

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] ArkType 2.2 の目玉 `type.fn`（ランタイム検証付き関数）を1つ書いて実行する。例: `type.fn("string", ":", "number")(s => s.length)` に正常値・不正値を渡す（目安: 20分）
  - 記録すること: コードと実行ログ、不正引数を渡したときの挙動（Zodには無い体験として）
- [ ] エラーメッセージ・バンドル観点・書き味を3〜4行の比較表メモにまとめる（目安: 10分）
  - 記録すること: 「Zodのほうが楽だった点／ArkTypeが良かった点」を各2つ以上

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] 記録テンプレを見返し、詰まった点（特に文字列DSLと型エラーの読み方）を棚卸しする（目安: 15分）
  - 記録すること: 詰まった点トップ3と、それぞれの解決可否
- [ ] 「記事への写像」に沿って本文ドラフトの見出しに記録を割り当てる（目安: 15分）
  - 記録すること: 各見出しに貼る素材（コード/ログ/気づき）の対応

> 目安時間の合計: 約 4 時間 15 分（事前調査30 + 環境45 + 本編120 + 深掘り30 + 振り返り30）。半日枠にほぼ収まる。超過しそうなら本編の「型推論の一致確認」を簡略化、または深掘りの `type.fn` を省略する。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | `tsc` で ArkType の型が壊れる／推論が `unknown` になる | ArkTypeは `strict`（`strictNullChecks`）必須。無効だと型が正しく出ない。TS 5.1未満も非対応 | tsconfig に `strict: true` と `skipLibCheck: true`、TS 5.1以上を確認。`npm ls typescript` | 「ArkTypeはtsconfig前提が厳しい」を新人の落とし穴として。Zodは緩くても動く対比 |
| 2 | 文字列DSLの書き方で詰まる（`"'admin' \| 'user'"` の内側クォート、`"number>=0"`, `"string.email"`, optionalは値ではなくキー側 `"tags?"`） | Zodはメソッドチェーン、ArkTypeは文字列DSLで発想が違う。リテラルunion・比較・optionalの表現が独特 | 公式 your-first-type の例に厳密に合わせる。autocompleteは効かない前提で公式表を見る | 「Zodからの移行で最初に手が止まる所」= 記事の核。書けなかった式を逐一残す |
| 3 | エラー判定・取り出し方がZodと違う | Zodは `safeParse().success`、ArkTypeは戻り値が成功データ or `type.errors`。`out instanceof type.errors` を知らないと分岐できない | `out instanceof type.errors` で分岐、`out.summary` で文言取得 | 「成功/失敗の分岐の書き方の違い」を並べて図解。両者のエラー文言比較が読者に刺さる |
| 4 | `node` で `.ts` を直接実行できない | 古いNodeは型ストリップ非対応。拡張子や `--experimental-strip-types` でつまずく | Node v22+なら `node --experimental-strip-types`、それ未満は `npm i -D tsx` で `npx tsx` | 「TSをそのまま動かす方法で寄り道した」小ネタとして環境構築セクションに |
| 5 | ArkTypeのパッチ版がレポート記載と違う（要確認） | レポートは2.2.3だが公式BlogはGAを2.2.0と表記 | インストール後 `npm ls arktype` で実バージョンを控える | 「バージョンは自分で確認」の姿勢を示し再現性を担保 |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（Zod）と比べて感じた違い:
- スクショ/ログを残した箇所:
- 記事に書きたい気づき:

## 記録テンプレ（本編の書き比べ専用・フィールド単位）

| フィールド | Zodの書き方 | ArkTypeの書き方 | 迷った点 |
|---|---|---|---|
| name (1文字以上) | `z.string().min(1)` | `"string > 0"`（要確認: 文字列長は `"string >= 1"`? 実装時に確定） |  |
| email | `z.email()` | `"string.email"` |  |
| age (0以上) | `z.number().min(0)` | `"number>=0"` |  |
| role (union) | `z.enum(["admin","user"])` | `"'admin' \| 'user'"` |  |
| tags? (optional) | `tags: z.array(z.string()).optional()` | `"tags?": "string[]"` |  |

> 上の「Zod/ArkTypeの書き方」列は裏取り済み構文の当たり。実装時にコンパイルが通る形へ確定し、通らなかった式は「迷った点」に残す（＝記事の詰まり所素材）。

## 記事への写像（タスク → 見出し）

出典レポート「記事構成案」に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに | 前提・動機 | Zodは使えるがArkTypeは名前だけ、という立ち位置 |
| 2. なぜArkTypeを試すのか | フェーズ1の調査メモ | fastest-growing / Zod代替 / TSKaigi文脈 |
| 3. 事前に調べたこと | フェーズ1、裏取りメモ | Standard Schema・GA状況・tsconfig要件 |
| 4. 環境構築 | フェーズ2の記録 | install・tsconfig・TS 5.1要件・.ts実行の寄り道 |
| 5. 同じschemaをZodとArkTypeで書く | フェーズ3の記録＋フィールド単位表 | 両コードと1対1対応表 |
| 6. 詰まった点（文字列DSL・型エラー） | 詰まりポイント表・記録テンプレ | 内側クォート/optional/エラー分岐、tsc型エラー全文 |
| 7. 触ってみて分かったこと | フェーズ3〜4の記録 | `type.fn` の体験、推論の一致/ズレ |
| 8. Zodと比べて感じたこと | フェーズ4の比較メモ | 書き味・エラー文言・向き不向き |
| 9. どんな人に向いていそうか | フェーズ5の棚卸し | 型主導が好きな人 / Zod資産がある人 |
| 10. まとめ | フェーズ5 | 新人が試した範囲の明示、次に試すこと |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない（網羅比較にしない）。
- うまくいった点だけでなく、文字列DSLで手が止まった過程をそのまま書く。
- 実行ログ・`tsc` の型エラー全文・コードを省略せず貼る。
- 公式（arktype.io / zod.dev）へのリンクを入れ、バージョンを明記する。
- 再現性: Node/TS/各パッケージの実バージョンとtsconfigを載せる。

## 参考リンク

- 公式ドキュメント: https://arktype.io/docs/blog/2.2 , https://arktype.io/docs/intro/setup , https://arktype.io/docs/intro/your-first-type
- 比較記事 / 既知の論点: https://www.pkgpulse.com/guides/valibot-vs-arktype-vs-zod-2026
- Zod（比較対象）: https://zod.dev
- npm: https://www.npmjs.com/package/arktype

## 想定リスク・注意点

- コスト: なし（全てOSS・ローカル完結・課金トリガーなし）。
- ライセンス / 規約: arktype・zod ともにMIT。コード引用に制約なし。
- セキュリティ: APIキー・シークレット不使用。扱う個人情報はダミーデータのみ。
- 撤退ライン: 環境構築（フェーズ2）で1時間以上詰まる場合、`.ts` 直接実行をやめ `tsx` に切り替える。ArkTypeの文字列DSLが本編で30分以上通らないフィールドは、その式を「詰まった記録」として残しZod側だけ完成させ、比較は書けた範囲で成立させる（＝「詰まった点をまとめた」記事として成立させる）。

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレ（全体＋フィールド単位表）を埋めながら進める
- [ ] 完了条件（tsc通過 + 4データの検証ログ + 型テスト）を満たしたら「記事への写像」に沿って本文ドラフトへ展開する
- [ ] `/run-practice` でこの実践タスクを実行し、検証ログを生成する
