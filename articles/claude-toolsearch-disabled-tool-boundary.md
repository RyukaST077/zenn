---
title: "ToolSearchは「無効化されたツール」を救わない: Claude CodeのTodoWrite境界"
emoji: "🧭"
type: tech
topics: ["claudecode", "agent", "cli", "automation", "llm"]
published: false
---

## 結論から: `ToolSearch(select:TodoWrite)` を先に呼んでも直らない失敗がある

Claude Code のスキル・サブエージェント・プラグインを書いていて、`claude -p`(ヘッドレス実行)のスクリプトやフックから `TodoWrite` を呼びたくなったことはないでしょうか。呼んだら失敗し、「`ToolSearch` で先に検索すれば直るのでは」と考えるのは自然です。ツール検索(tool search)がデフォルトで有効な環境では、非コアの組み込みツールは名前だけがリストされ、実際に呼び出す前に `ToolSearch` でスキーマを読み込む必要がある、という契約が公式ドキュメントに書かれているからです。

しかし、Claude Code `2.1.248`(サブスクリプション認証)を `claude -p --no-session-persistence --setting-sources project --permission-mode bypassPermissions` という具体的なヘッドレス構成で検証したところ、`TodoWrite` は **`ToolSearch` を先に呼んでも呼ばなくても同一の「このセッションでは無効」エラーで失敗する**ことが、決定的なトランスクリプト証拠として記録されました。これは「未検索だから使えない」ではなく、「そもそも無効化されている」ケースであり、`ToolSearch` は救済策になりません。

この記事は `TodoWrite` 1ツール・このヘッドレス構成1パターンに限定した検証結果です。一般化はできませんが、「`ToolSearch` を挟めばどんな `No such tool` エラーも直る」という前提でフォールバック設計をしていると、この種の失敗クラスを取りこぼします。

## なぜ気になるのか: 検証前の想定

ツール検索の設計原則は次の2点です。

- Agent SDK のツール検索ドキュメントは、ツール検索がデフォルトで有効であり、名前だけが提示された遅延ツール(deferred tool)は使う前に検索が必要だと述べています。また「SDK は `Bash` / `Read` / `Edit` のようなコア組み込みツールを常に事前ロードし、検索の閾値にカウントしない」とも明記しています([Agent SDK: Tool search](https://code.claude.com/docs/en/agent-sdk/tool-search))。`TodoWrite` はこのコア除外リストには含まれていません。
- Messages API 側のドキュメントも、モデルは一度も提示されていないスキーマに対して `tool_use` ブロックを構成できない、つまり「検索前に呼ぶ」ことは API レベルで構造的に起こり得ない、としています([Tool search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool))。

この2つを素直に読むと、「`TodoWrite` を検索せず直接呼べば失敗し、`ToolSearch(select:TodoWrite)` を先に呼べば成功する」という一往復の回復パターンが期待されます。今回の検証計画も、この期待される結果ペア(`direct_call_deferred_validation_error` → `search_then_call_succeeded`)を事前登録した上で、対抗する結果(`search_then_call_still_failed`、「`ToolSearch` 単体を保証された回復策とみなすべきではない」という結論に転換する結果)も明示的に用意していました。

## 検証したこと

同一のヘッドレス起動オプションで2ケースを実行し、実際の `claude` バイナリ(`2.1.248`)の生トランスクリプトから呼び出し順序とエラーテキストを機械的に抽出しました。

| ケース | 手順 | 目的 |
| --- | --- | --- |
| `direct-call-no-search` | `ToolSearch` を挟まずに `TodoWrite` を1回だけ直接呼ぶ | 未検索状態での失敗形を記録する |
| `search-then-call` | 先に `ToolSearch(select:TodoWrite)` を1回呼び、その後 `TodoWrite` を呼ぶ | 検索後に回復するかを記録する |

両ケースとも同じ実行形状を使っています。

```
-p <prompt> --max-turns 6 --output-format stream-json --verbose \
  --no-session-persistence --setting-sources project \
  --permission-mode bypassPermissions
```

`--tools` は省略し、CLI のデフォルトツールカタログとデフォルトのツール検索挙動をそのまま使っています。判定は決定的なベリファイア(`verify.mjs`)が、タイムアウト・認証/サービス障害・不正なストリーム行・認証情報を含む環境変数名の混入がないこと、ケースごとの呼び出し順序が正しいこと、分類結果が事前登録された結論群のいずれか(「未確定」ではない)であることを確認したうえでマーカーを書き込む形で行っています。

## 観測結果: 検索してもエラー文言が変わらない

`direct-call-no-search` では、未検索の `TodoWrite` 呼び出しが次のエラーを返しました。

```
<tool_use_error>Error: No such tool available: TodoWrite. TodoWrite is disabled for this session, in subagents as well as here.</tool_use_error>
```

`search-then-call` では、`ToolSearch(select:TodoWrite)` 自体はエラーなく完了しました(もしエラーだったら、ベリファイアの分類ロジック上 `tool_search_call_failed` として扱われ、今回の結論には至りません)。しかし、その直後の `TodoWrite` 呼び出しは、**一字一句同じ**「disabled for this session, in subagents as well as here」というエラーテキストを返しました。

両ケースとも `agent_exit_code: 0`、ベリファイア `exit 0`、対応するマーカー(`DIRECT_CALL_EVIDENCE_CAPTURED` / `SEARCH_THEN_CALL_EVIDENCE_CAPTURED`)が一致し、保護対象パスへの変更はゼロ、許可された成果物ファイル以外の変更もありませんでした。

事前登録との比較で言うと、`direct-call-no-search` は期待されたパターン(`direct_call_deferred_validation_error`)に一致しましたが、`search-then-call` は「期待される回復」ではなく、計画側が名指しで用意していた対抗パターン(`search_then_call_still_failed`)に一致しました。これは架空の「驚き」ではなく、計画自体が「これが起きたら推奨を反転させる」と明記していた分岐です。

## 解釈: 「未検索」と「無効化」は別の失敗クラス

記録されたエラー文言は "disabled for this session"(このセッションで無効)であり、"schema not yet loaded"(スキーマ未ロード)や検索状態に言及するものではありません。`ToolSearch` 自体はエラーなく完了しているため、最も証拠に整合する解釈は次の通りです。

- `TodoWrite` は、この実行コンテキスト(`-p` ヘッドレス、`--no-session-persistence`、`--setting-sources project` の組み合わせ)において、そもそも無効化されている。
- `ToolSearch` がツール名を解決できても、無効化されたツールを呼び出し可能にはしない。
- これは、クレームが前提としていた「名前だけの遅延(pending-search deferral)」とは別のメカニズムである。

未検証の代替説明として、この無効化が `--permission-mode bypassPermissions` 固有のものか、`--setting-sources project` のスコープに起因するものか、あるいはヘッドレス実行全般に起因するものかは、今回のケース間でこれらのフラグを独立に変えていないため区別できません。

## 実務への適用: フォールバック設計をどう変えるか

`claude -p` の自動化スクリプトやフックで `TodoWrite` のようなセッション/タスク追跡的な振る舞いが必要な場合:

1. **「`No such tool` は `ToolSearch` で直る」という前提でフォールバックを書かない。** 防御的に `ToolSearch(select:<name>)` を挟んでも、無効化されたツールには効きません。
2. **エラーテキストで失敗クラスを判別する。** "disabled for this session" という文言は `ToolSearch` では直せない失敗です。一方、スキーマ未ロードや検索状態に言及する文言であれば、検索による回復が期待できる可能性があります(今回はこのケースを記録していません)。
3. **無効化系のエラーには別のタスク追跡手段を用意する。** `ToolSearch` を1ターン消費して待つのではなく、無効化を検知した時点で代替ロジックに切り替える設計にします。

## 適用範囲と限界

- 検証したのは `TodoWrite` という1つのツール、`2.1.248`(サブスクリプション認証)という1バージョンのみです。他の非コア組み込みツールや MCP 提供ツールへの一般化はできません。
- 各ケース1サンプルのみで、「無効化」エラーメッセージの再現性(実行間のばらつき)を排除する反復は行っていません。
- 記録された証拠は呼び出し順序・エラーテキスト・件数などのパース済み情報のみで、生トランスクリプトそのものは保存されていません。`ToolSearch` のツール結果自体の正確な文言(「スキーマなし」なのか他の表現なのか)は、エラーとして分類されなかったこと以上には検証できません。
- この無効化がヘッドレス `-p` モード、`--permission-mode bypassPermissions`、`--setting-sources project` のどれに起因するかは、すべて固定して実行したため切り分けられていません。
- マニフェストの `network: false` は Codex 側のワークスペースサンドボックスにのみ適用され、Claude ホストプロセス自体を OS レベルで隔離するものではありません。

「`ToolSearch` を挟めば `TodoWrite` を含むあらゆる組み込みツールの `No such tool` エラーが直る」と一般化すること、対話セッションなど他の実行形状でも `TodoWrite` が無効だと主張すること、今回切り分けていない根本原因(ヘッドレスモード/権限モード/設定ソース)を特定できるかのように述べることは、いずれも今回の証拠が支持しない範囲です。

## 参考

- [Agent SDK: Tool search](https://code.claude.com/docs/en/agent-sdk/tool-search)
- [Tool search tool (Messages API)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
