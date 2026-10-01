---
title: "Codexのモデル選び最新版：GPT-6.1 Sol・Astra・Lunaの使い分け"
emoji: "🧭"
type: "tech"
topics: ["codex", "openai", "aiagent", "cli"]
published: false
---

Codexのモデルが増えて、「普段はSolでいいのか」「Astraへ切り替えるのはいつか」「推論設定も最大にした方がいいのか」と迷う場面が増えました。

**2026年10月1日時点では、利用可能ならGPT-6.1 Solを普段の開始点にし、最も難しい仕事にGPT-6 Astra、完了条件が明確な反復作業にGPT-6 Lunaを選ぶ**、という整理ができます。これは現行の[Codexモデルガイド](https://developers.openai.com/codex/models)をもとにした選び方です。

この記事では、以前の[GPT-5.6のモデル選択記事](https://zenn.dev/clopy/articles/codex-gpt-5-6-model-guide)を、GPT-6.1 SolとAstraを含む現行の選択肢で更新します。用途別の判断表とCLI指定例をまとめ、手元で起動を確認した結果も添えます。

:::message
公式情報の確認日とCLI検証日は2026年10月1日です。起動確認はモデル指定が受理され、単一コマンドを完了するかを調べたものです。実務タスクの品質・速度・費用を比較したベンチマークではありません。
:::

## まずはこの判断表から選ぶ

| 今やりたいこと | 最初に選ぶモデル | 推論設定の開始点 |
|---|---|---|
| 普段の実装、複数ファイルの修正、作りながら調整する作業 | **GPT-6.1 Sol** | クライアントの既定。明示して比較するならMedium |
| 原因が不明な不具合、設計判断、コード・資料・アプリを横断する難しい仕事 | **GPT-6 Astra** | Light／Lowから。深さが足りなければ上げる |
| 明確な規則での変換、抽出、既存パターンに沿った小さな修正 | **GPT-6 Luna** | CodexガイドではHighから |
| 納品物の完成度や、矛盾する情報の整理が特に重要 | **SolまたはAstra** | High／Extra Highを同じ課題で比較 |
| 1つの難問に、時間と利用量をかけて考えたい | **SolまたはAstra** | 必要な場合にMax |
| 調査・実装・検証など、独立した仕事に分けられる | **Ultra対応モデル** | 利用可能ならUltra |

最初の3行は[Codexの開始設定](https://developers.openai.com/codex/models)、仕上げや複雑な判断の行は[公式のモデル選択ガイド](https://developers.openai.com/api/docs/guides/model-selection)をもとにした目安です。実装やデバッグへの当てはめは、その目安を開発作業に置き換えたものです。

この表は「常に最適な組み合わせ」ではありません。**同じ入力と完了条件で試し、必要な品質を満たす軽い設定を残す**ための出発点です。

## GPT-5.6の頃から何が変わったか

旧記事ではSol・Terra・Lunaを中心に紹介しました。今は、最新の推奨モデルと旧モデルを分けて見る必要があります。

| モデルID | 現在の選択での位置付け |
|---|---|
| `gpt-6.1-sol` | 複雑な作業を繰り返すときの、現行の推奨候補 |
| `gpt-6-astra` | 最も難しい仕事向けの最上位モデル |
| `gpt-6-luna` | 明確で大量の処理向け |
| `gpt-6-sol` | GPT-6.1 Solとは別の、以前のSolモデル |

GPT-6.1 Solは9月29日に公開されました。**AstraのモデルIDは `gpt-6-astra`、Lunaは `gpt-6-luna` のまま**です。Solの番号に合わせて他のモデルIDまで書き換える必要はありません。[API changelog](https://developers.openai.com/api/docs/changelog)

GPT-5.6のSol・Terra・Lunaも、現行のCodexガイドではロールアウト中の選択肢として残っています。Terraが使えなくなった、という意味ではありません。[Codex Models](https://developers.openai.com/codex/models)

### GPT-6.1 Solを普段の開始点にする

OpenAIはGPT-6.1 Solを、複雑なコーディング、コンピューター操作、専門的な仕事で、Astraに近い性能を低いコストで提供するモデルと説明しています。[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

この「Astraに近い」は公式の説明です。あらゆるリポジトリで同じ結果になるとこの記事で確かめたわけではありません。

開発作業なら、まず次のような仕事をSolで試す、という使い方が考えられます。

- 仕様に沿った機能追加とテストの整備
- 複数ファイルにまたがる修正
- レビューを受けながら何度か仕上げる作業

使う頻度が高いほど、1回の利用量の差が積み上がります。Solで完了条件を満たせるかを基準にすると、Astraへ切り替える理由も明確になります。

### Astraへ切り替える判断は、仕事の難しさで行う

Astraは、推論・コード・調査・コンピューター操作を組み合わせる、最も難しい仕事向けのモデルです。[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)

たとえば「原因を特定してから修正方針を決める」「相反する要件から設計を選ぶ」のように、途中で何度も判断が必要な仕事が候補になります。

Solの出力を評価するときは、単に文章やコードが長いかではなく、**制約を守っているか、原因の説明が証拠と一致するか、テストで完了を確認できるか**を見ます。その基準を満たさない場合に、同じ課題をAstraで比較する、という運用です。

これは用途への当てはめであり、今回その難しい仕事を両モデルへ解かせて比べた結果ではありません。

### Lunaには、良い結果の形が分かる仕事を渡す

Lunaは、抽出・分類・変換・構造化した要約など、明確で繰り返しやすい仕事向けです。[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)

開発で試すなら、「置換する名前」「対象ファイル」「変更しない範囲」「確認コマンド」を指定できる小さな修正が候補です。

Lunaだから推論設定も最低にする、と決めつける必要はありません。**CodexガイドではLunaの開始点をHighとしている**一方、APIのLunaの既定値はMediumです。製品の推奨設定とAPIの既定値は別です。[Codex Models](https://developers.openai.com/codex/models)、[GPT-6 Luna API仕様](https://developers.openai.com/api/docs/models/gpt-6-luna)

## モデル・推論・並列処理・速度を分けて調整する

モデルを選んだ後も、設定には別々の役割があります。

| 調整するもの | 変えるもの |
|---|---|
| Astra／Sol／Luna | モデルの能力と利用単価 |
| Low／Medium／High／Extra High／Max | 選んだモデルが考える量 |
| Ultra | subagentへ仕事を分ける並列処理 |
| Standard／Fast／Ultrafast | 対応するモデルの処理速度の設定 |

モデル間で同じ推論設定が同じ深さになるとは限りません。公式ガイドも、世代をまたいだ推論設定の対応は厳密ではないと説明しています。[Codex Models](https://developers.openai.com/codex/models)

### MaxとUltraは、使う理由が違う

**Max**は、1つの難しい課題へ多くの推論時間を使う設定です。**Ultra**は、複雑な課題をsubagentへ分けて進めます。GPT-6 LunaはMaxまでで、Ultraには対応していません。[Max／Ultraの説明](https://developers.openai.com/codex/models)

分割できない小さな修正をUltraにしたり、十分に解けている仕事をMaxにしたりする前に、完了条件に対して何が不足しているかを確認します。

APIを使う場合も区別が必要です。GPT-6.1 Solの `reasoning.effort` は `low`・`medium`・`high`・`xhigh`・`max`で、`none` と `minimal` は非対応です。CodexのUltraをそのままAPIのeffort値として転記しないでください。[GPT-6.1 Sol API仕様](https://developers.openai.com/api/docs/models/gpt-6.1-sol)

### UltraとUltrafastも別の機能

FastやUltrafastは、仕事の分割ではなく速度の設定です。

CodexでFastを使うと、対象モデルのサブスクリプションに含まれる利用枠はStandardの**2.5倍**、購入クレジットやEnterpriseの従量利用は**2倍**のレートで消費されます。これは速度が2.5倍になる、という意味ではありません。[Speed](https://learn.chatgpt.com/docs/agent-configuration/speed)

AstraのUltrafastは、Codexで出力トークン生成がStandardより最大8倍速くなると説明されています。ただし、調査・コマンド実行・テストまで含む総完了時間が8分の1になるという意味ではありません。

2026年10月1日時点では、Codex／WorkのUltrafastはPro $500と対象のEnterprise／Edu向けです。**GPT-6.1 SolはStandardとFastに対応し、Ultrafast対応は今後**とされています。[Ultrafastの提供条件](https://learn.chatgpt.com/docs/agent-configuration/speed)、[GPT-6.1 Solの提供条件](https://developers.openai.com/codex/models#gpt-6.1-sol)

## CLIで選ぶ前に、版と利用可能なモデルを確認する

起動中のCLIでは `/model` からモデルと推論設定を選べます。起動時に明示する公式の指定方法は、たとえば次の形です。[モデルの指定](https://developers.openai.com/codex/models)、[設定リファレンス](https://learn.chatgpt.com/docs/config-file/config-reference)

```bash
# 普段の開始点
codex --model gpt-6.1-sol -c 'model_reasoning_effort="medium"'

# 難しい仕事を比較する候補
codex --model gpt-6-astra -c 'model_reasoning_effort="low"'

# 明確な反復作業
codex --model gpt-6-luna -c 'model_reasoning_effort="high"'
```

これは通常の対話CLIを起動する指定例です。下の起動確認では、同じモデル・推論指定を `codex exec` へ渡しました。

GPT-6.1 Solのローンチ対象にはPlus・Pro・Business・Enterprise・Eduが含まれます。Free／Goはローンチ対象外で、Enterprise／Eduでは管理者の有効化も必要です。契約だけでなく、クライアントとロールアウト状況にも依存します。[GPT-6.1 Sol availability](https://developers.openai.com/codex/models#gpt-6.1-sol)

### 手元の旧CLIでは失敗し、更新版では起動できた

同じChatGPTログイン、同じ `node write-marker.mjs` の実行を指定して確認しました。

| モデルと推論設定 | CLI | 結果 |
|---|---|---|
| GPT-6.1 Sol／Medium | 0.157.1 | HTTP 400。コマンドは実行されず |
| GPT-6 Astra／Low | 0.157.1 | コマンド完了、marker生成 |
| GPT-6 Luna／High | 0.157.1 | コマンド完了、marker生成 |
| GPT-6.1 Sol／Medium | 0.159.2 | コマンド完了、marker生成 |

最初のSolの実行では、モデルのmetadataが見つからない警告と、次のエラーが出ました。

```text
The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.
```

その後、グローバルに入っているCLIを変えず、npmの一時キャッシュから0.159.2を呼び出す追加確認では成功しました。公式changelogには、0.159.1でGPT-6.1 Solを組み込みモデルカタログへ追加したことも記載されています。[CLI changelog](https://learn.chatgpt.com/docs/changelog)

したがって、このエラーが出たら、プランの問題だと即断する前に `codex --version` とCLIの更新状況を確認する価値があります。ただし、検証は各条件1回で時刻も異なるため、全アカウントで更新だけにより解決するとは断定できません。

### 起動確認を再現する最小例

空の検証ディレクトリに、次の `write-marker.mjs` を置きます。Node.jsとログイン済みのCodex CLIが前提です。

```js
import fs from 'node:fs';
fs.writeFileSync('verification.txt', 'MODEL_SELECTION_OK\n');
```

そのディレクトリから次を実行します。これは普段使いの起動例とは別に、ユーザー設定の影響を減らす検証用コマンドです。

```bash
codex -a never exec --ephemeral --ignore-user-config --ignore-rules \
  --sandbox workspace-write --skip-git-repo-check -C . \
  -c sandbox_workspace_write.network_access=false --json \
  -o ../model-selection-result.txt --model gpt-6.1-sol \
  -c 'model_reasoning_effort="medium"' \
  'Run exactly one shell command: node write-marker.mjs. Do not run any other command, use any other tool, read or edit any other file, or delegate any work. Then reply OK.'
```

Astraを確認するときはモデルを `gpt-6-astra`、effortを `low` へ、Lunaなら `gpt-6-luna`、`high` へ変更します。各モデルは新しい検証ディレクトリで実行してください。`-o` は検証ディレクトリ外に最終応答を保存する指定です。

markerの内容は、検証ディレクトリで次のコマンドから独立に確認できます。

```bash
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; assert.equal(fs.readFileSync("verification.txt", "utf8"), "MODEL_SELECTION_OK\n");'
```

今回の成功ケースでは、agentの終了コードと独立したmarker検証がともに0で、fixtureの変更は `verification.txt` だけでした。ログの保存先はfixture外です。`network_access=false` は生成されるシェル処理への設定で、モデルへ接続するホスト側の通信は必要です。

ここで分かるのは、指定が受理されて処理を完了したことです。バックエンドのsnapshotや推論量、実務での品質までは確定できません。

## 料金は、CodexのクレジットとAPIを分けて読む

CodexをChatGPTログインで使う場合と、自分のAPIキーで使う場合では課金方式が異なります。APIのドル単価を、そのままサブスクリプションの残り回数へ換算することはできません。

### CodexのStandardクレジット単価

次は公式に掲載されている、**100万トークンあたりのStandardクレジット単価**です。[Codex Pricing](https://learn.chatgpt.com/docs/pricing#token-rates)

| モデル | 入力 | キャッシュ済み入力 | 出力 |
|---|---:|---:|---:|
| GPT-6.1 Sol | 50 | 2.5 | 250 |
| GPT-6 Astra | 250 | 25 | 1,250 |
| GPT-6 Luna | 2.5 | 0.25 | 12.5 |

キャッシュを使わず入力・出力が同じ量なら、AstraはSolの5倍、SolはLunaの20倍の単価です。ただし、**1つの仕事を終えるまでの利用量の比率**ではありません。モデルによってトークン量や追加のやり取りが変わるためです。

また、これはクレジット課金の表であり、サブスクリプションの利用枠を単純な回数に換算する表ではありません。Business／Enterprise／Eduは契約に対応したレート表も確認してください。[料金と契約の説明](https://learn.chatgpt.com/docs/pricing)

### APIのStandard単価

APIキー利用では、次のAPI料金を見ます。**入力が272Kトークン以下のリクエスト、Standard、100万トークンあたりの米ドル**です。[API Pricing](https://developers.openai.com/api/docs/pricing)

| モデルID | 入力 | キャッシュ済み入力 | 出力 |
|---|---:|---:|---:|
| `gpt-6.1-sol` | $2.00 | $0.10 | $10.00 |
| `gpt-6-astra` | $10.00 | $1.00 | $50.00 |
| `gpt-6-luna` | $0.10 | $0.01 | $0.50 |

長い入力、キャッシュ書き込み、Fast／Ultrafastなどには別条件があります。この表だけで実務の1タスクの料金を見積もったり、Codexの利用枠と比べたりしないようにします。

## 自分の仕事で、選び方を固める

最後は、いつも行う代表的な仕事を1つ選び、同じ開始状態と完了条件で試すと判断しやすくなります。[公式ガイド](https://developers.openai.com/api/docs/guides/model-selection)も、同じ入力で比較することを勧めています。

次の表をコピーし、まずSolで基準を作ります。曖昧な判断が足りなければAstra、規則が明確ならLunaを比較候補にします。別々の作業ディレクトリを同じ状態から用意し、前のモデルの修正結果を次へ渡さないようにします。

| 評価すること | 作業前に決める基準 |
|---|---|
| 正しさ | 通すテスト、再現しなくなる不具合 |
| 制約 | 変更対象、変更しない範囲 |
| 仕上がり | レビューで許容できる修正量 |
| 待ち時間 | 調査・実行・テストまで含む総完了時間 |
| 利用量 | CLIやアプリで確認できる使用量。同じ単位で記録 |

1回でモデルの優劣を決めるためではなく、**自分の完了条件を満たす開始設定を見つける**ための表です。モデルと推論と速度を一度に変えず、1つずつ変えると、何が結果に効いたかを見直しやすくなります。
