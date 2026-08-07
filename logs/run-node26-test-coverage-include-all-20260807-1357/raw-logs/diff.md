# 差分表: `--test-coverage-include-all` の有無

計測プロジェクト: `coverage-lab`（`src/` 6ファイル計118行 / `test/` 3ファイル、テストは `add.js` `slugify.js` `formatDate.js` の3本のみ）
Node.js v26.7.0 / macOS 26.5 (arm64)

| 条件 | 表に現れたファイル数 | 総合 line % | 総合 branch % | 総合 funcs % | 終了コード | ログ |
|---|---|---|---|---|---|---|
| フラグ無し | 3 | **100.00** | 100.00 | 100.00 | 0 | `logs/without-flag.txt` |
| `--test-coverage-include-all` 有り | 6 | **16.95** | 100.00 | 100.00 | 0 | `logs/with-flag.txt` |

**下落幅: 100.00% → 16.95%（△83.05ポイント）**

## 差分の中身（`diff -u logs/without-flag.txt logs/with-flag.txt`）

追加された行: 4行（`deepMerge.js` / `parseQuery.js` / `retry.js` の3ファイル行 ＋ `all files` の書き換え）
増えたファイル数: 3（いずれも line 0.00%）

## 注意（この数値はプロジェクト固有）

テスト無しファイルを1本（`src/chunk.js` 26行）足しただけで **16.95% → 13.89%** に動いた（`logs/with-flag-7files.txt`）。
下落幅は「テスト無しファイルの行数 ÷ 全体の行数」でしかなく、他プロジェクトには一般化できない。

## branch % / funcs % は下がらない

一度も読み込まれなかったファイルは line 0.00% だが **branch/funcs は 100.00% のまま**。
そのため閾値も line だけが落ちる:

| コマンド | 終了コード |
|---|---|
| `--test-coverage-include-all --test-coverage-lines=80` | **1**（`Error: 16.95% line coverage does not meet threshold of 80%.`） |
| `--test-coverage-include-all --test-coverage-functions=80 --test-coverage-branches=80` | **0**（通ってしまう） |
