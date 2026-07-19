# 修正レポート: Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた / bun-cookiemap-vs-manual-set-cookie

## 採用した前提

- 対象記事: `articles/bun-cookiemap-vs-manual-set-cookie.md`（published: false 維持）
- レビューレポート: `logs/review-bun-cookiemap-vs-manual-set-cookie-20260720-0416.md`
- 出典ログ: `logs/run-bun-cookiemap-20260720-0406/execution-log.md`
- 適用範囲: blocker ＋ warning（suggestion は安全・機械的なもののみ任意適用）
- slug リネーム: 指摘なし → 実施せず
- 過去の修正レポート: なし（本記事に対する初回の revise）

判定は「要修正」（blocker 0 / warning 1 / suggestion 3）。公開安全・事実整合はレビュー時点で全てクリア。

## 指摘ごとの棚卸しと修正分類

| # | 重大度 | 箇所 | 指摘 | 分類 | 対応 |
|---|---|---|---|---|---|
| warning-1 | warning | Front Matter `title`（2行目） | title が長い（機械チェックで検出）。`(Bun.CookieMap)` が本文「組込cookie」と重複気味 | C 削減修正 | 適用（下記） |
| suggestion-1 | suggestion | 9行目 前提コメント | 公開版に残すか判断（HTMLコメントで無害） | 任意 | スキップ（運用方針として維持） |
| suggestion-2 | suggestion | 34行目 と 367〜369行目 | Bun docs URL の二重掲載 | 任意 | スキップ（意図的な再掲。冒頭=導線 / 参考リンク=末尾まとめ） |
| suggestion-3 | suggestion | 327〜334行目 `context.cookies()` の JSON | ログ実出力の要約形である旨を一言添えると対応が明確 | 任意（B/C 補足） | 適用（下記） |

## 適用した修正

### warning-1（title 短縮）— 適用

- 変更前: `Bunの組込cookie(Bun.CookieMap)で、手動Set-Cookieと書き比べてみた`（79バイト / check-article.sh で WARN）
- 変更後: `Bunの組込cookie(CookieMap)と手動Set-Cookieを書き比べてみた`（**44 可視文字** / 72バイト）
- レビューレポートが「具体的な直し方」として提示した例そのものを採用。`(Bun.CookieMap)` の
  `Bun.` を落として本文「組込cookie」との重複を解消し、冗長な「で、」を「と」に簡素化した。
- 捏造なし（タイトルの意味・対象は不変）。

### suggestion-3（JSON が要約形である旨を明記）— 適用

- 327行目の文末に「（`value` と `expires` は省略しています）」を追記。
  記事中の JSON（`name`/`domain`/`path`/`httpOnly`/`secure`/`sameSite`）は出典ログ
  `logs/playwright.log` の記録と一致しており、実 `context.cookies()` が持つ `value`/`expires`
  を省いた要約であることを明示しただけ。新しい事実・数値は書き足していない（捏造なし）。

## スキップした指摘と理由

- suggestion-1（前提コメント残存）: HTML コメントで公開表示に影響せず、`<!-- 前提: ... -->` は
  出典ログとの対応を追える運用メタ情報。CLAUDE.md のナレッジループ運用方針に沿って維持を選択。
- suggestion-2（Bun docs URL 二重掲載）: 冒頭（34行目）は「事前に読んだ公式ドキュメントへの導線」、
  末尾（367〜369行目）は「参考リンク集」で役割が異なる意図的な再掲。レビューでも「意図的なら可」と
  明記されているため現状維持。いずれも任意指摘で公開可否に影響しない。

## 未解消の指摘（再レビューの判断に委ねる）

### warning-1 の機械チェック WARN が残存（byte 換算の環境アーティファクト）

- `check-article.sh` 再実行後も `[WARN] title が長い: 72文字 (60字目安)` が残る（79→72 に減少）。
- 原因: 本実行環境は `LANG` 未設定（C ロケール）のため `wc -m` が**マルチバイト文字をバイト単位**で
  数える。日本語1文字＝UTF-8 で3バイト換算になり、可視44文字のタイトルが「72文字」と表示される。
- レビューの意図は「可視60字目安」。修正後タイトルは **44 可視文字**で、その意図には十分収まっている
  （レビューが提示した推奨例そのもの。同じ例も byte 換算では 72 になり、この閾値は満たせない）。
- これ以上の短縮には、シリーズ共通の署名表現「書き比べてみた」か本題の `CookieMap` の削除が必要で、
  記事の主旨・シリーズ体裁を損なう。**warning のみ**の残存につき、Step 6 に従い適用済み修正を保存して続行。
- 分類: 削減方向でこれ以上は主旨破壊になるため「体裁上の非解消 warning」として明記（blocker ではない）。

## セルフチェック結果（check-article.sh 再実行）

```
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=34 (12-50)
[WARN] title が長い: 72文字 (60字目安)   ← byte換算アーティファクト。可視44字
[PASS] 画像あり ×2 / コードフェンス30(偶数) / :::2 / 要素材なし / プレースホルダなし / 秘密情報なし
SUMMARY fail=0 warn=1
```

- `published: false` を維持していることを最終確認済み。
- 機械検出対象（published / slug / 画像 / フェンス / 要素材 / 秘密情報）はすべて PASS。
  残る WARN は上記の title byte 換算のみで、fail=0。

## 適用件数サマリー

- blocker: 0 件（元から 0）
- warning: 1 件中 1 件適用（title 短縮）／機械チェック上は byte 換算で WARN 残存（非ブロッキング）
- suggestion: 3 件中 1 件適用（JSON 省略の明記）、2 件スキップ（意図的・運用方針で維持）
- 修正不能・中止: なし

## 次のアクション

- `/review-article articles/bun-cookiemap-vs-manual-set-cookie.md` で再レビュー。
  title の WARN は byte 換算アーティファクトである旨を本レポートに記録済み。可視文字数はレビュー意図内。
- 公開可になったら `/publish-pr` へ。
