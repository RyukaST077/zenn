---
title: "CLAUDE_CODE_TOOL_MEMORY_LIMIT はmacOSでは効かず、--debugも無言だった"
emoji: "🧯"
type: "tech"
topics: ["claudecode", "macos", "anthropic", "cgroup", "devops"]
published: true
---

## この記事で分かること

Claude Code の v2.1.233 changelog には「暴走したビルドがセッションを止めてしまわないよう、Bash ツール実行にオプトインの memory cgroup 制限を追加した（`CLAUDE_CODE_TOOL_MEMORY_LIMIT`）」と書かれています。この一文だけを読んで「Claude Code が RAM を食い尽くす問題」への対策として、シェルのプロファイルやプロジェクト設定に `CLAUDE_CODE_TOOL_MEMORY_LIMIT` を仕込んだ macOS ユーザーは少なくないはずです。

しかし、macOS/Darwin (arm64) 上で実際に Claude Code 2.1.247 を使い、`CLAUDE_CODE_TOOL_MEMORY_LIMIT=256M` を設定した状態で 256M を超える 320MiB のメモリ確保を Bash ツールから実行したところ、

- 確保は上限を超えて**成功**し、Bash ツールの結果には確保成功のマーカーがそのまま出力された
- `claude --debug` の出力（stdout+stderr 結合、大文字小文字を区別しないマッチ）には `cgroup` という文字列が**一度も現れなかった**

という結果になりました。Tools リファレンスは「Linux/WSL 限定」と明記しつつ、「cgroup のセットアップに失敗した場合は、`--debug` のログがその理由を示す」とも約束しています。今回の検証はこの後半の約束が、少なくとも macOS 上のこの実行形では成立しないことを示しています。

**実務上の結論**: macOS（あるいは Linux cgroup サブシステムを持たない任意のホスト）で Claude Code を使っているなら、`CLAUDE_CODE_TOOL_MEMORY_LIMIT` に保護効果を期待してはいけません。また `claude --debug` の沈黙を「制限がかかっている」「かかっていない」いずれの合図としても信用せず、実際のメモリ挙動は自分で検証する必要があります。

## 検証環境

- OS: macOS / Darwin, arm64（Linux cgroup サブシステムなし）
- CLI: `claude` 2.1.247 (Claude Code)
- 検証日: 2026-08-28

## 公式ドキュメントの主張

- changelog v2.1.233（2026-08-14）: "Added opt-in memory cgroup support for Bash tool commands on Linux (`CLAUDE_CODE_TOOL_MEMORY_LIMIT`) so a runaway build can't stall the session."
- Tools リファレンス: "On Linux and WSL, set `CLAUDE_CODE_TOOL_MEMORY_LIMIT` … Requires Claude Code v2.1.233 or later." および "Claude Code applies the cap with a memory cgroup. When it can't set the cgroup up, commands run without a cap, and the debug log from `claude --debug` says why."

前半の「Linux/WSL 限定」というスコープは明示されていますが、changelog の見出しだけを見た読者はそこまで読み込まない可能性があります。後半の「`--debug` がその理由を教えてくれる」という自己診断の約束は、Linux/WSL 以外のホストで cgroup セットアップがそもそも成立しない場合にも当てはまるのか、ドキュメント単体では確認できません。

## 検証手順

以下の起動レシピで、上限を超えるメモリ確保を行う Bash コマンドを 1 回だけ実行しました。

```bash
CLAUDE_CODE_TOOL_MEMORY_LIMIT=256M claude --debug \
  -p "<Bash で 320MiB を確保して触ってから成功マーカーを出力する単一の指示>" \
  --output-format stream-json --verbose \
  --no-session-persistence --setting-sources project \
  --permission-mode bypassPermissions --tools Bash --max-turns 2
```

判定は次の2点で行いました。

1. Bash ツールの結果テキストに確保成功マーカーが含まれるか（＝上限超えの確保が実際に成功したか）
2. `--debug` の stdout+stderr を結合した全体から、大小文字を区別せず `cgroup` という文字列を検索できるか（＝ドキュメントが約束する自己診断ログが出ているか）

この2軸から、事前に3つの排他的な結果を定義していました。

- `doc-matches-reality`: 確保は成功し、かつ `--debug` に cgroup 関連の理由説明が出る
- `silent-gap`: 確保は成功するが、`--debug` に説明が一切出ない
- `unexpected-enforcement`: macOS にもかかわらず確保自体が失敗する（ドキュメントの前提が崩れる）

計画段階で本命として置いていた期待値は `doc-matches-reality` でした。`silent-gap` は「あり得る対抗仮説」として明示的に事前登録されていましたが、本命ではありませんでした。

## 観測結果: silent-gap

実行結果は次の通りです（`case-result.json` より）。

- `alloc_succeeded: true`
- `alloc_bytes_reported: 335544320`（320MiB と一致）
- `debug_cgroup_reason_present: false`
- `final_result_is_error: false`
- Bash ツール呼び出し回数: 1、該当する成功マーカーを含むツール結果: 1件

上限を超える確保はそのまま完走し、Bash ツール結果に確保成功マーカーがそのまま出力されました。一方で `--debug` の combined stdout+stderr には `cgroup` の文字列がまったく含まれませんでした（`stderr.log` は空、`events.jsonl` にはラッパー自身の最終結果行のみ）。事前登録した3分岐のうち、実際に得られたのは `silent-gap` でした。

検証（`verify.mjs`）は `silent-gap` 分岐専用に、確保成功・確保バイト数の一致・`debug_cgroup_reason_present === false`・セッション全体がエラーで終わっていないこと、をすべて要求する形で書かれており、これら全項目を満たして pass しています。つまりこの pass は「何でも通る一般的な pass」ではなく、`silent-gap` という特定の結果に紐づいた合格判定です。

エージェント終了コード 0、検証スクリプト終了コード 0、想定外の変更なし、資格情報を持つ環境変数名は子プロセスに一切渡っていない（`credential_environment_names: []`）ことも確認済みです。

## 「検出ロジックが壊れているだけでは？」を排除する

`--debug` ログに `cgroup` の文字列がないことが「本当に出力されていない」のか、それとも「検出用の grep が単に壊れている」だけなのかを切り分けるため、本番実行の前に、同一の検出ロジックを、意図的に偽の cgroup 関連理由説明行を含ませた fixture（偽の CLI 出力）に対して先行実行しています。この preflight では同じロジックが正しく `doc-matches-reality`（＝ cgroup 行が存在すると判定）を返しました。

このことから、実行環境側の検出コードが cgroup 文字列を見逃しているわけではなく、本番の実行では実際にその文字列が出力されなかったと判断できます。

## 解釈と限界

- ドキュメントの「Linux/WSL 限定」というスコープ自体は、この結果とも矛盾しません（macOS で確保が制限されなかったという点では、ドキュメント通りとも読めます）。破れているのは、それに付随する「`--debug` がその理由を教えてくれる」という自己診断の約束の方です。
- 排除しきれていない可能性として、この理由説明行は今回とは異なる呼び出し方や、別のログ冗長度設定、あるいは「過去に cgroup 適用に成功していて、それが再評価される場合」など、今回の再現手順が踏んでいない条件下でのみ出力される可能性があります。今回の結果が示すのは「この通りの手順・このホスト・このバージョンでは観測されなかった」という事実であり、「あらゆる呼び出し方で cgroup 理由説明が絶対に出力されない」ということまでは証明していません。
- サンプル数は 1 回です。これは固定されたプラットフォーム上の挙動という性質上、計画・調査レポートの双方で許容される検証範囲として扱われています（run-to-run のばらつきを主張するものではありません）。
- 検出ロジックは `cgroup` という部分文字列を stdout/stderr 両方から探索しています。一次情報がどちらのストリームに出力されるかを明記していないための設計判断ですが、逆に言えば「cgroup」という文字列を含まない別表現の理由説明があった場合は、この fixture では検出できません。
- ここで検証したのは Linux/WSL への一般化ではなく、macOS/Darwin arm64 のこのホスト・このバージョン限定の挙動です。Linux/WSL 上でこの変数がどう動くかは今回の対象外です。
- 256M の上限値・320MiB の確保サイズという組み合わせのみを検証しており、他の数値の組み合わせへの一般化はしていません。

## 実務での判断ルール

macOS（または Linux cgroup サブシステムを持たない任意のホスト）で Claude Code を使っている場合:

- `CLAUDE_CODE_TOOL_MEMORY_LIMIT` を設定しても、Bash ツールのメモリ使用量が制限されることを期待しないでください。
- `claude --debug` のログに cgroup 関連の説明が出ないことを、「制限がかかっている」「かかっていない」いずれの合図としても解釈しないでください。今回の検証では、制限がかかっていない状態でもログは何も語りませんでした。
- 実際にメモリ使用量を制御したい場合は、ビルドコマンドを `ulimit` でラップする、または実際に Linux cgroup サブシステムを持つコンテナや VM の中で実行するなど、自分自身のホスト側の対策に頼ってください。
- 「本当に効いているか」を確認したいときは、今回使ったのと同じ「上限を超える確保をしてから自分でマーカーを出力する」という手法を、自分の環境で直接試すことを推奨します。ドキュメントやログの沈黙を信頼の根拠にしないでください。

## 参考: 再現・監査用の詳細

- 再現レシピ本体は上記「検証手順」のコマンド行と同一です。判定は Bash ツール結果内のマーカー文字列の有無と、`--debug` の combined 出力に対する `cgroup` の大小文字非依存マッチのみで完結します。
- CLI バージョンはコマンド実行前後で `2.1.247 (Claude Code)` に固定・一致確認済みです。
- 実行環境変数のアローリストはランナー側・子プロセス側で完全一致しており、資格情報名に該当する環境変数は子プロセスに渡っていません。
- モデル/エフォート指定は上書きしておらず、アカウントデフォルトのままです。これは CLI/環境変数/OS の挙動を検証する今回の主張にとって影響しない条件として記録されています。
- ネットワークは manifest 上 `false` として扱われていますが、これは Codex ワークスペースのサンドボックスによる制御であり、Claude 側プロセスの OS レベルのネットワーク隔離を意味しません。今回の主張には直接関係しませんが、証拠としての一般的な限界として記録します。
