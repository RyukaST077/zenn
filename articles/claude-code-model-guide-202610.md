---
title: "Claude Codeのモデル選び最新版：Sonnet 5.5・Opus 5.5・Haiku・Fableの使い分け"
emoji: "🎛️"
type: "tech"
topics: ["claudecode", "anthropic", "aiagent", "cli"]
published: false
---

Claude Codeで結果が物足りないとき、モデルをOpusへ変えるべきか、Sonnetのeffortを上げるべきか。この二つは、改善したい問題によって使い分けます。

**日常の実装ならSonnet 5.5／Mediumを開始候補にし、判断の難しい仕事はOpus 5.5、長時間任せる難題はFable 5.1、単純な抽出や分類はHaiku 4.5を比較する**、という整理ができます。これは公式の用途説明を開発作業へ当てはめた目安です。[Claude Academyの選択ガイド](https://academy.claude.com/tutorials/choosing-the-right-claude-model)

この記事では、最新モデルの判断表、CLIの指定例、モデル変更とeffort変更を分けるチェック表をまとめます。設定を自分の仕事へ当てはめるための記事です。

:::message
情報の確認日と検証日は2026年10月1日です。Sonnet 5.5・Opus 5.5・Haiku 4.5では、指定したモデルで単一コマンドが完了することを確認しました。用途・料金・設定仕様は公式情報に基づきます。各モデル1回の起動確認であり、性能比較ではありません。Fableの実行は検証していません。
:::

## 用途から、モデルと開始設定を選ぶ

| 今やりたいこと | 比較するモデル | Claude Codeでの開始設定 |
|---|---|---|
| 普段の実装、デバッグ、リファクタリングを小刻みに進める | **Sonnet 5.5** | Medium |
| 原因や設計を深く考え、やり取りしながら方針を詰める | **Opus 5.5** | Medium |
| 多くの手順がつながる難題を、長時間任せて完成させる | **Fable 5.1** | 既定のHigh |
| 抽出、分類、短い要約など、正解の形が明確な処理 | **Haiku 4.5** | effort指定なし |

用途の区分は[Claude Academy](https://academy.claude.com/tutorials/choosing-the-right-claude-model)、開始設定は[Claude Codeのモデル設定](https://code.claude.com/docs/en/model-config#adjust-effort-level)に基づきます。とくにFableは、Opusで試しても要求を満たさない難しい仕事が比較候補になります。

この表のSonnet開始案は、日常の開発で待ち時間と利用量を見ながら進めたい場合の目安です。**全プランの既定モデルがSonnetという意味ではありません。**アカウントや組織設定で既定は変わり、APIの汎用的なモデルガイドは「迷ったらOpus 5.5から」と案内しています。[API Models overview](https://platform.claude.com/docs/en/models/overview)

Sonnetで完了条件を満たせる仕事まで、常にFableへ渡す必要はありません。一方、長い仕事を細切れにして何度も指示する手間が大きいなら、Fableでその仕事を任せられるかを評価する理由があります。

## うまくいかないとき、先に変えるものを決める

モデルを変える前に、結果が不足した理由を分けます。

| 観察したこと | 次に試す変更 |
|---|---|
| 必要な仕様やファイルを渡していなかった | 入力と作業範囲を補う |
| 関連ファイルを読まず、テストを省き、途中で戻ってくる | 同じモデルのeffortを上げて比較する |
| 必要な材料を持ち、十分に試しても判断や修正が誤る | より能力の高いモデルで同じ課題を比較する |
| 結果は十分だが、利用量や待ち時間が大きい | effortを下げるか、軽いモデルで完了条件を満たすか試す |
| 認証や利用権のエラーで処理を始められない | 認証・プラン・組織の許可を確認する |

「検証を省いたならeffort、十分試しても誤るならモデル」という分け方は、Anthropicの[Claude Code向け解説](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)に基づきます。入力不足を補う行と、運用エラーの行は、その判断を実際の開発手順へ当てはめたものです。

effortは考える時間だけを変えるものではありません。公式説明では、読むファイルの量、検証する量、途中で利用者へ戻るまでに進める範囲にも関わります。**テストを通して完成させてほしい仕事と、まず案を見て自分で方向を決めたい仕事では、欲しい進め方も違う**ということです。

ただし、effortを上げればテストの実行や正解が保証されるわけではありません。完了条件はプロンプトに書き、結果から確認します。

## 5.5への更新では、以前のeffortをそのまま引き継がない

2026年9月28日にSonnet 5.5、9月22日にOpus 5.5が公開されています。モデルIDはそれぞれ `claude-sonnet-5-5`、`claude-opus-5-5` です。[Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)、[Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview)

名前が似ていても、Claude CodeとAPIの既定effortには差があります。

| モデル | Claude Codeの既定 | APIの既定 |
|---|---|---|
| Sonnet 5.5 | **Medium** | **High** |
| Opus 5.5 | Medium | Medium |
| Fable 5.1 | High | High |
| Haiku 4.5 | effort非対応 | effort非対応 |

Code側は[モデル設定](https://code.claude.com/docs/en/model-config#adjust-effort-level)、API側は[Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)、[Opus](https://platform.claude.com/docs/en/models/opus-5-5/overview)、[Fable](https://platform.claude.com/docs/en/models/fable-5-1/overview)、[Haiku](https://platform.claude.com/docs/en/models/haiku-4-5/overview)の仕様を参照しています。保存済みの設定や組織の制限がある場合は、それも確認してください。

CodeでSonnet 5.5をMediumにすることと、APIでeffortを省略することは同じ条件になりません。

また、同じHighという名前でも、モデル間で同じ推論量になるとは限りません。公式docsもeffortの尺度はモデルごとに調整されると説明しています。旧OpusでHighを使っていた場合も、Opus 5.5ではまずMediumを評価する案内です。[effortの選び方](https://code.claude.com/docs/en/model-config#choose-an-effort-level)

Lowは小さな変更や対話で方向を決める仕事、Highは検証や例外の確認が重要な仕事、XHighやMaxはさらに難しい仕事で評価する候補です。最初からMaxへ固定せず、既定で不足する点を見て調整します。

## CLIでは、エイリアスと固定IDを使い分ける

通常は `sonnet`、`opus`、`haiku`、`fable` のエイリアスでも選べます。バージョンを固定して記録したい場合は、モデルIDを明示します。[モデルの設定方法](https://code.claude.com/docs/en/model-config#model-aliases)

| モデル | この記事で扱うID |
|---|---|
| Sonnet 5.5 | `claude-sonnet-5-5` |
| Opus 5.5 | `claude-opus-5-5` |
| Haiku 4.5 | `claude-haiku-4-5-20251001` |
| Fable 5.1 | `claude-fable-5-1` |

IDは[現行モデル一覧](https://platform.claude.com/docs/en/models/overview)に基づきます。Haikuまで「5.5」にそろえる必要はありません。

エイリアスの解決先は提供先、環境変数、CLIの版で変わります。Anthropicの現行の解決先と、BedrockやFoundryなどでの解決先が同じとは限りません。FableのエイリアスもClaude apps gatewayではFable 5へ解決されるため、版を確認したいときはIDを使います。

Sonnet 5.5にはClaude Code **2.1.284以上**、Opus 5.5には**2.1.280以上**が必要です。まず `claude --version` を確認します。[CLI版とモデルの対応](https://code.claude.com/docs/en/model-config#model-aliases)

起動時の公式の指定方法を使うと、次の形になります。

```bash
# 日常の実装を評価する開始点
claude --model claude-sonnet-5-5 --effort medium

# 判断の難しい仕事を比較する候補
claude --model claude-opus-5-5 --effort medium

# 明確で軽い処理。Haikuへeffortは指定しない
claude --model claude-haiku-4-5-20251001
```

これは通常の対話CLIの指定例です。モデル選択は `/model`、effort変更は `/effort` でも行えます。[CLIリファレンス](https://code.claude.com/docs/en/cli-reference)、[effort設定](https://code.claude.com/docs/en/model-config#set-the-effort-level)

### 手元では、3モデルで単一コマンドの完了を確認した

Claude Code 2.1.284で、空の一時ディレクトリに用意したスクリプトを、各条件1回ずつ実行しました。スクリプトは `verification.txt` に固定文字列を保存するだけです。Node.jsがある環境で、次を `write-marker.mjs` として用意します。

```js
import fs from 'node:fs';
fs.writeFileSync('verification.txt', 'MODEL_SELECTION_OK\n');
```

| 試した指定 | Bashの呼び出し | marker | 独立した検証の終了コード |
|---|---|---|---|
| Sonnet 5.5／Medium | 指定コマンド1回 | `MODEL_SELECTION_OK` | 0（成功） |
| Opus 5.5／Medium | 指定コマンド1回 | `MODEL_SELECTION_OK` | 0（成功） |
| Haiku 4.5／effort省略 | 指定コマンド1回 | `MODEL_SELECTION_OK` | 0（成功） |

3件ともClaudeの終了コードは0、結果の `is_error` はfalseでした。`stream-json` の初期化イベントと結果の `modelUsage` に、表で指定したモデルIDが記録されています。別の検証スクリプトで、IDの一致、Bashが `node write-marker.mjs` の1回だけであること、ファイル内容、想定外の変更がないことを確認しました。

検証に成功したSonnetの呼び出しは次の形です。有効なClaude Codeの認証とモデルの利用権が前提です。これは単一コマンドの確認用設定です。

```bash
claude -p 'Run exactly one shell command: node write-marker.mjs. Do not run any other command, use any other tool, read or edit any other file, or delegate any work. Then reply OK.' \
  --model claude-sonnet-5-5 --effort medium \
  --output-format stream-json --verbose --no-session-persistence \
  --setting-sources "" --settings '{"fastMode":false,"ultracode":false}' \
  --strict-mcp-config --mcp-config '{"mcpServers":{}}' \
  --no-chrome --disable-slash-commands \
  --permission-mode dontAsk --tools Bash \
  --allowedTools 'Bash(node write-marker.mjs)' \
  --max-turns 3 --max-budget-usd 0.50
```

Opusの検証では `--model claude-opus-5-5 --effort medium` に置き換え、Haikuでは `--model claude-haiku-4-5-20251001` に置き換えて `--effort medium` を外しました。他の引数と入力は同じです。実行後の `verification.txt` は3件とも `MODEL_SELECTION_OK` と改行の内容になりました。

各試行は新しいディレクトリ、内部80秒・外側90秒のタイムアウトで行いました。Bashの対象コマンドだけを許可し、追加の設定・MCP・Fast・ultracodeの影響を減らしています。CLI側の予算指定は停止基準であり、サブスクリプションの利用枠や請求額の厳密な上限を保証するものとしては扱いません。

初回と再ログイン直後の試行は、いずれも `OAuth session expired and could not be refreshed` というエラーで停止しました。検証用の子プロセスへ渡す環境変数を絞りすぎており、同じ子環境では認証を読み出せていませんでした。この環境で `USER`・`LOGNAME` を復元し、子プロセス自身の認証状態を確認してから、上の3件を追加検証しました。**認証エラーをモデルの能力や非対応の証拠に数えない**ことも、設定を比較する前提になります。

この結果が示すのは、今回の環境で3つの指定が単一コマンドを完了したことです。実務の品質・速度・費用の順位、effortごとの推論量は測っていません。通常の対話CLIの指定例と、`-p` の実行確認も区別します。一時ディレクトリとツール制限はホストをOSレベルで隔離するものではなく、offline事前検査は実モデル結果へ数えていません。

## effort・Fast・ultracode・opusplanは別の選択

モデルを選んだ後の設定にも、別々の役割があります。

| 設定 | 変えるもの | 選ぶ場面 |
|---|---|---|
| effort | 推論・調査・検証をどれだけ進めるか | 同じモデルで、進め方の深さを変えたい |
| Fast mode | 対応するOpusの応答速度と料金 | 待ち時間を短くしたい対話的な作業 |
| ultracode | Claude Codeのdynamic workflowによる進行 | 本格的な仕事をworkflowとして組み立てたい |
| opusplan | 計画はOpus、実行はSonnetへ切り替える | 計画と実装でモデルを使い分けたい |

Fastは[Fast mode docs](https://code.claude.com/docs/en/fast-mode)、ultracodeとopusplanは[モデル設定](https://code.claude.com/docs/en/model-config)の説明です。今回この機能の実行は検証していません。

### Fastは、軽いモデルへの切り替えではない

Fast modeはOpus 5.5・Opus 5・Opus 4.8に対応し、Sonnet・Haiku・Fableの速度モードではありません。公式には最大2.5倍高速と説明されていますが、リポジトリ調査やテストを含む総完了時間の実測倍率ではありません。[Fast mode](https://code.claude.com/docs/en/fast-mode)

Opus 5.5のFast単価は、100万トークンあたり入力$8、出力$40です。Standardの入力$4、出力$20とは別の料金です。**サブスクリプションではusage creditsを使い、プランに含まれる利用枠の対象外**です。[Fastの料金と条件](https://code.claude.com/docs/en/fast-mode#understand-the-cost-tradeoff)

### ultracodeを、Maxの別名として扱わない

ultracodeは、モデルのeffort値そのものではなくClaude Codeのworkflow設定です。2.1.284以降では、effortの段階と分けて切り替えられます。

ただし、起動時に `--effort ultracode` と書く方法は、ultracodeを有効にすると同時にeffortをXHighへ設定します。単にworkflowだけを切り替える操作と、同じではありません。[ultracodeの設定と版による違い](https://code.claude.com/docs/en/model-config#adjust-effort-level)

CodexのUltraや、プロンプト中の `ultrathink` とも、名前だけで同じものと判断しないようにします。

## 料金は、API単価とサブスクリプションの利用枠を分ける

次はAnthropicの**Standard API料金、100万トークンあたりの米ドル**です。キャッシュの読み取りと書き込みも別です。[公式Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

| モデル | 入力 | キャッシュ読み取り | 出力 |
|---|---:|---:|---:|
| Sonnet 5.5 | $2.00 | $0.20 | $10.00 |
| Opus 5.5 | $4.00 | $0.20 | $20.00 |
| Haiku 4.5 | $1.00 | $0.10 | $5.00 |
| Fable 5.1 | $10.00 | $0.25 | $50.00 |

キャッシュ書き込み、Batch、Fast、データ処理地域、提供先による料金条件はこの表に含めていません。モデルごとに使うトークン数ややり取りの回数が違うため、単価表は1タスクを完了する費用の順位を保証しません。

とくに、SonnetとOpusの入力・出力単価は違っても、5.5のキャッシュ読み取り単価は同じです。「どの種類のトークンをどれだけ使うか」も費用へ効きます。旧世代との比較ではtokenizerの違いも確認します。[キャッシュとtokenizerの説明](https://platform.claude.com/docs/en/about-claude/pricing)

Claudeへログインして使う場合は、API単価をそのまま「あと何回使えるか」に換算しません。プランや作業内容を含む利用条件を確認します。

Fableもプランによってusage creditsへ課金される場合があり、対話モードでは選択時の表示や同意を確認できます。一方、**`-p` の非対話実行では、その追加課金の同意を尋ねません。**Fableを自動化へ組み込む前に、自分のプランでの扱いを確認します。[Fableとusage credits](https://code.claude.com/docs/en/model-config#fable-and-usage-credits)

## 自分の代表タスクで、変更する軸を一つに絞る

実務の選択を固めるには、よく行う仕事を同じ開始状態から試します。モデルが作った修正を次のモデルへ引き継がず、同じ入力と完了条件を用意します。

| 記録すること | 先に決める基準 |
|---|---|
| 正しさ | 通すテスト、不具合の再現条件 |
| 変更範囲 | 触るファイル、変えてはいけない仕様 |
| 検証の進め方 | 必要な調査やテストを行ったか |
| 仕上がり | 自分で直す量、レビューの指摘 |
| 待ち時間と利用量 | 総完了時間、同じ単位で記録できる使用量 |

まずSonnet 5.5／Medium、あるいは現在の自分の既定設定で基準を作ります。**検証を省くなら同じモデルでeffort、十分試しても解けないならモデル、必要な材料が欠けているなら入力**を変えます。

モデル・effort・Fast・workflowを一度に変えず、一つずつ同じ課題で比較すると、自分の完了条件を満たす設定を残しやすくなります。
