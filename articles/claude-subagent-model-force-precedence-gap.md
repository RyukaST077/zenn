---
title: "CLAUDE_CODE_SUBAGENT_MODELだけではpin済みsubagentのモデルを変えられない"
emoji: "🧭"
type: "tech"
topics: ["claudecode", "anthropic", "ai", "llm", "devops"]
published: false
---

## 結論から: 環境変数だけでは足りない

`.claude/agents/*.md` にコスト重視のカスタムsubagentを `model: sonnet` で固定し、CIや共有devcontainerで `CLAUDE_CODE_SUBAGENT_MODEL=haiku` をexportしている場合、それだけでは狙い通りにコストを抑えられません。

Claude Code 2.1.257で実際に検証したところ、`model:` frontmatterで明示的にモデルを固定したsubagentは、`CLAUDE_CODE_SUBAGENT_MODEL` を設定しただけでは上書きされず、frontmatter側のモデル(この例ではsonnet系)がそのまま使われました。追加で `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`(2.1.257以降)を設定すればfrontmatterより環境変数が優先されるはずですが、今回の実行ではその半分を確認できる証跡が得られませんでした(検証器が失敗し、「動かなかった」のか「単に証跡が取れなかった」のか切り分けられない状態)。

古いコミュニティ記事の多くは2.1.251より前の「`CLAUDE_CODE_SUBAGENT_MODEL` は常に上書きする」という挙動を前提に書かれています。その情報を信じてコストの上限として運用していると、pin済みsubagentは気づかないまま元の(高価な)モデルで動き続けます。この記事はその齟齬を、再現可能な手順とともに示します。

## 設計思想: なぜfrontmatterが勝つように変わったのか

公式changelog(https://code.claude.com/docs/en/changelog 、2026-09-02アクセス)によると、v2.1.251で `CLAUDE_CODE_SUBAGENT_MODEL` の役割が変更され、「subagentのデフォルトモデルを設定するだけ」になりました。subagent自身の `model:` frontmatterやspawn時の明示的な指定がある場合は、そちらが優先されます。v2.1.257では `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` が追加され、これを設定すると frontmatterやspawn時指定に関わらず全subagentが `CLAUDE_CODE_SUBAGENT_MODEL` に強制されるとドキュメント化されています(公式docs: https://code.claude.com/docs/en/sub-agents 、同アクセス日。forkや `model: inherit` のskillは対象外という注記あり)。

つまり設計上は「個別に明示指定したモデルを、環境変数ひとつで不用意に上書きしない」という安全側の優先順位になっています。ただし公式ドキュメントはこの優先順位を宣言的に説明するだけで、読者が自分の環境で確認できる手順は提供していません。

## 最小構成での検証

検証はCLIバージョン `2.1.257 (Claude Code)` で行いました。両ケースで共通のsubagent定義 `.claude/agents/model-probe.md` を使い、frontmatterに `model: sonnet` を明示しています。変えたのは環境変数の組み合わせだけです。

| ケース | `CLAUDE_CODE_SUBAGENT_MODEL` | `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` |
|---|---|---|
| soft-env | `haiku` | 未設定 |
| force-env | `haiku` | `1` |

観測方法は、トップレベルの `Agent` ツール呼び出しIDに一致する子イベントを `claude -p --output-format stream-json` のストリームから抽出し、その `message.model` フィールドを読む、というものです。この抽出ロジック自体はsoft-envケースで正しく動作したことが確認できています。

## 観測結果

### soft-env: frontmatterが勝った(確認された)

`CLAUDE_CODE_SUBAGENT_MODEL=haiku` のみを設定した状態で、subagentは `model: sonnet` frontmatter通りにsonnet系モデルで応答しました。

- 検証器の終了コード: `0`
- 観測されたマーカー: `SUBAGENT_MODEL_SONNET_FRONTMATTER`
- 子イベントの `message.model`: `claude-sonnet-5` を含む文字列

これは事前登録していた「claim holds」の期待通りの結果です。`CLAUDE_CODE_SUBAGENT_MODEL` を設定しただけでは、pin済みsubagentのモデルは変わりません。

### force-env: 確認できなかった(未確定、失敗ではない)

`CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` を追加したケースでは、`Agent` ツール呼び出しは正しく `model-probe` にルーティングされ、子イベントも1件転送されました。しかし、その子イベントに完了マーカーのテキストも `message.model` フィールドも含まれていませんでした。

- 検証器の終了コード: `1`
- 検証器のstderr: `verification failed: the subagent did not return its completion marker`
- 観測された `message.model`: `null`

エージェント自体の終了コードは `0` で、認証エラーやサービス障害、タイムアウトは記録されていません。ハーネスは正常に動いていますが、意味のある観測(モデル名の抽出)に失敗しました。考えられる説明はいくつかありますが、いずれも今回の記録データだけでは切り分けられません。

- `_FORCE` 下でsubagentが小さい/別のモデルへリダイレクトされ、`--max-turns 4` の制約内でマーカー行に到達する前に応答が終わった
- 捕捉された子イベントが最終ターンではなく、テキストを持たない中間ターン(ツール利用など)だった
- `_FORCE` 特有のレスポンス形状があり、抽出ロジックがそれを想定していなかった

計画段階でこの失敗パターンは「inconclusive(未確定)」として事前に分類されており、検証器は「マーカーが確認できなければ成功と扱わない」設計です。したがってこの結果は、`_FORCE` が動かないことの証拠でも、動くことの証拠でもありません。

## この結果が意味すること

確認できたのは以下の1点だけです。

> `model:` frontmatterで明示的にモデルを固定したsubagentに対して、`CLAUDE_CODE_SUBAGENT_MODEL` を設定しただけでは、そのモデル指定は変わらない。

確認できなかったのは以下の点です。

> `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` を追加すれば確実にfrontmatterを上書きできるかどうか。

この記事は前者を再現可能な形で示すことが目的であり、後者について「動く」とも「動かない」とも主張しません。1ケースのみの実行であり、`_FORCE` 側のマーカー消失が再現性のある挙動なのか、単発の事象なのかも未確認です。fork、teammate、workflow agent、ネストしたsubagent、`model: inherit` のsubagent、他のCLIバージョンへの一般化もできません。

## 実践への当てはめ

- pin済みsubagentのモデルにハードな上限をかけたいなら、`CLAUDE_CODE_SUBAGENT_MODEL` を設定するだけでは不十分だと前提を変える。
- `_FORCE=1` を使う場合は、自分の環境・自分のsubagent定義で下記の再現手順を使って実際にモデルが切り替わることを自分で確認する。今回のようにマーカーが取れない場合、それ自体が「未確認」というシグナルであり、成功のサインとして扱わない。
- 古いコミュニティ記事(2.1.251より前の「常に上書きする」という説明)を根拠にコストや権限の上限運用を設計しない。

## 再現手順(付録)

- `claude -p --output-format stream-json --tools Agent --max-turns 4` でエージェントを起動し、トップレベルの `Agent` ツール呼び出しIDに一致する `parent_tool_use_id` を持つ子イベントから `message.model` を抽出する。
- subagent定義は `model:` frontmatterを明示したものを使う(例: `model: sonnet`)。
- `CLAUDE_CODE_SUBAGENT_MODEL` および `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` の値だけを変え、他の条件(subagent定義、プロンプト、`--max-turns` など)は固定する。
- 各ケースはクリーンな一時ディレクトリで実行し、事前にfake-CLIでの疎通確認(プリフライト)を通してから本番実行する。
- 実行前後の差分を確認し、意図した出力ファイル以外に変更がないことを確認する。
- 検証は「完了マーカー文字列」と「`message.model` フィールド」の両方が観測できて初めて成立とみなし、どちらか欠けた場合は「未確定」として扱い、成功・失敗のどちらとも判定しない。

## 検証環境

- Claude Code: `2.1.257 (Claude Code)`
- 検証日: 2026-09-02
- 各ケースはサンプル数1回のみの実行(ケースごとの繰り返し試行なし)
- ネットワーク設定 `false` はサンドボックス側の強制であり、Claudeホストプロセス自体をOSレベルで隔離するものではない

## 参考

- Claude Code changelog: https://code.claude.com/docs/en/changelog
- Sub-agents docs: https://code.claude.com/docs/en/sub-agents
