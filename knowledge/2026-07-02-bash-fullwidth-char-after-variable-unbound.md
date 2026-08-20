---
title: "bashで変数展開の直後に全角文字が接すると unbound variable でパースが壊れる"
date: "2026-07-02"
cause_category: "Environment"
tech: ["bash", "macos"]
error_type: ["unbound-variable", "parse-error"]
library: []
keywords: ["全角", "全角括弧", "full-width", "multibyte", "set -u", "C.UTF-8", "locale", "変数展開", "bash 3.2"]
status: "resolved"
---

# 開発ナレッジ報告書

## タイトル
bashで変数展開の直後に全角文字が接すると unbound variable でパースが壊れる

## 概要
bash スクリプト内で `"$VAR（...）"` のように**変数展開の直後に全角文字（全角括弧など）が
接している**と、この環境（macOS bash 3.2.57 / LANG=C.UTF-8）では全角文字が変数名の一部として
解釈され、`set -u` 下で `VAR�: unbound variable` として実行時エラーになる。
変数の直後を半角文字にするか、`${VAR}` のブレース形式にすることで解消する。

## 背景
- プロジェクト: 024_zenn（Zenn記事 自動投稿パイプライン）
- 機能 / 作業内容: オーケストレータースクリプト `scripts/auto-publish.sh` の新規作成。
  `die()` 関数のエラーメッセージに `$PIPE_DIR（各段のログあり）` と書いていた
- 技術スタック: bash 3.2.57(1)-release (arm64-apple-darwin25), zenn-cli, Claude Code
- 環境: macOS (Darwin 25.5.0), `LANG=C.UTF-8` / `LC_CTYPE=C.UTF-8`
- 発生タイミング: パイプラインのE2Eテスト中、`die()` が初めて呼ばれた時（実行時エラー。
  `bash -n` の構文チェックでは検出されない）
- 関連ファイル: `scripts/auto-publish.sh`（今回の発生箇所）、
  `.claude/skills/review-article/scripts/check-article.sh`（冒頭コメントに同事象の注意書きが
  既にあったが、knowledge 未登録だったため再発した）
- 関連コマンド: `bash scripts/auto-publish.sh`

## 問題
- 期待した挙動: `log "パイプラインディレクトリ: $PIPE_DIR（各段のログあり）"` が
  変数を展開してメッセージを表示する
- 実際の挙動: 変数名に直後の全角文字が取り込まれ、未定義変数として実行時エラーになる
- エラーメッセージ:
  ```
  /Users/***/workspace/024_zenn/scripts/auto-publish.sh: line 100: PIPE_DIR�: unbound variable
  ```
- 再現手順（最小再現。この環境で確認済み）:
  ```bash
  bash -uc 'X=1; echo "$X（テスト）"'   # => bash: X�: unbound variable (exit 127)
  bash -uc 'X=1; echo "$X (テスト)"'    # => OK（半角スペースを挟む）
  bash -uc 'X=1; echo "${X}（テスト）"' # => OK（ブレース形式なら全角が隣接しても良い）
  ```

## 原因
- 推測した原因: メッセージ文字列のエンコーディング破損を疑った
- 確定した原因: この環境の bash 3.2（macOS 同梱）＋ `C.UTF-8` ロケールの組み合わせでは、
  ブレース無しの変数展開 `$VAR` の変数名終端判定がマルチバイト文字で誤動作し、
  直後の全角文字（の先頭バイト）まで変数名として読んでしまう。`set -u` 下では
  その「存在しない変数」参照が unbound variable エラーになる（`set -u` が無い場合は
  空文字列に展開されて無言で文字化け・文字欠けする）
- 原因カテゴリ: Environment
- 根拠: 上記の最小再現3パターンの実行結果（全角隣接のみ失敗、半角挟み・ブレース形式は成功）。
  エラーメッセージの変数名末尾に置換文字 `�`（壊れたマルチバイト断片）が出ている

## 解決策
- 試したこと:
  1. `bash -n` での構文チェック → 検出できない（実行時のみ発生）
  2. 該当行の全角括弧を半角に置換 → 解消
  3. 最小再現でブレース形式 `${VAR}` を検証 → こちらも解消（より根本的）
- 最終的な修正: スクリプト内の「変数展開直後に全角文字が接する」箇所をすべて修正。
  変数の直後に半角スペース/半角記号を置く（例: `$PIPE_DIR (各段のログあり)`）。
  Python で全ファイルを走査し、`$VAR` の直後にコードポイント U+2E80 以上の文字が来る行を
  検出して残存ゼロを確認した
- 変更ファイル: `scripts/auto-publish.sh`（die() のメッセージ、skip ログ、マージ失敗メッセージ）
- Before / After:
  ```bash
  # Before（実行時エラー）
  log "パイプラインディレクトリ: $PIPE_DIR（各段のログあり）"
  # After（どちらでも可）
  log "パイプラインディレクトリ: $PIPE_DIR (各段のログあり)"
  log "パイプラインディレクトリ: ${PIPE_DIR}（各段のログあり）"
  ```

## 検証
- 検証方法: 最小再現コマンド3パターンの実行＋モック claude を使ったパイプラインの
  E2Eテスト（正常系・失敗→resume・abort系）を再実行
- テスト結果: すべて成功。die() のメッセージも正しく表示された
- ビルド結果: N/A（シェルスクリプトのため `bash -n` のみ。構文OK）
- 残課題: なし。ただし本事象は `bash -n` で検出できないため、新規スクリプトでは
  下記チェックの実行が必要

## 再発防止
- 防止策: 日本語メッセージを含む bash スクリプトでは、**変数展開は `${VAR}` のブレース形式で
  書く**か、変数の直後に必ず半角文字（スペース・半角記号）を置く。全角括弧「（）」を
  変数の直後に置かない
- 次回チェック手順: 以下のワンライナーで「変数展開直後に全角文字」が残っていないか走査する
  ```bash
  python3 -c "
  import re, sys
  for f in sys.argv[1:]:
      for i, line in enumerate(open(f), 1):
          for m in re.finditer(r'\\\$\{?[A-Za-z_][A-Za-z0-9_]*\}?', line):
              j = m.end()
              if j < len(line) and ord(line[j]) > 0x2E80 and not m.group().endswith('}'):
                  print(f'{f}:{i}: {line.rstrip()}')
  " scripts/*.sh
  ```
- チェックリスト項目: 「日本語入り bash スクリプトを書いた/編集したら、変数展開と全角文字の
  隣接が無いことを上記スクリプトで確認したか？」

## 検索タグ
- Tech: bash, macos
- Error Type: unbound-variable, parse-error
- Library: なし
- Keywords: 全角, 全角括弧, full-width, multibyte, set -u, C.UTF-8, locale, 変数展開, bash 3.2
