---
title: "Claude Codeの--json-schemaが2020-12メタスキーマ宣言を拒否する"
date: "2026-08-18"
status: "resolved"
cause_category: "Compatibility"
tech: [claude-code, json-schema, node]
error_type: [InvalidJsonSchema]
library: [claude-cli]
keywords: [--json-schema, draft-2020-12, metaschema, structured-output, review]
---

# 開発ナレッジ報告書

## 背景

Claude Codeの非対話reviewへ構造化結果のSchemaを渡し、Markdown中の文字列検索ではなく
`pass` / `fix` / `blocker`をJSONで受け取るようにした。

## 症状

通常の段は完了したが、reviewだけがモデル実行前にexit 1になった。

## 環境

- Claude Code 2.1.227
- macOS / Bash 3.2
- `claude -p ... --output-format json --json-schema <schema>`

## エラー

```text
Error: --json-schema is not a valid JSON Schema: no schema with key or ref "https://json-schema.org/draft/2020-12/schema"
```

## 試行

- CLIの利用量上限ではなく、reviewログの先頭に出たSchema検証エラーを確認した。
- `claude --help`で`--json-schema`自体は利用可能であることを確認した。
- 同一原因の既存ナレッジは無かった。

## 確定原因

生成Schemaに`"$schema": "https://json-schema.org/draft/2020-12/schema"`を含めていた。
Claude Code 2.1.227のSchema検証器はこのメタスキーマURIを解決できず、制約本体を読む前に拒否した。

## 最終修正

Claudeへ渡すSchemaから`$schema`宣言を除き、`type`、`enum`、`properties`、`required`、
`additionalProperties`など実際に使う制約だけを残した。生成Schemaに`$schema`が無いことを
回帰テストで固定した。

## 検証

```bash
npm test
```

全テスト成功後、停止していた実パイプラインのreviewを再開した。Claude CLIがSchemaを受理し、
1回目は`fix`、修正後の2回目は`pass`を構造化結果として返した。

## 制限

Claude Codeの将来版で対応dialectが増える可能性はある。今回確認したのは2.1.227である。

## 再発防止

- 外部CLIへ渡すSchemaは、そのCLIが対応するsubsetだけで構成する。
- Schemaファイル生成の単体テストに加え、実CLIが受理する経路を確認する。
- モデル実行失敗とSchema事前検証失敗をログで区別する。
