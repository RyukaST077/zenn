---
title: "claude --model はチーム共有のsettings.jsonに勝つか？ v2.1.248で検証"
emoji: "🎛️"
type: "tech"
topics: ["claudecode", "cli", "config", "llm", "ai"]
published: false
---

チームの `.claude/settings.json` に `"model": "sonnet"` を固定コミットしているリポジトリで、一時的に別モデルを試したいとき `claude --model opus` を付けるだけで本当に切り替わるのか——それとも設定ファイルの値が静かに優先されて、気づかないままsonnetのセッションを回し続けることになるのか。

結論から言うと、手元のClaude Code **v2.1.248** では `--model opus` がプロジェクトの `.claude/settings.json` の `"model": "sonnet"` に勝ち、実際にopusでセッションが開始した。これは公式ドキュメントが示す優先順位どおりの挙動であり、後述する過去バージョンでの逆転バグ報告とは異なる結果である。

## なぜこの確認が必要だったか

Claude Codeの公式ドキュメント（[code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config)、2026-08-30時点で参照）は、モデル選択の優先順位を次のように明記している。

```
/model（セッション内） > --model（起動時） > ANTHROPIC_MODEL > settings.jsonのmodelフィールド > ANTHROPIC_DEFAULT_MODEL
```

一方で、第一者（Anthropic自身）が管理するGitHub issue `anthropics/claude-code#42901`（2026-04-03オープン、報告時バージョン2.1.91、2026-08-30時点で参照）では、これと逆の挙動——`--model` や `ANTHROPIC_MODEL` よりも設定ファイルの `model` が勝ってしまい、設定ファイルを直接編集しない限り反映されなかった——が報告されている。

つまりドキュメントは「意図された」優先順位を書いているだけで、手元のバイナリが実際にそれを実装しているかどうかは別問題になる。共有設定ファイルを持つチームの開発者にとって、これを事前に確認しておかないと、意図しないモデルで気づかず作業してしまうか、逆に不要に共有ファイルを編集・差し戻す手間が発生するリスクがある。

## 検証した設定と方法

今回検証したのは次の1パターンのみ。

- プロジェクトの `.claude/settings.json`: `{"model": "sonnet"}`
- 起動フラグ: `--model opus`
- 読み込み範囲: `--setting-sources project`（プロジェクト設定のみを対象にし、ユーザー/組織設定との混在を排除）

実行したコマンドの骨子（実際に記録されたもの）:

```bash
claude -p "Reply with exactly the single word ok. Do not use any tools." \
  --output-format stream-json --verbose --no-session-persistence \
  --setting-sources project --permission-mode bypassPermissions \
  --tools Read,Edit,Write,Bash --model opus --max-turns 1
```

判定方法は、`stream-json` 出力の `system`/`init` イベントの `model` フィールドと、最終 `result` イベントの `modelUsage` に含まれるキーを見て、どちらのモデル名（`opus`系か`sonnet`系か）が実際に使われたかを確認するというもの。設定ファイルの値を書き換えたり、CLIの内部ログを読んだりする必要はない。

## 観測結果

実行環境: Claude Code `2.1.248`。認証状態はCLIのステータスコマンドで確認済み（認証情報ファイルは直接読んでいない）。

記録された `stream-json` の解析結果は以下のとおり。

- `init` イベントの `model`: `claude-opus-5`（1件、これのみ）
- 最終 `result` の `modelUsage` キー: `claude-opus-5`（sonnet系の言及なし）
- プロセス終了コード: `0`、タイムアウトなし、認証エラー・サービスエラーなし
- 検証スクリプトは「outcomeが `flag_wins` を名乗るなら、`opus`系への言及ありかつ`sonnet`系への言及なし」という内部整合性も別途チェックしており、これも通過している

つまり、`.claude/settings.json` の `"model": "sonnet"` は無視され、`--model opus` が実際に使われたモデルを決定していた。GitHub issueが報告した「設定ファイルが勝つ」逆転現象は、この1回の検証では再現しなかった。

## この結果が意味すること・意味しないこと

観測できたのは「v2.1.248で、`opus` vs `sonnet` という組み合わせ、`--model`フラグ vs プロジェクトの`settings.json`という構図に限れば、ドキュメント通りにフラグが勝った」という事実だけである。以下は主張していない。

- **「issue #42901のバグは修正された」とは言えない**：報告時バージョン2.1.91を今回改めてテストしておらず、直接の比較ができない。バグが本当に直ったのか、それとも報告者の環境固有の組み合わせ（後述）だけで起きていたのかは区別できない。
- **`ANTHROPIC_MODEL` 環境変数や `--settings` JSONマージ、カスタム `ANTHROPIC_BASE_URL` の優先順位は未検証**：issueではこれらの組み合わせも報告に含まれていたが、今回の実験はプレーンな `--model` フラグ対 `settings.json` の構図のみをテストした。
- **他のモデルエイリアスの組み合わせやバージョンへの一般化はできない**：試したのは `opus`/`sonnet` のペア、v2.1.248の1サンプルのみ。

これは1ケース・1回のみの実行によるケーススタディであり、一般的なベンチマークではない。

## 実務での判断基準

以下の条件に当てはまる場合、`--model` フラグは信頼して使ってよいと判断できる。

- 手元のClaude Codeが v2.1.248 相当（かそれ以降で挙動が変わっていないことを別途確認済み）
- プロジェクトレベルの `.claude/settings.json` に素朴な `model` フィールドがある
- `--setting-sources project` を使っている、またはプロジェクト設定のみが対象になっている
- `ANTHROPIC_MODEL` や `--settings` JSONマージを併用していない

この条件を外れる場合——特に `ANTHROPIC_MODEL` を設定していたり、複数の `--settings` ファイルをマージしていたりする場合——は、issue #42901が報告した逆転が起こりうるかどうか、今回の検証では判断材料がない。自分の環境で確証を得たいなら、上記と同じ手順（プロジェクトの `settings.json` に自分のモデル、`--model` に別のモデルを指定し、`stream-json` の `init.model` と `modelUsage` を見る）をそのまま自分の2つのモデルエイリアスに置き換えて再現できる。

## 再現・監査のための詳細

- 検証日: 2026-08-30。CLIバージョン: `2.1.248 (Claude Code)`。
- 認証はCLIのステータスコマンドで確認し、認証情報ファイル自体は読み取っていない。
- 実行はフィクスチャ内で、実バイナリ（`$HOME/.local/share/claude/versions/2.1.248`）をラッパー経由で呼び出し、`stream-json` 出力のみを解析する形で行った。認証済みの本番実行前に、偽CLIを使ったプリフライト（`preflight: true`、偽のモデル文字列 `claude-opus-4-fixture` を使用）でラッパーと検証スクリプトの動作を先に確認しており、この記事の結果と混同されないよう明確に分離されている。
- 検証は1ケース・1回の実行のみで、繰り返し試行は行っていない。
- マニフェストの `network: false` はCodexサンドボックス側にのみ強制され、Claudeホストプロセス自体のネットワークをOSレベルで遮断するものではない（今回の結果の欠陥ではなく、実行環境の境界として記録）。

## 参考

- Claude Code公式ドキュメント: モデル設定の優先順位（`code.claude.com/docs/en/model-config`、2026-08-30アクセス）
- `anthropics/claude-code#42901`（2026-04-03オープン、報告時バージョン2.1.91、2026-08-30アクセス）
