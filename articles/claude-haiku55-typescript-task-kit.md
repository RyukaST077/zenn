---
title: "Haiku 5.5へ任せるTypeScript保守を選ぶ：独立採点つき3課題の追試キット"
emoji: "🧪"
type: tech
topics: [claudecode, typescript, aiagent, testing, cli]
published: true
---

TypeScriptの保守をSonnetへ任せていても、次のチケットをHaikuへ回してよいかは、モデルの「完了しました」だけでは決められません。金額入力の修正なら例外の種類、テスト追加ならバグの検出力、共通化なら呼び出し元との互換性まで確認する必要があります。

**今回の条件では、decimal金額parseの修正はSonnetから始める候補、テスト追加と短い金額検証の共通化はHaikuを試す候補になりました。委任先を選ぶ軸は、独立した採点でチケットの完了条件を満たせるかです。**

2026年10月10日（JST）に、Haiku 5.5とSonnet 5.5を3課題×各3回、計18試行で比較しました。モデルにはRead/Edit/Writeだけを渡し、テストの実行と採点はモデル終了後にホスト側で行いました。自己テストと修正のループを含む通常のClaude Code開発とは条件が異なる、小規模なケーススタディです。要求effortはmediumですが実効値は欠測し、要求したturn上限と観測値にも不一致がありました。この留保を含めて結果を読みます。

持ち帰れるものは、次のコード一式です。

> バグ修正・テスト追加・6ファイルのリファクタを同条件で追試する全ソースと実行・採点・集計スクリプト、作業別の使い分けチェックリスト

[追試キットの全ソース（実行ログに記録された固定commit）](https://github.com/RyukaST077/zenn/tree/7c6380be43b9bf74daae0b79d8de706854686366/scripts/articles/claude-haiku55-typescript-task-kit)を入口に、自分の仕様と採点器へ置き換えられます。「同条件」は要求設定・初期状態・採点条件を揃える意味であり、実効effortや実効turn予算の一致まで保証するものではありません。

## まず、どの仕事を委任候補にするか

合格は、CLIの終了状態とは別に判定しました。課題ごとの全条件を通した候補だけを全合格に数えています。

| 課題 | 独立した完了条件 | Haiku 5.5 | Sonnet 5.5 | 今回の結果から選ぶ候補 |
|---|---|---:|---:|---|
| decimal金額parseの修正 | 型、正常値・不正入力・例外契約、安全整数範囲、変更範囲 | 2/3 | 3/3 | この仕様ではSonnetから始め、例外も採点する |
| discount関数のテスト追加 | 正しい実装が通る、固定mutation 6個を全検出、src不変 | 3/3 | 3/3 | Haikuを試す候補。件数より検出力を測る |
| 6ファイルの金額検証を共通化 | 型consumer、DTO・例外の互換性、共通関数への直接委譲、変更範囲 | 3/3 | 3/3 | 明示的なutility抽出ならHaikuも追試する |
| 測定キット | 全18試行の成否、時計、最終resultのtoken内訳を保存・再集計 | 18行を保存 | 両モデルを収録 | 不合格を残したCSV・比較表・checklistを再生成できた |

出典は実行ログ配下の各課題の`case-result.json`、`verify.log`と`kit-summary/trials.csv`です。証拠の配置は後半に記載します。

事前仮説は「parse修正は両者3/3」「テスト追加はHaikuが3/3で全mutation検出」「共通化はHaikuの合格数が少ない」でした。成立したのはテスト追加の仮説です。parse修正の同等3/3は成立せず、共通化では差を検出できませんでした。同点をモデル全体の同等性の証明にはしません。

全18試行でCLIはexit 0、最終resultはsuccessでしたが、独立採点では1件が不合格でした。記録・再採点の整合を検査する外側のverifierが通ったことも、全候補の品質合格を意味しません。

## 型が通る金額修正でも、例外契約を外すことがある

parse課題の公開仕様は、符号なしASCII十進文字列を整数centへ変換するものです。たとえば`"1.13"`は113、`"90071992547409.91"`は`Number.MAX_SAFE_INTEGER`になります。空白、符号、指数表記、先頭ゼロ、非string入力、範囲外の値は`RangeError`で拒否する契約です。

Haikuの3回目は型チェックと変更範囲の条件を通しましたが、runtime採点が不合格でした。保存された候補には次の行があります。

```ts
if (typeof value !== "string") throw new TypeError("amount must be a string");
```

公開仕様は非string入力にも`RangeError`を要求し、採点入力には`null`と`2`が含まれます。この例外種別の不一致は、不合格を説明できる具体的な差分です。ただしruntimeの結果は集約された真偽値なので、他の失敗がなかったとは断定できません。

型が`parseCents(value: string): number`でも、今回の採点は実行時の不正入力を渡します。読者のチケットに写すなら、正常な小数の変換だけでなく、入力文法・安全整数境界・例外種別を完了条件に含める必要があります。**型チェックが緑になった時点で委任を完了扱いにしない**、という判断につながります。

出典：`bug-fix/case-result.json`のHaiku repeat 3の`candidate`と`grade`、キットの[`SPEC.md`](https://github.com/RyukaST077/zenn/blob/7c6380be43b9bf74daae0b79d8de706854686366/scripts/articles/claude-haiku55-typescript-task-kit/tasks/bug-fix/SPEC.md)と[`grade.mjs`](https://github.com/RyukaST077/zenn/blob/7c6380be43b9bf74daae0b79d8de706854686366/scripts/articles/claude-haiku55-typescript-task-kit/grade.mjs)。

## テスト追加は「何件書いたか」より「何を落としたか」

テスト追加課題では正しい`discount`実装を渡し、`tests/discount.test.json`だけを変更させました。仕様は次の計算で、引数の範囲外は`RangeError`です。

```text
min(cap, floor(subtotal * percent / 100))
```

ホスト側で正実装がテストを通ることを確認したうえで、固定した6種類の誤実装へ差し替えます。誤実装をテストで落とせれば、そのmutationを検出したと数えます。

| 固定mutation | 確認したい境界 |
|---|---|
| 丸めの変更 | 小数の割引を切り捨てること |
| capを無視 | 割引額が上限を超えないこと |
| 0%の処理の変更 | 無割引の結果が0になること |
| cap=0の処理の変更 | 上限0で割引額が0になること |
| 100%の処理の変更 | 全額割引の計算と上限が守られること |
| percent=101を受理 | 許容範囲を超えた引数を拒否すること |

両モデルとも3回すべてで、正実装が通り、6/6のmutationを検出し、srcを変更しませんでした。Haikuのテスト件数は23・22・32、Sonnetは19・19・21ですが、件数の多さを品質差として採用していません。

Haikuの1回目に保存されたテストの抜粋です。

```json
[
  {"name": "rounds down fractional discount", "input": [99, 10, 1000], "expected": 9},
  {"name": "cap limits discount", "input": [1000, 50, 100], "expected": 100},
  {"name": "zero cap gives zero", "input": [5000, 20, 0], "expected": 0}
]
```

これは23件のうち3件の抜粋で、単独で6/6検出したセットという意味ではありません。全候補と検出結果は`add-tests/case-result.json`に残っています。

実務では、既存関数に回帰テストを足す仕事へ対応します。正実装を落とさず、狙った境界の誤実装を検出し、製品コードを変えないことを採用条件にできます。今回の6個を検出できたことから、未知のバグ全般への検出力までは保証できません。

## 6ファイルの共通化は、ファイル数だけで委任先を決めない

共通化課題は、cart・quote・invoice・payment・refund・ledgerにある短い金額検証を、`money.ts`の`validateCents`へ移すものです。新規ファイルを含む変更は7ファイルですが、共通関数の役割と呼び出し方は公開仕様で明示しています。

Haikuの1回目に保存された成功候補では、共通関数は次の形でした。

```ts
// src/money.ts
export function validateCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("amount");
}
```

```ts
// src/cart.ts
import { validateCents } from "./money";

export interface CartAmount { kind: "cart"; cents: number; }
export function cartAmount(cents: number): CartAmount {
  validateCents(cents);
  return { kind: "cart", cents };
}
```

両モデルの全6候補で、既存exportを使う型consumer、DTOの値と例外のruntime採点、共通validation、ASTによる構造条件、変更範囲を通しました。構造条件は、6つの呼び出し元が共通関数を直接1回呼び、重複validationを残さないことです。何も変更せず既存テストだけ通す候補を合格にしないための条件でもあります。

型consumerでは、たとえば次の契約を固定しています。

```ts
import { cartAmount, type CartAmount } from "./src/cart";
const cart: CartAmount = cartAmount(123);
const cartKind: "cart" = cart.kind;
```

出典：`refactor/case-result.json`全候補の`grade`、上のコードはHaiku repeat 1の`candidate`。consumerはキットの[`consumer.ts`](https://github.com/RyukaST077/zenn/blob/7c6380be43b9bf74daae0b79d8de706854686366/scripts/articles/claude-haiku55-typescript-task-kit/tasks/refactor/consumer.ts)の抜粋です。

この結果は、短い共通utilityの抽出で仕様・互換性・構造条件を固定できるなら、Haikuも追試候補にできることを示します。ファイル数だけを複雑さの代理にせず、曖昧な設計変更や大規模リファクタは別課題として扱います。さらに、この課題には後述のturn観測の不一致があるため、厳密に同じ実効turn予算で同点だったとも言えません。

## 時間とtokenは、品質の結果に添えて読む

下表は各行3試行の中央値と最小〜最大です。parse修正の不合格1件も集計へ含めています。

| 課題 | モデル | 外部時間：秒 中央値［範囲］ | token 4欄合計：中央値［範囲］ |
|---|---|---:|---:|
| parse修正 | Haiku | 15.078［13.077–16.790］ | 36,740［29,228–49,013］ |
| parse修正 | Sonnet | 9.268［8.486–10.596］ | 17,166［17,152–22,134］ |
| テスト追加 | Haiku | 12.749［11.646–12.780］ | 23,885［22,841–29,530］ |
| テスト追加 | Sonnet | 13.265［11.762–14.919］ | 18,060［17,951–24,009］ |
| 共通化 | Haiku | 11.425［11.168–13.867］ | 27,169［27,146–37,207］ |
| 共通化 | Sonnet | 20.035［19.990–24.460］ | 32,110［31,999–34,902］ |

時間は外部の単調時計でCLI起動直前からプロセス終了までを測った値です。独立採点まで含む`verified_elapsed_ms`は別欄に保存しています。不合格試行の時間を「正解までの時間」とは扱いません。

tokenの4欄は、最終resultの`modelUsage`にあるinput・output・cache read・cache creationです。途中messageのusageは重複合算せず、4欄を分離してCSVへ保存しました。フィールドの意味の根拠は、分析で参照した公式の[Track cost and usage](https://code.claude.com/docs/en/agent-sdk/cost-tracking)、今回の数値の根拠は`kit-summary/trials.csv`と`comparison.md`です。

今回の中央値はparse修正でSonnet側、共通化でHaiku側の時間が短く、テスト追加の範囲は重なります。Haikuのtoken合計中央値も課題により多かったり少なかったりします。これらをモデルの普遍的な速度順位へ変換する根拠はありません。

新規セッションでもcold cacheとは限りません。cache比率はCSVに残しており、累積token合計はcontext長やサブスクリプション請求額とは別です。記録された最大prompt tokenは4,669〜10,099でした。料金や残利用枠の節約率には換算していません。

## 比較を自分のチケットへ写す前に残す留保

検証時のClaude Codeは**2.1.295**、TypeScriptは**5.9.2**です。Nodeは研究時に**v22.17.0**を記録しています。モデルIDは`claude-haiku-5-5`と`claude-sonnet-5-5`を明示し、実行記録のモデルIDとも一致しました。既存のclaude.ai / firstParty / Teamサブスクリプション認証を使っています。

課題ごとに同一初期状態から開始し、H=Haiku、S=Sonnetとして順序をH/S、S/H、H/Sにしました。CLI・compilerも同一です。内側の起動では`--safe-mode`、`--setting-sources project`、`--permission-mode dontAsk`、`--tools Read,Edit,Write`、`--no-session-persistence`、`--output-format stream-json`を指定し、各試行240秒、`--effort medium`、`--max-turns 16`を要求しました。実際の組み立てはキットの[`run.mjs`](https://github.com/RyukaST077/zenn/blob/7c6380be43b9bf74daae0b79d8de706854686366/scripts/articles/claude-haiku55-typescript-task-kit/run.mjs)で確認できます。

特に委任判断へ影響する留保は次の3点です。

- **実効effortは全18件で欠測です。** 要求mediumを実効mediumで埋めていません。公式[Model configuration](https://code.claude.com/docs/en/model-config)を参照した分析でも、組織設定等による制限を留保しています。両モデルで実効条件が一致したとは証明できません。
- **要求max-turns=16と観測num_turnsが一致しません。** 共通化のHaikuは16・17・16、Sonnetは22・18・18を記録しました。いずれもCLI exit 0 / result successです。parserとverifierは`num_turns <= 16`を検査しておらず、数え方・CLI挙動・記録投影のどれが原因かは未確定です。公式[CLI reference](https://code.claude.com/docs/en/cli-reference)のフラグ説明だけでは今回の原因を決められません。
- **各モデル×課題3回、単一環境・小さなfixtureです。** 3/3は一般的な信頼性保証ではありません。Bashで自分のテスト結果を見て修正する条件や、本番・大規模変更の成績へ外挿しません。

採点器はモデル作業領域の外に置き、終了後に別ディレクトリで再採点しました。全ケースで不正な初期状態は不合格、既知正解は合格になる校正もしています。ただし独立採点も有限のoracleとmutationに対する判定で、完全性は証明していません。

イベントはtool名やusage等の投影を保存しており、内側stream全文とtool引数の完全監査はできません。保存された投影では許可外tool、MCP接続、hook・compactionは観測されませんでした。`rate_limit_event`という型はありますがpayloadを保存していないため、利用枠枯渇や無警告を断定しません。また、fixture・採点はofflineですが推論には通信が必要で、このキットはClaudeのホスト全体をOS隔離するものではありません。

## 追試キットで完了条件を固定する

キットには3課題の公開SPECと初期状態、校正用の既知正解、採点器、実行器、集計器があります。回答ファイルと独立採点器をモデルworkspaceへ渡さず、同じ仕様から作った候補を終了後に評価します。

| ファイル | 読者が使う役割 |
|---|---|
| `tasks/<課題>/SPEC.md`と初期ソース | 仕事の仕様と許可変更を固定する |
| `grade.mjs` / `verify.mjs` | 型・runtime・mutation・構造・hashを採点し、再採点と照合する |
| `run.mjs` / `contract.mjs` | モデル・prompt・要求設定を固定し、候補と計測値を記録する |
| `summarize.mjs` | 全試行をCSV・比較表・委任checklistへまとめる |
| `run-all.mjs` / `README.md` | 配布キットの一括実行入口と前提条件を確認する |

前提は既存CLI・compilerがPATH上にあり、Claudeへサブスクリプション方式でログイン済みであることです。キットは記録したCLI・compiler版を検査します。版を変える場合も比較条件の変更として記録します。

リポジトリのルートで使うoffline検査のレシピは次のとおりです。出力先には未使用のディレクトリ名を指定します。

```bash
node scripts/articles/claude-haiku55-typescript-task-kit/parser-check.mjs
node scripts/articles/claude-haiku55-typescript-task-kit/run-all.mjs --output results/haiku55-offline-new --preflight-only
```

実行ログの補記には、parser-checkの4検査と、3課題のoffline verifierが通ったと記録されています。ただしこのrunにはその独立したraw出力がないため、補記の成功記録として扱います。fake CLIによるpreflightは18件のモデル比較に加算していません。

配布READMEのlive追試入口は次です。既存プランの利用枠を消費します。

```bash
node scripts/articles/claude-haiku55-typescript-task-kit/run-all.mjs --output results/haiku55-new-run
```

**今回の18試行は元の実験runnerが実行しました。配布用`run-all.mjs`で別のlive比較を完了した記録はありません。** このコマンドは追試用に同梱された入口で、その一括実行について記録されている検査はofflineまでです。ソースの固定commitは実行ログに記録されたものを案内しており、mainへの取り込みやPRの現在状態を確認したとはしていません。

出力先が存在すれば上書きを拒否します。CLI・認証・計測・保護境界のinvalidが出た場合は停止し、再試行や課金方式の切り替えを行いません。課題別の`case-result.json`には候補コード、hash、token内訳、採点が入り、`kit-summary/`に18行CSV・比較表・checklistを出します。

自分のチケットへ置き換える際は、公開SPEC・初期状態・独立oracle・mutationを一緒に変更し、別コホートで測定します。モデルが間違えた結果はvalid failureとして残し、認証等のinvalidや時間打切りを能力不足に混ぜません。仕様へ合わなかった候補を通すために、後から例外契約や採点条件を緩めないことも重要です。

:::details 全18試行と再集計できる証拠

実行証拠のルートは、リポジトリ内の次のディレクトリです。

```text
logs/agent/run-haiku55-typescript-task-kit-20261010-0400-20261010-040058/
```

本文の`bug-fix/`、`add-tests/`、`refactor/`、`kit-summary/`はこの配下を指します。各課題の`case-result.json`に個々の候補と採点があり、`verify.log`に照合結果があります。分析は`logs/agent/analysis-haiku55-typescript-task-kit-20261010-0409.md`です。

H=Haiku 5.5、S=Sonnet 5.5。表はCSVの実行順で、時間を秒に丸めています。token欄はinput / output / cache read / cache creationの順です。

| 課題 | 試行 | 全合格 | CLI時間 / 採点込み時間：秒 | token 4欄 |
|---|---|---|---|---|
| bug-fix | H1 | ○ | 16.790 / 17.029 | 14 / 2812 / 36380 / 9807 |
| bug-fix | S1 | ○ | 8.486 / 8.729 | 8 / 925 / 11552 / 4667 |
| bug-fix | S2 | ○ | 9.268 / 9.516 | 8 / 917 / 14607 / 1634 |
| bug-fix | H2 | ○ | 15.078 / 15.317 | 12 / 2582 / 30555 / 3591 |
| bug-fix | H3 | × runtime | 13.077 / 13.319 | 10 / 2438 / 23344 / 3436 |
| bug-fix | S3 | ○ | 10.596 / 10.843 | 10 / 967 / 19260 / 1897 |
| add-tests | H1 | ○、6/6検出 | 11.646 / 11.893 | 8 / 2216 / 17724 / 2893 |
| add-tests | S1 | ○、6/6検出 | 13.265 / 13.507 | 8 / 1307 / 14610 / 2026 |
| add-tests | S2 | ○、6/6検出 | 14.919 / 15.162 | 10 / 1721 / 19729 / 2549 |
| add-tests | H2 | ○、6/6検出 | 12.780 / 13.023 | 10 / 2481 / 23549 / 3490 |
| add-tests | H3 | ○、6/6検出 | 12.749 / 12.989 | 8 / 2771 / 17724 / 3382 |
| add-tests | S3 | ○、6/6検出 | 11.762 / 12.001 | 8 / 1337 / 14610 / 2105 |
| refactor | H1 | ○ | 11.168 / 11.442 | 8 / 2787 / 19197 / 5154 |
| refactor | S1 | ○ | 24.460 / 24.733 | 10 / 3702 / 24148 / 7042 |
| refactor | S2 | ○ | 20.035 / 20.312 | 10 / 2838 / 22973 / 6178 |
| refactor | H2 | ○ | 13.867 / 14.148 | 10 / 3266 / 28272 / 5659 |
| refactor | H3 | ○ | 11.425 / 11.702 | 8 / 2827 / 19197 / 5137 |
| refactor | S3 | ○ | 19.990 / 20.262 | 10 / 2885 / 23005 / 6210 |

18件ともstatus=valid、invalid・打切りは0件です。tokenの4欄は全件で観測されました。実効effortは全件nullでCSVは空欄です。欠測を0tokenやmediumへ補完していません。

3課題の記録から集計を再生成するコマンドは、キットの`summarize.mjs`へ次の順でパスを渡す形です。実行ログの補記ではこの集計器で18行を生成し、分析では記録から再生成したCSV・比較表・checklistの一致を確認しています。

```bash
node scripts/articles/claude-haiku55-typescript-task-kit/summarize.mjs \
  logs/agent/run-haiku55-typescript-task-kit-20261010-0400-20261010-040058/bug-fix/case-result.json \
  logs/agent/run-haiku55-typescript-task-kit-20261010-0400-20261010-040058/add-tests/case-result.json \
  logs/agent/run-haiku55-typescript-task-kit-20261010-0400-20261010-040058/refactor/case-result.json \
  --output results/haiku55-summary-new
```

外側のwrapperの起動情報にはmodel=nullやBashを含む設定がありますが、内側の実際のモデル起動は明示モデルとRead/Edit/Writeです。比較条件は内側の`launch`・`observation.model_ids`から読みます。外側のadapterの成功や合格マーカーを、候補の品質の代わりには使いません。

:::

:::details 集計器が生成した使い分けチェックリストの原文

以下は`kit-summary/checklist.md`の全文です。

```markdown
# Task delegation checklist

Re-run in a fresh directory with the same compiler, CLI, published specification and independent oracle. Replace tasks and mutants before drawing conclusions about your tickets.
Recorded effort is requested medium; when the CLI does not expose effective effort, do not assert managed-policy parity. Fresh sessions do not imply cold cache. Token totals are cumulative processing, not prompt size or subscription charges.

- bug-fix: Haiku 2/3, Sonnet 3/3. Prefer Sonnet initially for this fixture condition; retain the independent oracle and inspect failed gates.
- add-tests: Haiku 3/3, Sonnet 3/3. Haiku candidate under this public specification, independent oracle and changed-path boundary; three passes are not a general reliability guarantee.
- refactor: Haiku 3/3, Sonnet 3/3. Haiku candidate under this public specification, independent oracle and changed-path boundary; three passes are not a general reliability guarantee.
```

:::

次のチケットでは、先に「何が通れば完了か」を固定してください。今回のparse修正なら例外まで採点してSonnetから開始し、テスト追加や明示的な共通化なら同じ独立採点を用意してHaikuも試す。そのうえで、品質を通した候補の時間・tokenを判断材料に加えます。両者が落ちる課題では、委任先の変更より先に仕様の分割とoracleの充実を選びます。
