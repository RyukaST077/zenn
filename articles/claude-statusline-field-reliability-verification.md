---
title: "claude -p のヘッドレス実行でstatusLineは一度も発火しなかった検証記録"
emoji: "🔇"
type: "tech"
topics: ["claudecode", "cli", "cicd", "observability", "aiagent"]
published: false
---

Claude Codeの `statusLine` ドキュメントを読んで、CI/CDの `claude -p` パイプラインにコスト表示やworktree判定用のカスタムスクリプトを組み込もうとしていないだろうか。ドキュメントのトリガー一覧（セッション開始/再開、新しいアシスタントメッセージ、`/compact`、権限モード変更、vimモード切り替え、`refreshInterval`、レート制限/キャッシュ失効のティック）はすべて対話型TUIの語彙で書かれており、`-p` には一切触れていない。手元のTeamプラン認証セッション（`claude 2.1.263`）で2026-09-08に検証したところ、`claude -p` 実行では **`statusLine` コマンドは一度も発火しなかった** ——元の作業ディレクトリでも、`git worktree add`（Claude Code自身の `--worktree` ではなく）で手動作成したディレクトリの中でも同じ結果だった。したがって、ヘッドレスパイプラインでコスト・レート制限・worktree識別情報を `statusLine` に依存させてはならず、代わりに `--output-format json` の `result` オブジェクトを読むべきである。

この記事がカバーする決定は次の1点に絞られる。**自分の実行環境（プラン種別・対話か`-p`か・worktreeの作り方）で、statusLineのどのフィールドに安全に依存できるか、依存できない場合は何を代わりに読むべきかを、ドキュメントの記述を鵜呑みにせず実測にもとづいて決める**——これは本検証がanalytics側の記事登録時点で立てていた読者向けの判断軸そのものであり、以下の実測結果はこの軸に沿って提示する。

## 起きうる失敗モード

`statusLine` はインタラクティブなターミナルセッションのライフサイクルに紐づけて設計されている。もし読者がこの前提を知らずに「ヘッドレスCIでもインタラクティブと同じようにJSONが飛んでくるはずだ」と仮定してコスト/使用量ダッシュボードを組んだ場合、そのダッシュボードは実行するたびに黙って更新されない——エラーも出ず、ログも残らないため、原因究明が難しい失敗モードになる。今回の検証はこの仮定が誤りであることを、公式ドキュメントの沈黙から推測するのではなく、実際にキャプチャしたJSONの件数で確認する。

## 設計原則: statusLineはTUIのライフサイクルイベント専用

出典（source research reportで引用）によれば、statusLineの発火トリガーはすべて対話セッションの状態遷移に関するものであり、`-p` のような非対話実行についての記述はドキュメント中に存在しない。同じ出典は、`workspace.git_worktree` は「any git worktreeで populate される」一方、`worktree.name`/`worktree.path`/`worktree.branch` は「セッションがworktreeセッションである間のみ present」と書き分けている。この2つ目の書き分けが、手動 `git worktree add` ディレクトリで実際にどう振る舞うかを検証したのが今回のケース2である。

## 最小構成: 検証に使ったキャプチャ用の設定

以下は両ケースで使われた、依存なしで再利用できるキャプチャ用ペアである（両ケースとも `verifier_exit_code: 0` で正常に動作したことを確認済み）。

`.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node statusline-capture.mjs"
  }
}
```

`statusline-capture.mjs` は、stdinで受け取ったペイロードをそのまま連番とISOタイムスタンプ付きで `statusline-log.jsonl` に追記するだけのスクリプトである。この構成は「0件」という結果も含めて有効な診断結果を返すため、ハーネス自体の不具合ではなく実際の観測事実として扱える。

```javascript
#!/usr/bin/env node

// Reusable statusLine capture script (the reader-facing takeaway artifact).
// Appends every stdin payload Claude Code sends this command to a local
// JSONL log, with a sequence number and capture timestamp, then prints a
// trivial status text. No network, no credentials, no external state.

import fs from "node:fs";
import path from "node:path";

const logPath = path.join(process.cwd(), "statusline-log.jsonl");

let raw = "";
try {
  raw = fs.readFileSync(0, "utf8");
} catch {
  raw = "";
}

let payload = null;
let parseError = null;
if (raw.trim() !== "") {
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    parseError = String(error.message);
  }
}

const previousCount = fs.existsSync(logPath)
  ? fs.readFileSync(logPath, "utf8").split(/\r?\n/).filter((line) => line.trim() !== "").length
  : 0;

const entry = {
  seq: previousCount + 1,
  captured_at: new Date().toISOString(),
  parse_error: parseError,
  payload,
};
fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
process.stdout.write("statusline-capture: ok\n");
```

両ケースとも同一の起動引数で `claude` バイナリ（`$HOME/.local/share/claude/versions/2.1.263`）を呼び出している。

```text
claude -p ... \
  --output-format stream-json --verbose \
  --no-session-persistence \
  --setting-sources project \
  --permission-mode bypassPermissions \
  --tools Read,Edit,Write,Bash
```

（`manual-worktree-capture` のみラッパーが `--max-turns 6` を追加し、cwdを新規 `git worktree add` ディレクトリへ差し替えている。）

## 挙動検証: 2ケース・同一プロンプトでの実測

タスクはどちらも「`input.txt` を1回読み、`output.txt` に検証用文字列 `READY\n` を1回書く」という同一の共有プロンプトで、認証済みセッションを1回ずつ実行した。

| ケース | 実行方式 | agent終了コード | verifier終了コード | 観測マーカー | 期待マーカーと一致 |
|---|---|---:|---:|---|---|
| `headless-capture`（元のcwd） | direct | 0 | 0 | `statusline-headless:silent\|rate_limits:na\|session_name:na` | 一致 |
| `manual-worktree-capture`（手動worktree） | fixture-wrapper | 0 | 0 | `worktree-statusline:silent` | 不一致（ただし事前登録済みの競合候補どおり） |

`manual-worktree-capture` 自身の `worktree-probe.json` は `statusline_entries: 0` を記録しており、`workspace.git_worktree`/`worktree.*` の4つの真偽フィールドはすべて `null` だった。両ケースとも `protected_paths_changed: []`・`unexpected_changes: []`・`timed_out: false` で、タスク自体（ファイルの読み書き）は問題なく完了しており、ハーネスや権限まわりの不具合ではない。

このリポジトリの記事登録時点で立てていた検証項目と、実際に得られた結果は次の4つである。

| 検証項目 | 実測結果 |
|---|---|
| Teamプラン認証セッションで、初回API応答後に `rate_limits`（five_hour/seven_day）が出現するか | **moot（判定不能）** — `headless-capture` でstatusLineが一度も発火しなかったため、フィールドの有無を確認する前提自体が成立しなかった |
| `claude -p` の非対話実行でstatusLineコマンドが発火するか、発火しない場合 `--output-format json` の `result` オブジェクトが代替できるか | **発火しない**（0件）。`result` オブジェクトを代替として読む方針は、本検証のケース設計上の推奨であり、本ケース自体は `result` オブジェクトの中身を直接検証してはいない |
| `git worktree add` で手動作成し `--worktree` を使わずに入ったディレクトリで、`workspace.git_worktree` は埋まるが `worktree.name`/`path`/`branch` は空のままか | **未到達** — この手動worktreeの実行でもstatusLineは0件で、ドキュメントが書き分けているフィールドの片方も出力されていない。ドキュメントの書き分けが正しいか誤りかを判定する材料自体が得られなかった |
| `session_name` がAI生成タイトルで埋まるタイミング（何ターン目か、`-p` 実行では最後まで出現しないか） | **moot（判定不能）** — 同じ理由でstatusLineが一度も発火しなかったため観測不能 |

「0件」自体は本検証がキャプチャに失敗した結果ではなく、`preflight.json`（オフラインのフェイクCLIで同じラッパー/verifier経路を事前にリハーサルし、`worktree-fields:doc-consistent` という期待マーカーどおりに再現できていた）によって、キャプチャ経路自体は正しく機能していたことが裏付けられている。つまり、認証済み実行時にだけ挙動が変わった。

## この結果がなぜ実務に効くか

ヘッドレスの `-p` パイプラインの上にコスト/使用量ダッシュボードを、対話型ターミナルと同じ前提で構築すると、そのダッシュボードは実行するたびに静かに更新されなくなる。今回の検証は、その具体的な理由（statusLineが `-p` では発火しない）と、代わりに読むべき対象（`--output-format json` の `result` オブジェクト）を、ドキュメントの沈黙からの推測ではなく実測で示している。

**実務での判断ルール**: `claude -p` を呼び出すパイプラインでは（元のcwdでも手動 `git worktree add` ディレクトリでも）、コスト・使用量・worktree識別情報のいずれについても `statusLine` の出力に機能をゲートしてはならない。かわりに `--output-format json` の `result` オブジェクトをパースする。このルールは、同一の引数契約下での2件の独立した「0件」観測に支えられているが、手動worktreeで `workspace.git_worktree` と `worktree.*` の書き分けがドキュメントどおりかどうかは、statusLineが発火しない限り検証できないため未解決のまま残る。

## 安全境界（この検証が言えないこと）

- 1台のマシン・1つの日付・1つのTeamプランアカウント・`claude 2.1.263` での各ケース1サンプルのみであり、アカウント種別・プラン・バージョンをまたぐ統計的な主張ではない。
- `rate_limits` と `session_name` の有無（検証項目1・4）は「moot（該当なし）」としか言えない。対話実行や `--agent` 実行でこれらのフィールドが現れるかどうかは、この検証からは分からない。
- 検証項目3（`workspace.git_worktree` vs `worktree.*` の書き分け）は、当初想定した形では検証できていない。「手動worktree実行でstatusLineが0件だった」という、より弱い事実だけが観測結果である。
- `manual-worktree-capture` のラッパーによるcwd差し替えと `--max-turns 6` の追加は、`-p` モードそのものとは別の、切り分けられていない交絡要因として記録されている——手動 `git worktree add` という操作単体が沈黙の原因だと断定することはできない。
- モデルのオーバーライドは `null` で、アカウントのCLIデフォルトが解決したモデルを使用しており、特定のバックエンドスナップショットが固定されているわけではない。
- マニフェストの `network: false` はCodexサンドボックス経由でのみ強制されており、ホスト側の `claude` プロセスに対するOSレベルのネットワーク隔離を保証するものではない。
- 上記コマンド例に含まれる `--permission-mode bypassPermissions` は、`Read,Edit,Write,Bash` に制限された使い捨てのfixtureワークスペース内でのみ実行されたものであり、読者自身のリポジトリで再現する際に推奨する起動形態ではない。

## 導入チェックリスト

1. 既存の `.claude/settings.json` に `statusLine` を設定していても、`claude -p` を使うCI/CDジョブのコスト・使用量・worktree情報の取得元には**しない**。
2. 上記の `result` オブジェクトを、`--output-format json`（または `stream-json` の最終イベント）から読む経路に切り替える。
3. `statusLine` を対話型セッション（通常のターミナル利用）でのコスト表示用途に限定して使う分には、今回の検証結果は影響しない——今回の沈黙はあくまで `-p` 実行時の観測である。
4. 自分の環境で同じ前提（プラン種別・Claude Codeバージョン・worktreeの作り方）が異なる場合は、上記の `statusline-capture.mjs` と同じ「stdinペイロードを連番付きで追記するだけ」のスクリプトで、まず自分のマシンで0件かどうかを再現確認してから依存する。
