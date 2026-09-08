---
title: "GPT-6 Astraの新機能・料金・API移行で確認したい変更点"
emoji: "🔭"
type: "tech"
topics: ["openai", "gpt", "aiagent", "api"]
published: true
---

OpenAI APIでエージェントを作っているなら、GPT-6 Astraへの移行では、モデル名に加えて**ツール呼び出し、推論設定、キャッシュ、課金条件**を確認する必要があります。

公式ガイドでは、Astraは複数の工程にまたがる作業に向けたモデルと位置づけられています。新機能には、ツールの結果を待ちながら別の作業を進める非同期ツール呼び出しと、実行中に追加指示を送るmid-turn steeringがあります。[公式モデルガイド](https://developers.openai.com/api/docs/guides/latest-model)

この記事では、既存のAPI実装をどこまで変更する必要があるか判断できるよう、公式資料を整理します。最後に、移行前に使えるチェック表を載せます。

:::message
調査日：2026年9月8日。公式ドキュメントの調査記事です。APIの動作・性能・レイテンシは実測していません。料金は米ドル表記で、APIの料金を扱います。ChatGPTやCodexのプラン別利用条件は対象外です。
:::

## GPT-6 Astraの基本仕様

公式モデルページで確認できる仕様は次のとおりです。

| 項目 | 仕様 |
|---|---|
| モデルID | `gpt-6-astra` |
| コンテキストウィンドウ | 1,050,000トークン |
| 最大入力 | 922,000トークン |
| 最大出力 | 128,000トークン |
| 知識のカットオフ | 2026年4月30日 |
| 入力 | テキスト、画像 |
| 出力 | テキスト |
| エンドポイント | Responses、Chat Completions、Batch |
| `reasoning.effort` | `low`、`medium`、`high`、`xhigh`、`max` |

出典：[GPT-6 Astraモデル仕様](https://developers.openai.com/api/docs/models/gpt-6-astra)

コンテキストウィンドウの数値と最大入力は異なります。また、画像入力への対応と画像の直接出力は別です。仕様上の出力モダリティはテキストで、画像生成は利用可能なツールに含まれています。[GPT-6 Astraモデル仕様](https://developers.openai.com/api/docs/models/gpt-6-astra)

OpenAIは、複雑な推論、コーディング、コンピューター操作、調査、文書作成を用途として挙げています。ただし、この位置づけだけでは、自分の業務での成功率や処理時間は決まりません。本記事では、従来モデルより何％優れるといった性能比較は行いません。[GPT-6 Astraモデル仕様](https://developers.openai.com/api/docs/models/gpt-6-astra)

## 非同期ツール呼び出しで、待ち時間中にも作業を進められる

通常の関数呼び出しでは、モデルはツールの結果を待ちます。Astraでは、関数またはカスタムツールの定義に `async: true` を付けると、結果が返る前にモデルが作業を続けられます。[Async tool calling](https://developers.openai.com/api/docs/guides/async-tool-calling)

たとえば調査エージェントなら、時間のかかる社内検索を開始してから、その結果に依存しない確認項目の整理を進める、という使い方が考えられます。これは機能から考えられる設計例で、今回の実測結果ではありません。

実装で押さえたいのは、**ツールを実行する責任はアプリ側に残る**ことです。`async: true` を設定しても、独自の関数がOpenAI側で実行されるわけではありません。アプリは処理を開始し、完了後に元の `call_id` を使って結果を返します。関数なら `function_call_output`、カスタムツールなら `custom_tool_call_output` を使います。[Async tool calling](https://developers.openai.com/api/docs/guides/async-tool-calling)

このため、導入時には「何を結果待ちにするか」に加えて、「待っている間に何を進めてよいか」を決める必要があります。検索結果を受け取る前に結論まで確定するような構成では、非同期化の意図を満たせません。

なお、レスポンス生成そのものをバックグラウンドで実行するBackground modeとは異なる機能です。[Async tool calling](https://developers.openai.com/api/docs/guides/async-tool-calling)

## 実行中の追加指示を受け取るmid-turn steering

Mid-turn steeringは、モデルの応答が終わる前に、要件の追加や方針変更を送る機能です。AstraのResponses APIで、WebSocket接続を使います。GPT-5.6以前は非対応と記載されています。[Mid-turn steering](https://developers.openai.com/api/docs/guides/steering)

たとえば「実装計画を作って」と依頼した後に、「まず1人で2週間以内に終わる範囲に絞って」と条件を追加できます。アプリは `response.created` を受け取った後、同じ接続で対象レスポンスのIDを指定して `response.steer` を送ります。[Mid-turn steering](https://developers.openai.com/api/docs/guides/steering)

運用上は、次の区別が必要です。

| 状態・操作 | 意味 |
|---|---|
| `response.steer.accepted` | 追加指示がキューに入った。適用完了ではない |
| 追加指示を含む後続レスポンス | 更新後の結果を受け取る対象 |
| すでに送信された出力・開始済みツール | steeringでは書き換え・取消しされない |

出典：[Mid-turn steering](https://developers.openai.com/api/docs/guides/steering)

そのため、UIで「変更を受け付けました」と表示する時点と、「変更後の結果ができました」と表示する時点を分ける設計が考えられます。ツールの結果や承認が必要な場合は追加指示が保留されるため、その処理も継続します。[Mid-turn steering](https://developers.openai.com/api/docs/guides/steering)

## 会話途中で推論量を変えるなら、キャッシュとの関係を確認する

Astraでは `configuration_update` という入力項目で、会話途中に推論量を変更できます。リクエスト直下の `reasoning.effort` を維持したまま更新項目を追加することで、キャッシュ用のプロンプト先頭部分を保つ仕組みです。[Reasoning：会話途中の推論設定変更](https://developers.openai.com/api/docs/guides/reasoning#change-reasoning-mid-conversation)

ただし、採用できる構成には制約があります。

| 確認箇所 | 公式に記載された条件 |
|---|---|
| 対応モード | Astraのstandard・単一エージェントモード |
| 変更できる設定 | 推論量のみ |
| 更新の有効期間 | 次の更新まで継続 |
| 自動compaction・自動truncation | 併用不可 |
| 単独の `/responses/compact` | 更新項目を含む履歴は不可 |
| 隣接する更新項目 | 連続した2つの `configuration_update` は拒否される |

出典：[Reasoning：会話途中の推論設定変更](https://developers.openai.com/api/docs/guides/reasoning#change-reasoning-mid-conversation)

さらに、レスポンスの `reasoning.effort` はリクエスト直下の値を報告し続け、更新項目で選んだ値には変わりません。推論設定を監査するアプリでは、送信した更新項目も記録する必要があります。キャッシュの通常の成立条件も引き続き適用されるため、設定変更だけでキャッシュヒットが保証されるわけではありません。[Reasoning：会話途中の推論設定変更](https://developers.openai.com/api/docs/guides/reasoning#change-reasoning-mid-conversation)

ここは「会話中の設定変更」と「実行中の追加指示」でAPIの使い方が分かれる箇所です。前者はレスポンス間の `configuration_update`、後者はWebSocketのsteeringとして整理できます。

## 料金は、長文入力とキャッシュ書き込みまで含めて見る

Standardのトークン単価は次のとおりです。単位は100万トークンあたりの米ドルです。

| 課金対象 | Astra・通常の入力長 | Astra・入力272K超 | GPT-5.6 Sol・通常の入力長 |
|---|---:|---:|---:|
| 通常入力 | $10.00 | $20.00 | $4.00 |
| キャッシュ読取 | $1.00 | $2.00 | $0.40 |
| キャッシュ書込 | $12.50 | $25.00 | $5.00 |
| 出力 | $50.00 | $75.00 | $20.00 |

出典：[API料金表](https://developers.openai.com/api/docs/pricing)、[Astraの長文課金条件](https://developers.openai.com/api/docs/models/gpt-6-astra)。Solは少なくとも2026年11月21日まで提供予定のプロモーション価格です。

入力が272Kトークンを超えると、**超過分だけでなく、リクエスト全体**に長文料金が適用されます。入力・キャッシュ料金は2倍、出力料金は1.5倍です。上限近くまで資料を詰める設計では、コンテキストに収まるかと、いくらかかるかを別々に確認してください。[GPT-6 Astraモデル仕様](https://developers.openai.com/api/docs/models/gpt-6-astra)

キャッシュについても、読取単価だけを見ると初回の費用を見落とします。GPT-5.6以降は書き込みが通常入力単価の1.25倍で、読み取りは0.1倍です。[Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching)

同じ課金対象・同じトークン数なら、上表の通常入力長でAstraの単価はSolの2.5倍です。単価差だけを相殺するには、他の条件を固定した単純計算で、Astra側の課金トークン数をSolの40％まで減らす必要があります。これは料金表からの算術であり、実際に60％削減できるという予測ではありません。

評価時は、入力・出力・キャッシュ書き込み・再試行を含めた「タスク完了までの合計費用」で比べるのがよいでしょう。ツールには別料金が発生するものもあります。また、AstraのBatch/FlexはStandardの50％、Fast modeは該当単価の2倍です。[API料金表](https://developers.openai.com/api/docs/pricing)

## 既存コードと照合する移行チェック表

以下は公式の移行ガイドと各機能の仕様を、既存コードの条件に対応させた表です。**資料で確認した変更点であり、この記事でAPIエラーや動作を再現した結果ではありません。**

| 既存コード・運用の条件 | Astra移行前に確認・変更すること | 根拠 |
|---|---|---|
| Chat Completionsでツールを呼ぶ | ツール呼び出しをResponses APIに移す | [移行ガイド](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) |
| effortが `none` / `minimal` | `low` を起点に比較。それ以外は現在の実効設定を維持して比較 | [移行ガイド](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) |
| `temperature` / `top_p` / `top_logprobs` を送る | 非対応のため削除 | [移行ガイド](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) |
| logprobsを取得する | Chat Completionsの `logprobs`、Responsesの `include` 内の `message.output_text.logprobs` を削除 | [移行ガイド](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) |
| GPT-5.5以前のキャッシュ設定を使う | `prompt_cache_retention` を `prompt_cache_options.ttl: "30m"` に置換し、書込課金も確認 | [キャッシュ仕様](https://developers.openai.com/api/docs/guides/prompt-caching#summary-of-model-differences) |
| ツールを非同期化したい | アプリ側のジョブ管理と `call_id` による結果の対応づけを実装 | [非同期ツール](https://developers.openai.com/api/docs/guides/async-tool-calling) |
| 実行中にユーザーの訂正を受けたい | ResponsesのWebSocketとsteeringの後続レスポンス処理を導入 | [Steering](https://developers.openai.com/api/docs/guides/steering) |
| 会話ごとに推論量を変える | `configuration_update` のモード・圧縮との互換性を確認 | [推論設定](https://developers.openai.com/api/docs/guides/reasoning#change-reasoning-mid-conversation) |
| EUデータレジデンシーでFastを使う | Astraでは非対応のためStandardを使う | [移行ガイド](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart) |

この表から、移行を2段階に分ける判断ができます。まず既存処理について、エンドポイントと非対応パラメータ、料金を確認する。その後、非同期ツールやsteeringを使うための制御を追加する、という順序です。新機能を同時に導入しなければ、モデル切替による変化を比較しやすくなります。

## プロンプトと評価条件も移行対象にする

公式ガイドは、Astraが指示やスキルファイルに敏感になり得ること、確認質問やテストが想定より増える場合があることを挙げています。既存の `AGENTS.md` やスキルに、曖昧な停止条件や矛盾した指示がないか見直すことも移行作業に含まれます。[公式プロンプティング指針](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)

自分のアプリでの採否を決めるなら、次のような評価シートを用意できます。これは本記事の提案で、実施済みの評価ではありません。

| 評価項目 | 比較時に記録するもの |
|---|---|
| 完了品質 | 同じ課題・受入条件で、必要な成果物を完成できたか |
| 人の介入 | 確認質問と手戻りの回数、介入が必要だった理由 |
| 費用 | 全リクエストとツール、再試行を含む合計 |
| 時間 | 開始から受入条件を満たすまでの経過時間 |
| 新機能の正しさ | 遅れて返るツール結果や途中の訂正を正しく扱えるか |

最初の比較では、プロンプト、利用ツール、受入条件、推論量、処理モード、キャッシュ状態を記録しておくと、差の原因を追いやすくなります。

Astraへの移行範囲は、上のチェック表で既存実装への影響を確認し、同じタスクでの完了品質と合計費用を測って決められます。公式仕様だけで確認できる互換性と、自分の環境で測る必要がある効果を分けて進めると、評価結果をそのまま導入判断に使えます。
