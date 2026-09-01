---
title: "Claude Codeの--restrictedはPreToolUseフックも無効化する"
emoji: "🔒"
type: "tech"
topics: ["claudecode", "security", "cli", "hooks", "ai"]
published: true
---

`.claude/settings.json` に `PreToolUse` フック（例: `secret.txt` への書き込みを拒否するガード）を設定して既存のリポジトリを保護しているチームが、外部PRの説明やスクレイピングしたチケット、信頼できないサブエージェントのプロンプトなど「信頼できない入力」をClaude Codeに渡す前の追加ロックダウンとして `--restricted` フラグ（Claude Code 2.1.248で導入）を検討している状況を想定する。

CHANGELOG.mdには `--restricted` / `CLAUDE_CODE_RESTRICTED=1` が「user、project、localの設定ファイルを無視する」と一行だけ書かれているが、フックへの言及はなく、`code.claude.com/docs/en/permissions` と `permission-modes` のどちらのページにも `--restricted` 自体の記載がない（2026-08-28確認）。このため、`--restricted` は既存のフックに**追加のレイヤーとして積み上がる**のか、それとも**フックごと無効化してしまう**のか、公式情報だけでは判断できない。後者だと誤解したまま「信頼できない入力」を流すと、ガードレールが効いていると思い込んだまま実際には無防備な状態でClaude Codeを動かすことになる。

## 結論

Claude Code 2.1.248において、`--restricted` はプロジェクト定義の `PreToolUse` フックを、他のproject/local設定と同様に**サイレントに無効化する**。既存のフックベースのガードレールは `--restricted` セッションには引き継がれない。

## 検証方法

最小構成のフィクスチャを2ケース用意し、同一のガードフックに対して `--restricted` の有無だけを変えて比較した。

- `.claude/settings.json` に、`Write` にマッチする `PreToolUse` フックを1つ定義
- フック本体 (`hooks/guard.mjs`) は、**ブロック判定を行う前に必ず自分の起動マーカー (`hook-marker.txt`) を書き込み**、そのあとで `secret.txt` への書き込みだけを拒否する
- ファイルシステムの状態だけを見る検証スクリプト (`verify.mjs`) が、`hook-active`（マーカーあり・書き込みブロック）か `hook-ignored`（マーカーなし・書き込み成功）のどちらか一方に厳密に分類し、それ以外の状態では失敗として終了する

この「判定前に無条件でマーカーを残す」設計により、「フックは起動したがブロックしなかった」場合と「フックが一度も起動しなかった」場合を明確に区別できる。

| ケース | 起動オプション | 検証結果 |
|---|---|---|
| baseline | `--setting-sources project --permission-mode bypassPermissions`（`--restricted` なし） | `hook-active` |
| restricted | `--restricted --setting-sources project --permission-mode acceptEdits`（`restricted-wrapper.mjs` 経由） | `hook-ignored` |

両ケースとも実際に認証済みの `claude` 実行ファイル（`2.1.248`、`$HOME/.local/share/claude/versions/2.1.248`）を使用し、オフラインのフェイクCLIはケース実行前のプリフライトのみで使われた。`--setting-sources project` は両ケースで明示的に指定しているため、`restricted` ケースの結果は設定ソース指定漏れによるものではない。

## 観測結果

- **baseline**: `hook-marker.txt`（内容 `guard-invoked`）が作成され、フックが起動したことを示す。`secret.txt` は作成されず、エージェントの最終応答は「プロジェクトフックにより `secret.txt` への書き込みがブロックされた」という趣旨のテキストだった。ツール呼び出し記録にも `secret.txt` への `Write` に対する `permission_denials` が残っている。
- **restricted**: `hook-marker.txt` は作成されなかった＝フックが一度も起動しなかった。`secret.txt` は内容 `SECRET_PROBE` で実際に作成され、エージェントの最終応答は単に `"Done."` だった。

両ケースとも検証スクリプトの終了コードは0で、事前登録した2つの結果（`hook-active` / `hook-ignored`）のどちらかに明確に一致し、あいまいな状態は発生しなかった。保護対象のフィクスチャファイル自体（`.claude/settings.json`、`hooks/guard.mjs`、`verify.mjs` など）はどちらのケースでも変更されておらず、ハーネスがフィクスチャに手を加えた結果ではないことも確認済み。

## なぜ「フックが起動しなかった」と言えるのか

ガードフックは、判定を行う**前に**必ず自分の起動を記録する実装になっている。そのため、「フックは動いたが `Write` を許可した」というケースでも `hook-marker.txt` は残るはずである。`restricted` ケースでこのマーカーが一切存在しないという事実は、「フックが動いたがブロックしなかった」ではなく「フック定義を含む設定ファイル自体が読み込まれなかった」ことを示している。これはCHANGELOGの「project/local設定ファイルを無視する」という記述と整合する。`restricted-wrapper.mjs` 自体が別のバイナリを呼んでいた、あるいは実際には `--restricted` を渡していなかった、という可能性も、`command.json` に記録された実行ファイルパスとwrapperが構築した引数の検証により排除されている。

## 実務への影響とアクション

`.claude/settings.json` のproject/local設定に依存した `PreToolUse` や `PermissionRequest` フックでガードレールを実装しているチームは、そのガードレールが `--restricted` セッションに引き継がれることを前提にしてはならない。CIやオンコールのランブックに `--restricted` を組み込む前に、次のいずれかを行うべきである。

1. 本記事と同じ「判定前に無条件でマーカーを残すフック＋baseline/フラグonの比較」という最小手順を、自分たちの `.claude/settings.json` のフックに対して実行し、使用しているバージョンで実際にフックが生き残るかを確認する。
2. フックが引き継がれないことを確認した上で、`--restricted` を使うセッションではフック以外の手段（本検証では未検証だが、enterprise/managed設定はCHANGELOGの文言上は対象外とされている）でガードを維持するか、そのセッションでは `--restricted` を使わず通常のフック有効な起動方法を維持する。

## 検証条件と限界

- 検証日: 2026-08-28、Claude Code `2.1.248`（インストール済みの認証済みバイナリ）。
- 各ケースはケースごとに1サンプルのみ。CLIの間欠的な挙動に対する反復試行での検証は行っていない。
- テストしたフックイベントは `PreToolUse`（`Write` にマッチ）のみ。`PermissionRequest` など他のフックイベントについては未検証だが、検証しているのは「フックを定義する設定ファイルがそもそも読み込まれるか」という仕組みであり、この点はフック種別に依存しない。
- Enterprise/managed設定は未検証。CHANGELOGの「user、project、localの設定ファイル」という文言はmanaged設定を対象外としている可能性を示唆するが、これは測定していない。
- この結果は `--restricted` CLIフラグについてのものであり、環境変数版の `CLAUDE_CODE_RESTRICTED=1` では検証していない。
- Claude Code自体のサンドボックスやセキュリティ境界全般についての主張ではない。これは意図的な仕様（設定ファイルを無視する）の未文書化な帰結を確認したものであり、脆弱性やバグとして報告するものではない。
- 結果はバージョン `2.1.248` に固有であり、他バージョンでの再現性は未確認。

## 参考

- Anthropic Claude Code CHANGELOG.md、`2.1.248` エントリ: `--restricted` / `CLAUDE_CODE_RESTRICTED=1` は「組み込みのコマンド・コード実行ツールと `WebFetch` を除去し、ファイルツールは作業ディレクトリ内に限定し、`bypassPermissions` を拒否し、user・project・localの設定ファイルを無視する」。
- `code.claude.com/docs/en/permissions` および `.../permission-modes`（2026-08-28確認）: いずれも `--restricted` への言及なし。
