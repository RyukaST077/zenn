---
title: "Claude Code auto modeの$defaults抜け、配布前にJSON diffで検出する"
emoji: "🛡️"
type: tech
topics: ["claudecode", "cli", "security", "automode", "configuration"]
published: false
---

## 結論から: `$defaults`抜けはセクション単位で静的に検出できる

チームに配る共有の `~/.claude/settings.json` テンプレートに、`autoMode.soft_deny` へ独自ルールを1行足そうとしている場面を考えます。例えば本番Terraformディレクトリを保護する `"Never modify files under infra/terraform/prod/."` のような1文です。Claude Code 2.1.246の公式ドキュメント（[Configure auto mode](https://code.claude.com/docs/en/auto-mode-config)、2026-08-26参照）は、この編集で `"$defaults"` トークンをうっかり落とすと、そのセクションの組み込みルールが丸ごと消えると warning しています。force push、`curl | bash`、本番デプロイ、auto-modeバイパスといった例が名指しで挙げられています。

問題は、この警告が文章だけで、配布前に再現確認できるコマンド手順が示されていないことです。コピーした例をさっと書き換えているときに `"$defaults"` を落とすのは簡単に起こります。

検証の結論は、`claude auto-mode defaults` と `claude --settings <profile> auto-mode config` の出力をセクションごとにdiffするだけで、`"$defaults"` 抜けを影響を受けたセクション（この場合は `soft_deny`）だけに絞ってピンポイントで検出できる、というものです。`allow` / `hard_deny` / `environment` には触れません。これは実行前の完全に静的なチェックで、破壊的な操作は一切発生しません。

## なぜこの診断が成立するのか

公式ドキュメントは2点を主張しています。1つは、各セクション（`environment` / `allow` / `soft_deny` / `hard_deny`）が独立に評価されるということ、もう1つは、あるセクションの配列に `"$defaults"` を書かないと、そのセクションの組み込みルールが丸ごと（他のセクションには影響せず）消えるということです。この2つが同時に成り立つなら、`auto-mode defaults`（組み込みのみ）と `auto-mode config`（実際に適用される設定）を突き合わせれば、変更されたセクションだけが差分として現れるはずです。逆に言えば、触っていないはずのセクションに差分が出たら、それは "$defaults" 抜けとは別の、より深刻な異常として扱うべきシグナルになります。

## 検証条件と最小構成

検証日は2026-08-26、Claude Code `2.1.246 (Claude Code)` / macOS arm64の1ホストです。`soft_deny` のみを操作した2つのinline `autoMode` 設定を、他は完全に同一のまま比較しました。

- `control-with-defaults`: `autoMode.soft_deny = ["$defaults", "Never modify files under infra/terraform/prod/."]`
- `treatment-without-defaults`: `autoMode.soft_deny = ["Never modify files under infra/terraform/prod/."]`

各ケースで実行したコマンドは次の2つです。

```bash
claude auto-mode defaults
claude --settings '<inline-json>' auto-mode config
```

両者の出力をJSONとしてパースし、`allow` / `hard_deny` / `soft_deny` / `environment` の4セクションをそれぞれ集合として比較します。

## 観測結果: `soft_deny`だけが、書いた通りに変わる

| ケース | `soft_deny`（`defaults`） | `soft_deny`（`config`） | `allow` / `hard_deny` / `environment` |
| --- | --- | --- | --- |
| `control-with-defaults`（`$defaults`あり） | 組み込み67件 | 組み込み67件 + カスタム1件 = 68件 | `defaults` と完全一致（17/17, 1/1, 20/20） |
| `treatment-without-defaults`（`$defaults`なし） | 組み込み67件 | カスタム1件のみ（組み込み67件は全て不在） | `defaults` と完全一致（17/17, 1/1, 20/20） |

`control-with-defaults` では `config` の `soft_deny` に `defaults` の67件すべてと、追加したカスタムルール1件だけが含まれていました。`treatment-without-defaults` では `config` の `soft_deny` はカスタムルール1件のみで、67件の組み込みルールは1件も残っていませんでした。どちらのケースでも `allow` / `hard_deny` / `environment` は `defaults` とバイト単位で同一でした。差分の大きさと方向（68 = 67+1 か、1のみか）は、設定ファイルの違いが予測する通りに一致しています。

これは実行環境をわざと壊した実験ではなく、`"$defaults"` の有無だけを変えた最小の対照実験です。触れていない3セクションが両ケースとも無傷だった事実が、「セクションは独立に評価される」という公式ドキュメントの主張の裏付けになっています。

## 実務へのマッピングと判定ルール

この2つの設定ファイルは、読者自身のテンプレート編集の代わりです。測っているのはルールの文言そのものではなく、「`defaults` と `config` をセクション単位でdiffする」という手法が、「`$defaults`で組み込みルールを継承した」状態と「組み込みルールがサイレントに消えた」状態を確実に区別できるかどうかです。

判定ルール:

- `auto-mode config` の出力で、あるセクション（例: `soft_deny`）が `auto-mode defaults` に存在する組み込みルールを欠いていて、かつ設定ファイルのそのセクション配列に `"$defaults"` が書かれていなければ、トークンを追加する。
- 触っていないはずのセクション（今回の例では `allow` / `hard_deny` / `environment`）が `defaults` と異なっていたら、これは今回確認した範囲の外にある、より重大な異常として扱う。

このチェックは配布前のCIやpre-commitフックとして、4つの名前付きJSON配列をdiffするだけでスクリプト化できます。テンプレートを人手でレビューする代わりに使える、という位置づけです。

## 安全境界: このrunの自動判定は成功していない

ここは正直に書く必要があります。今回の2ケースはどちらも、above の表で示した分類（`soft_deny` の集合比較）を**手作業で**、記録済みの生JSONフィールドから再導出したものです。fixtureに組み込まれた自動verifierは、両ケースとも `exit code 1` で失敗し、分類マーカーを一度も書き出していません。

原因は今回検証したClaudeのCLI挙動そのものとは無関係です。verifierには「資格情報らしき環境変数名が子プロセスへ転送されていないか」を確認するチェックがあり、これが構造分類の**前に**実行されます。両ケースとも `environment: inherit`（実際に認証済みのCLIを叩くために必要な設定）で起動しており、ホスト環境変数がフィルタなしで転送されます。その結果、`SSH_AUTH_SOCK` と `CLAUDE_CODE_MESSAGING_TOKEN` という2つの環境変数**名**（値ではありません）が「資格情報らしき名前」として検出され、verifierがそこで停止しました。これはssh-agentが動いているホストやClaude Codeセッション内から実行するホストであれば、構造的に毎回発生することがソースコードから確認できます。この検証結果を再現しても、この自動判定失敗自体は解消しないと見込まれます。

つまり、今回報告している `soft_deny` の集合比較結果は、fixtureの自動マーカーによって確認された「合格」ではなく、同じ生データからの手動再導出です。一方で、危険な操作（force push、`curl | bash`、本番デプロイ、auto-modeバイパス）は一切実行しておらず、この診断手法自体は最初から最後まで読み取り専用・非破壊的です。また、`environment: inherit` でこのfixtureをCIに無人で組み込んでよいとは、この結果は支持しません。資格情報名チェックが通常のセッション変数で発火する以上、フィルタ済みの環境か、より狭いallowlistが必要です。

## 採用チェックリストと限界

- 対象範囲: Claude Code `2.1.246 (Claude Code)` / macOS arm64、`soft_deny` のみを編集したケース1回ずつの結果です。繰り返し測定ではありません。
- このチェックは `allow` / `hard_deny` / `environment` を直接編集した場合、`auto-mode critique` / `auto-mode reset` サブコマンド、実際のツール呼び出しに対する分類器の挙動については何も示していません。
- `claude auto-mode defaults` と `claude --settings <profile> auto-mode config` の出力を4セクションでdiffし、触ったセクションだけに想定通りの差分が出るか、触っていないセクションが無傷かを確認する、という手順そのものは両ケースの生データで再現できています。
- 配布前チェックとして自動化する場合は、この記事の手法（4セクションの構造比較）を使いつつ、資格情報名の検査ロジックを別途用意するなら、値ではなく名前のみを見る設計であっても、通常のセッション変数を誤検知しないよう検証してから組み込んでください。
