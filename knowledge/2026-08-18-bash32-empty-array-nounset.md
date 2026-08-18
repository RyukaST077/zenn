---
title: "macOS Bash 3.2でset -u下の空配列展開がunbound variableになる"
date: "2026-08-18"
status: "resolved"
cause_category: "Environment"
tech: [bash, macos, claude-code]
error_type: [unbound-variable]
library: []
keywords: [bash-3.2, nounset, empty-array, array-expansion, auto-publish, run-claude]
---

# 開発ナレッジ報告書

## 背景

Zenn記事の自動投稿スクリプトは`set -euo pipefail`を有効にし、Claude CLIへ渡す任意オプションを
`model_flags`と`output_flags`の配列で組み立てていた。JSON Schemaを使わない段では
`output_flags=()`のままコマンドラインで`"${output_flags[@]}"`を展開する。

## 症状

修正版パイプラインをlaunchdと同じラッパーから実行すると、利用量確認の後、最初のsearch段で
Claude CLIを起動する前に停止した。

## 環境

- macOS
- GNU bash 3.2.57(1)-release
- `set -euo pipefail`
- Claude CLIの非対話実行

## エラー

```text
scripts/auto-publish.sh: line 265: output_flags[@]: unbound variable
```

最小再現もexit 127になった。

```bash
bash -uc 'a=(); printf "%s\n" "${a[@]}"'
# bash: a[@]: unbound variable
```

## 試行

- `knowledge/`を`unbound variable`、`Bash 3.2`、`set -u`で検索した。
- 既存報告は変数直後の全角文字を変数名へ取り込む別原因だったため、その修正は適用しなかった。
- エラー行と最小再現を照合し、空配列展開だけで同じエラーになることを確認した。

## 確定原因

macOS標準のBash 3.2では、`set -u`下で宣言・初期化済みでも要素数0の配列を
`"${array[@]}"`として展開すると未定義変数として扱われる。search段はJSON Schemaを使わないため
`output_flags`が空で、この互換差を通った。構文検査と、配列を実際には展開しない従来テストでは
検出できなかった。

## 最終修正

空になる可能性がある複数のオプション配列を廃止した。実行ファイルと必須引数を最初から含む
単一の`claude_cmd`配列を作り、モデル、effort、Schemaなどの任意引数を条件付きで追記する。
実行時に展開する配列は常に1要素以上になる。

## 検証

偽Claude CLIを使い、実際の`run_claude`からsearch、plan、run、draft、reviewを順に実行する
回帰テストを追加した。モデルとeffortを空にし、Schemaを使わないsearch段を含めて成功した。

```bash
bash scripts/test-claude-pipeline.sh
npm test
```

全テストが成功し、標準エラーに`unbound variable`が無いことを確認した。

## 制限

修正時点の回帰確認は偽Claude CLIによるオーケストレーター実行であり、実Claudeの応答内容自体は
対象外である。

## 再発防止

- Bash 3.2互換スクリプトで`set -u`を使う場合、空配列を展開しない。
- コマンドは必須要素入りの単一配列で組み立て、任意引数を条件付きで追記する。
- `bash -n`だけでなく、任意引数が空になる実行経路を対象Bashで回帰テストする。
