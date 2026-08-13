---
title: "zshでglobを含む引数（--include=*.js / --test-coverage-include=src/**）が no matches found で実行前に落ちる"
date: "2026-08-09"
cause_category: "Configuration"
tech: [zsh, bash, shell, node]
error_type: [NoMatchesFound, ZshNomatch]
library: [grep, node-test-runner]
keywords: [zsh, no matches found, glob, nomatch, クォート, --include, src/**, シェル展開, bash 差分]
status: "resolved"
---

# 開発ナレッジ報告書

## タイトル
zsh で glob を含む引数（`--include=*.js` / `--test-coverage-include=src/**`）が `no matches found` でコマンド実行前に落ちる

## 概要
zsh はデフォルトで `nomatch` オプションが有効なため、glob を含む語がどのパスにもマッチしないとき「空文字に展開する」でも「そのまま渡す」でもなく **エラーにしてコマンド自体を実行しない**。`--include=*.js` のように「オプション名＋glob」を1語で書くと、その語全体がパスとして評価されて必ずマッチせず、コマンドが起動する前に死ぬ。bash は同じ状況で語をそのまま渡すため、bash では通って zsh では落ちるという差が出る。glob をシングルクォートで囲めば解決する。

## 背景
- プロジェクト: 024_zenn（Zenn記事の実践検証パイプライン）
- 機能 / 作業内容: `run-practice` で Node 26.7 の `--test-coverage-include-all` を検証中
- 技術スタック: zsh（macOS 既定シェル）, GNU/BSD grep, Node.js v26.7.0
- 環境: macOS 26.5 / arm64
- 発生タイミング: Bash ツールでコマンドを実行した瞬間（コマンド本体は一切実行されない）
- 関連コマンド: `grep -rn "..." --include=*.js .` / `node --test --test-coverage-include=src/** ...`

## 問題
- 期待した挙動: grep が `.js` ファイルだけを走査する / node がカバレッジ対象を `src/**` に絞る。
- 実際の挙動: どちらもコマンドが起動せず、シェルのエラーだけが出て終了コード 1。
- エラーメッセージ:
  ```
  (eval):4: no matches found: --include=*.js
  ```
  ```
  zsh:1: no matches found: --test-coverage-include=src/**
  ```

## 原因
zsh の `nomatch` オプション（既定で on）により、glob 文字（`*` `?` `[]`）を含む語がどのファイルにもマッチしないとエラーになる。`--include=*.js` は語全体が glob パターンとして扱われ、カレントディレクトリにそんな名前のファイルは存在しないので必ず不一致になる。bash は既定で `nullglob` も `failglob` も off なので、不一致の語はリテラルのままコマンドへ渡され、同じコマンドが問題なく動く。「bash では動いたのに zsh で落ちる」の典型パターン。

## 解決策
glob 部分（または語全体）をシングルクォートで囲み、シェルに展開させずコマンド側へリテラルで渡す。

```bash
# NG（zsh で no matches found）
grep -rn "foo" --include=*.js .
node --test --experimental-test-coverage --test-coverage-include=src/**

# OK
grep -rn "foo" --include='*.js' .
node --test --experimental-test-coverage --test-coverage-include='src/**'
```

一時的に挙動を変えたい場合は `setopt nonomatch`（不一致でもリテラルで渡す＝bash 相当）も使えるが、スクリプトの可搬性を考えるとクォートで書くのが正解。

## 検証
- `grep -rn "legacy-report\|dead-branch" --include='*.js' .` → 正常終了（0 hits）
- `node --test --experimental-test-coverage --test-coverage-include='src/**' --test-coverage-include-all` → カバレッジ表が出て exit 0
- 対照実験: `bash -c "node ... --test-coverage-include=src/** ..."` はクォート無しでも正常動作し、zsh だけが落ちることを確認した

## 教訓・再発防止
- glob を含む「オプションの値」は、シェルに解釈させる意図が無い限り**常にシングルクォートで囲む**。
- 「bash なら動く」コマンド例をそのまま zsh に貼ると落ちることがある。macOS の既定シェルは zsh なので、記事にコマンド例を載せるときはクォート付きで書く。
- コマンドが「何も出力せずシェルのエラーだけ出た」場合、まず glob とクォートを疑う。

## 関連
- 検証ログ: `logs/run-node-test-coverage-include-all-20260809-0410/execution-log.md`
- 実測ログ: 同ディレクトリ `workspace/results/F-noquote.txt`（zsh / bash の対照）
