# 実践タスク: `node app.ts` が普通に動く時代を新人が試す — tsx/ts-node を卒業できるか、どこで詰まるか

## このタスクの前提

- 出典レポート: `research/search-topic-20260705-0212.md`
- 元テーマ: 候補#1「`node app.ts`が普通に動く時代を新人が試す — tsx/ts-nodeを卒業できるか、どこで詰まるか」（合計28点 / 最優先・「最初に試すべき1本」）
- 対象技術: Node.js ネイティブ TypeScript（type stripping / amaro・SWC）
- 記事の方向性（記事タイプ）: 「試してみた」/ 検証ログ / 「詰まった点をまとめた」
- 想定筆者 / 想定読者: Web系の新人エンジニア（tsx/ts-node を使ってきた層）/ 新人〜実務2年目
- 検証に使える想定時間: 半日（約3〜4時間）※デフォルト前提を採用
- 判断方針: 引数はレポートパスのみ指定。テーマ・時間・スキルレベルは無指定のため、レポートの「最初に試すべき1本」＋デフォルト前提（半日 / 新人）を採用。
- 実行環境の担保: 完全CLI・完全無料・認証不要・ローカル完結。必要なのは Node ランタイムと `.ts` ファイルのみ。ブラウザ確認は発生しない（CLI 出力・終了コードで完了判定）ため Playwright すら不要。**AIエージェント単独で最後まで実行・検証可能**。テーマ置き換えは不要（Executability Gate を全タスクがクリア）。

> ⚠️ バージョン注意（一次情報で裏取り済み・2026-07-05 時点）
> - type stripping が **既定で有効**になったのは **Node v23.6.0 / v22.18.0** 以降。
> - type stripping が **stable（実験フラグ不要・警告なし）**になったのは **Node v24.12.0 / v25.2.0** 以降。
> - Node 24 LTS はこの条件を満たす（既定＆stable）。**検証に使った Node バージョンは記事に必ず明記する**（`node -v` の出力を貼る）。
> - 出典レポートは「Node 24 LTS で既定」と書いていたが、正確には「22.18+ で既定 / 24.12・25.2 で stable」。この差自体が記事ネタになる。

## 完成イメージ（成果物）

- 作るもの: `node-native-ts-lab/` という小さな検証リポジトリ。中に「動く最小 `.ts`」と「詰まる `.ts`（enum / namespace / パラメータプロパティ / 拡張子なし import 等）」を並べ、それぞれの実行結果（成功ログ / エラー全文）を集めた検証ログ一式。
- 「できた」と言える完了条件:
  1. `node app.ts` がフラグなしで実行でき、標準出力に期待した文字列が出る。
  2. `enum` / `namespace(値)` / パラメータプロパティ / 拡張子なし import の4種類で、`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` などのエラーを**実際に踏み**、エラー全文を保存できている。
  3. 型エラーのある `.ts` が `node` では素通りし、`npx tsc --noEmit` でだけ検出されることを実行ログで示せる。
  4. `tsx app.ts` と `node app.ts` の起動時間を計測して比較表にできる。
- 完了確認の方法: すべて **CLI 出力＋終了コード（`echo $?`）** で判定。ブラウザ表示は発生しないため Playwright は不要（画面確認タスクなし）。
- 記事タイトル案（そのまま使える形）:
  1. 「`node app.ts` が普通に動く時代になったので、tsx を卒業できるか新人が試した」
  2. 「Node のネイティブ TypeScript、どこまで動いてどこで詰まる？を全部踏んでみた（エラー全文つき）」
  3. 「新人が `node app.ts` で最初に踏む地雷5個と、結局どう運用するか」

## 事前準備チェックリスト

- [ ] 認証・APIキー: 不要。ネットワーク接続も `npx tsc` / `npx tsx` の初回取得以外は不要。課金・サインアップは一切なし。
- [ ] ローカル環境（言語・ランタイム・バージョン）: Node.js。**24.12 以上（推奨は最新の 24 LTS or 26 系）**を用意。`node -v` でバージョンを控える。24.12 未満なら stable ではないため警告が出る／挙動が違う点も記録対象。
- [ ] インストールするもの: 追加インストールは原則不要。比較用に `tsx`（`npx tsx` で都度取得可）、型チェック用に `typescript`（`npx tsc`、5.7 以上推奨）を使う。グローバルインストールは不要。
- [ ] 無料枠 / コストの確認: 完全無料。従量課金・レート制限の概念なし。
- [ ] 記録用の準備: 作業ディレクトリ `node-native-ts-lab/` を作成。`logs/` に各コマンドの出力を `>` / `2>&1 | tee` で保存。`node -v` / `npx tsc -v` のバージョンも `logs/versions.txt` に残す。

## 実践タスク（フェーズ別）

### フェーズ1: 事前調査（目安: 30分）

- [ ] Node.js 公式 `Modules: TypeScript`（`typescript.html`）と Learn「Running TypeScript Natively」を開き、(a) 既定化バージョン (b) 非対応構文の一覧 (c) 型チェックしない旨 (d) import 拡張子の必須ルール、の4点をメモする（目安: 15分）
  - 記録すること: 一次情報のURL、公式が挙げる「非対応構文」の原文リスト、「型チェックは行わない」の一文の引用。記事の「はじめに」「詰まった点」の裏付けになる。
- [ ] 手元の `node -v` を確認し、「既定（22.18+）」「stable（24.12/25.2+）」のどちらの領域かを判定する（目安: 5分）
  - 記録すること: `node -v` の出力。自分の環境が実験フラグ不要かどうか。バージョンが低い場合に必要なフラグ（`--experimental-strip-types`）。
- [ ] この検証で「試すこと」を箇条書きで確定する（最小実行 / 非対応構文4種 / 型エラー非検出 / tsx比較）（目安: 10分）
  - 記録すること: 検証項目リスト。記事の目次の下書きになる。

### フェーズ2: 環境構築（目安: 40分）

- [ ] `mkdir node-native-ts-lab && cd node-native-ts-lab` で作業ディレクトリを作り、`logs/` を作成する（目安: 5分）
  - 記録すること: ディレクトリ構成。
- [ ] `node -v`・`npx tsc -v`（初回はDL確認プロンプトに `y`／非対話なら `npx -y tsc -v`）を `logs/versions.txt` に保存する（目安: 10分）
  - 記録すること: 各バージョン出力。`npx` の初回取得プロンプトの挙動（非対話実行では `-y` が要る点）。
- [ ] 最小の `app.ts` を作る（型注釈つきの関数を1つ書き `console.log` する）（目安: 10分）
  ```ts
  // app.ts
  function greet(name: string): string {
    return `hello, ${name}`;
  }
  console.log(greet("node native ts"));
  ```
  - 記録すること: 書いたコード全文。
- [ ] `node app.ts` を実行し `hello, node native ts` が出ることを確認、出力を `logs/01-run-ok.txt` に保存する（目安: 15分）
  - 記録すること: 実行コマンドと標準出力、`echo $?`（=0）、警告（`ExperimentalWarning` 等）が出たか出ないか。**動いた瞬間のログ**は記事の山場。

### フェーズ3: 実装・検証【本編】（目安: 120分）

- [ ] `enum` を含む `bad-enum.ts` を作り `node bad-enum.ts` を実行、`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` を踏んでエラー全文を `logs/enum.txt` に保存する（目安: 20分）
  ```ts
  // bad-enum.ts
  enum Color { Red, Green, Blue }
  console.log(Color.Red);
  ```
  - 記録すること: エラーメッセージ**全文**、終了コード、エラーが指す行。なぜ enum が「消せない構文（実行時コード生成が要る）」なのかを一次情報の言葉でメモ。
- [ ] 値を持つ `namespace` を含む `bad-namespace.ts` で同様にエラーを踏み `logs/namespace.txt` に保存する。あわせて **type-only namespace は動く**ことも別ファイルで確認する（目安: 20分）
  ```ts
  // bad-namespace.ts（値を持つ→エラー）
  namespace App { export let x = 1; }
  console.log(App.x);
  ```
  ```ts
  // ok-namespace.ts（型だけ→動く）
  namespace TypeOnly { export type A = string; }
  const a: TypeOnly.A = "ok";
  console.log(a);
  ```
  - 記録すること: 両者のエラー/成功ログ。「namespace が全部ダメ」ではなく「値を持つ namespace だけダメ」という**誤解しやすい境界**。
- [ ] パラメータプロパティ（`constructor(private x: number)`）を含む `bad-param-prop.ts` でエラーを踏み `logs/param-prop.txt` に保存する（目安: 15分）
  ```ts
  // bad-param-prop.ts
  class Point { constructor(private x: number, private y: number) {} }
  console.log(new Point(1, 2));
  ```
  - 記録すること: エラー全文。新人が「普通に書きがち」な構文が落ちる点を強調。
- [ ] 拡張子なし import（`import { x } from './util'`）と、`import` した型を `type` キーワードなしで書いたケースでエラー/挙動を確認し `logs/import-ext.txt` に保存する（目安: 20分）
  ```ts
  // util.ts
  export const version = "1.0.0";
  export type Id = string;
  // main.ts
  import { version } from "./util";      // ✗ 拡張子なし → エラー。'./util.ts' が必要
  import { Id } from "./util.ts";        // ✗ 値としてimport → 実行時エラー。import type が必要
  console.log(version);
  ```
  - 記録すること: 「拡張子必須」「型は `import type` 必須」という、tsx/bundler 慣れした人がハマる差分のエラー全文。修正後（`./util.ts` ＋ `import type`）で動いたログも残す。
- [ ] 型エラーのある `type-error.ts`（例: `const n: number = "str";`）を作り、`node type-error.ts` は**素通りで実行される**ことと、`npx tsc --noEmit type-error.ts` で**だけ**エラーになることを対比して `logs/type-check.txt` に保存する（目安: 25分）
  - 記録すること: 「node は型を見ない（whitespace 置換のみ）」の実証ログ2本。運用結論「実行=node / 型チェック=tsc --noEmit（またはエディタ/CI）」の根拠。**記事の核心**。
- [ ] `.tsx` ファイル（`app.tsx`）を作って `node app.tsx` を実行し、`.tsx` が非対応であることを確認して `logs/tsx-unsupported.txt` に保存する（目安: 20分）
  - 記録すること: エラー全文。React 系新人が「なぜ `.tsx` が動かないか」を先回りできるネタ。

### フェーズ4: 深掘り・比較（目安: 30分）

- [ ] 同じ `app.ts` を `node app.ts` と `npx tsx app.ts` の両方で複数回実行し、起動時間を計測して比較表を作る（`time` コマンド、各3回・中央値）（目安: 20分）
  ```bash
  for i in 1 2 3; do /usr/bin/time -p node app.ts; done 2>&1 | tee logs/time-node.txt
  for i in 1 2 3; do /usr/bin/time -p npx tsx app.ts; done 2>&1 | tee logs/time-tsx.txt
  ```
  - 記録すること: 各 real 時間、初回と2回目以降の差（npx キャッシュの影響）、node と tsx のカバー範囲の違い（tsx は enum 等も動く＝トランスパイルしている）。恣意的に盛らず素直な結果を書く。
- [ ] 「node で動くもの / 動かないもの」を1枚の対応表にまとめる（構文 → node結果 → tsx結果 → 回避策）（目安: 10分）
  - 記録すること: enum / 値namespace / 型namespace / パラメータプロパティ / decorators / 拡張子なしimport / .tsx / 型エラー、の可否一覧。記事のまとめ表になる。

### フェーズ5: 振り返り・記事化準備（目安: 30分）

- [ ] `logs/` を見返し、詰まった点・所要時間の見積もり差を棚卸しする（目安: 15分）
  - 記録すること: 見積もり vs 実測、想定外に詰まった箇所、一番驚いた挙動。
- [ ] 「記事への写像」に沿って本文ドラフトの見出し（6本）に各 `logs/*.txt` を割り当てる（目安: 15分）
  - 記録すること: どのログがどの見出しに入るかの対応メモ。

> 目安時間の合計: 約 3 時間 50 分（30+40+120+30+30）。半日（3〜4時間）の想定内。超えそうなら本編のうち `.tsx`（フェーズ3最後）を削って短縮できる。

## 詰まりそうなポイントと対処の指針

| # | 詰まりそうな点 | なぜ起きるか | 最初に試すこと | 記事での活かし方 |
|---|---|---|---|---|
| 1 | Node バージョンが古く `node app.ts` が動かない / 警告が出る | 既定化は 22.18+、stable は 24.12・25.2+。それ未満だと要フラグ or ExperimentalWarning | `node -v` を確認。古ければ `--experimental-strip-types` を付ける／Nodeを更新 | 「必要バージョン」を冒頭で明記する導線。バージョンで挙動が変わる注意喚起 |
| 2 | `enum` / 値を持つ `namespace` / パラメータプロパティが `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` で落ちる | type stripping は「消せる型だけ」除去。実行時コード生成が要る構文は非対応 | エラー全文を読み、その構文を避ける or tsx を使う | 「新人が最初に踏む地雷」章。エラー全文＋回避策で価値を出す |
| 3 | import で拡張子を省くと落ちる / 型を普通に import すると実行時エラー | ネイティブ実行では拡張子必須、型は `import type` 必須（bundler/tsx の暗黙補完がない） | `./x` → `./x.ts` に直す、型は `import type` に変える | tsx/webpack 慣れした人が一番ハマる差分として強調 |
| 4 | 型エラーがあるのに `node` で普通に動いてしまい「型チェックされた」と誤解 | node は型を見ず whitespace 置換するだけ | `npx tsc --noEmit` を別途回す運用を確認 | 「実行=node / 型チェック=tsc」の運用結論。記事の核心 |
| 5 | `npx tsc` / `npx tsx` 初回でDL確認プロンプトが出て非対話実行が止まる | npx が未取得パッケージを対話確認する | `npx -y tsc ...` のように `-y` を付ける | headless/CI で動かす人向けの小ネタとして添える |

## 記録テンプレ（実行中に埋める）

各タスクを実行しながら、以下を都度メモする。これがそのまま経験談の一次情報になる。

- 実行したコマンド:
- 出たエラー（全文）:
- 効いた解決方法 / 試したこと:
- 所要時間（見積もり → 実測）:
- つまずいた理由・分かっていなかった前提:
- 既存技術（tsx / ts-node / bundler）と比べて感じた違い:
- スクショ/ログを保存した箇所（`logs/*.txt`）:
- 記事に書きたい気づき:

## 記事への写像（タスク → 見出し）

出典レポートの「記事構成案」（候補#1）に対応させる。実行後、右列の記録を左の見出しに流し込む。

| 記事の見出し | 対応するタスク / 記録 | 書くこと |
|---|---|---|
| 1. はじめに（tsx/ts-nodeを入れてた前提） | フェーズ1・前提 / 動機 | なぜ今ネイティブTSを試すか、自分のこれまで（tsx利用） |
| 2. Node で `node app.ts` を動かす（最小例） | フェーズ2（最小 app.ts・01-run-ok.txt） | セットアップ手順・動いた瞬間のログ・使ったNodeバージョン |
| 3. 詰まった点集（enum/namespace/param prop/拡張子/.tsx） | フェーズ3（enum/namespace/param-prop/import-ext/tsx の各ログ） | エラー全文と原因、回避策、誤解しやすい境界 |
| 4. 型エラーは検出されない → tsc の運用 | フェーズ3（type-check.txt） | node素通り vs tsc --noEmit の対比ログ |
| 5. tsx との比較（起動速度・カバー範囲） | フェーズ4（time-*.txt・可否対応表） | 計測値の比較表、node と tsx の使い分け |
| 6. まとめ：新人が今から始めるなら | フェーズ5の棚卸し | 向いている人・運用結論・バージョン注意 |

## 経験談として書くときのコツ

- 「新人が試した範囲」を明示し、専門家として断定しすぎない（RC/バージョン依存を正直に書く）。
- うまくいった点だけでなく、詰まった点とエラー全文・解決過程を書く。
- 実行ログ・コマンド・コードをそのまま貼る（要約しない）。エラーは全文。
- Node.js 公式ドキュメントへのリンクを入れる。
- 再現性のため **検証した Node バージョン（`node -v`）・OS・TypeScript バージョン**を必ず明記する。

## 参考リンク

- 公式ドキュメント: Node.js「Modules: TypeScript」 https://nodejs.org/api/typescript.html （非対応構文・import拡張子必須・型チェックしない旨・バージョン履歴）
- チュートリアル / クイックスタート: Node.js Learn「Running TypeScript Natively」 https://nodejs.org/en/learn/typescript/run-natively （`node app.ts`・`--experimental-strip-types`・`tsc --noEmit`・TS 5.7+ 推奨）
- 関連記事・既知の詰まりポイント: 出典レポート `research/search-topic-20260705-0212.md` の候補#1、および `tsx`（比較対象ランナー）の README。

## 想定リスク・注意点

- コスト（無料枠の範囲・課金トリガー）: なし。完全無料・認証不要・ローカル完結。
- ライセンス / 規約: Node.js / TypeScript / tsx はいずれもOSS。検証用途で問題なし。
- セキュリティ（APIキーの扱い等）: APIキー・秘密情報を扱わない。ログに機微情報は入らない（バージョン文字列とエラーのみ）。
- 撤退ライン: 手元の Node が 22.18 未満で更新もできない場合はフラグ運用（`--experimental-strip-types`）に切り替えて続行。それも不可なら Node を用意できる環境（`nvm` / Docker `node:24` イメージ）で再実行する。1時間以上バージョン起因で進まなければ Docker に切り替える。

## 次のアクション

- [ ] フェーズ1から順に着手する
- [ ] 記録テンプレを埋めながら進める（`logs/*.txt` を都度保存）
- [ ] 完了条件（最小実行OK / 非対応4種のエラー全文 / 型非検出の対比 / tsx比較表）を満たしたら「記事への写像」に沿って本文ドラフトへ展開する（`/run-practice` → `/draft-article`）
