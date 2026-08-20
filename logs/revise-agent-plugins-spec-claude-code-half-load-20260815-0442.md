# 修正レポート: Agent Plugins 1.0.0の仕様どおりに作ったプラグインをClaude Codeに読ませたら半分だけ読めた / agent-plugins-spec-claude-code-half-load

## 修正の前提

- 対象記事: `articles/agent-plugins-spec-claude-code-half-load.md`（引数で明示。リネームなし）
- レビューレポート: `logs/review-agent-plugins-spec-claude-code-half-load-20260815-0439.md`（判定: 要修正 / blocker 0・warning 1・suggestion 6）
- 出典ログ: `logs/run-agent-plugins-spec-20260815-0413/execution-log.md`（`RESULTS.md` の差分表も照合に使用）
- 適用範囲: blocker + warning（既定）＋ 安全で機械的な suggestion（1・3・4）
- slug リネーム: 不可の指摘なし・実施なし
- 修正日時: 2026-08-15 04:42
- 過去の修正レポート: なし（今回が1回目。ループ検出対象なし）

## 結果サマリー

- 適用: blocker 0 件 / warning 1 件 / suggestion 3 件（1・3・4）
- 未解消・スキップ: suggestion 3 件（2・5・6。いずれも任意指摘）
- slug リネーム: なし
- `published: false` 維持: OK
- セルフチェック: `SUMMARY fail=0 warn=2`（2件ともレビューで誤検出と切り分け済み）

## 適用した修正（指摘ごと）

| # | 元の指摘（重大度 / 箇所） | 分類 | 適用した修正（before → after の要点） | 素材の出典 |
|---|---|---|---|---|
| 1 | warning-1 / L116「ここで、結果を見る前に…」 | C（事実に合わせた差し替え） | before:「的中したのが5、半分外したのが1、まったく予想していなかった発見が1でした。」 → after:「結果は的中が6、半分外したのが1で、それとは別に、まったく予想していなかった発見が1つありました。」 | `logs/run-agent-plugins-spec-20260815-0413/RESULTS.md` 差分表（行1=⚠️半分外れ、行2〜7=✅的中 の6件、行8=🆕想定外） |
| 2 | warning-1 / L727「まとめ」 | C（同上） | before:「的中5、半分外し1、まったく予想していなかった発見（…）が1でした。」 → after:「的中6、半分外し1でした。それとは別に、まったく予想していなかった発見（`claude plugin init` の雛形が仕様スキーマでinvalid）が1つありました。」。7＝6+1 で読者の足し算が合うようにし、想定外の発見は予想7項目の外だと明示 | 同上 |
| 3 | suggestion-1 / L9 前提コメント | A（機械修正） | `<!-- 前提: 出典ログ logs/... -->` の行（と後続の空行1つ）を削除 | 機械修正 |
| 4 | suggestion-3 / L30 | A（機械修正） | 「その過程で採った出力と」→「その過程で得られた出力と」 | 機械修正 |
| 5 | suggestion-4 / L214 `author.name` | E（匿名化・マスク） | `"name": "RyukaST077"` → `"name": "<masked-name>"`。`author.email` のマスクと粒度を揃えた | 機械修正（ログ上も `claude plugin init` が git config から `author.name`/`author.email` を自動充填する旨を記録） |
| 6 | （#5 に伴う整合） | A | `:::message alert` 内「自分のメールアドレスが載ります（上のJSONは伏せてあります）」→「自分の名前とメールアドレスが載ります（上のJSONはどちらも伏せてあります）」。マスク対象が2つになったことと本文の注意喚起を一致させた | 出典ログ L188〜L253（`author.name` / `author.email` が git config から自動充填） |

## 削除した記述（分類C で削ったもの）

- 冒頭 L9 の前提コメント（パイプライン内部のパス）: 読者向けの情報ではないため削除。事実記述の削除ではない。
- それ以外に、裏付け不足による削除・弱めは**なし**（レビューの事実整合照合で「創作の疑いがある記述: なし」と判定されているため）。

## スキップ・未解消の指摘

| # | 指摘（重大度） | 対応 | 理由 / 推奨アクション |
|---|---|---|---|
| 1 | suggestion-2: L36 の過去記事 `articles/project-root-agent-instructions.md` へリンクを張る | スキップ | 当該記事は `published: false` のドラフトのままで、Zenn 上の公開 URL が存在しない。出典ログにも URL の裏付けがないため、リンク先を書くと存在しない URL の捏造になる。→ 当該記事を公開後に、`/publish-pr` 以降のタイミングでリンクを追記するのが妥当 |
| 2 | suggestion-5: title（59文字）の短縮 | スキップ | 実文字数59文字は目安60字以内でチェック上も基準内（機械チェックの「117文字」はバイト数カウントによる誤検出とレビューで切り分け済み）。タイトルは記事の主旨に関わるため、任意指摘の範囲で機械的には変更しない判断 |
| 3 | suggestion-6: 空振りした予告2件（`--plugin-dir` の入れ子実行 / `agent-plugins.org` のスキーマURL）への言及追加 | スキップ | 現状でも事実誤りではない（レビューも「任意」と明記）。本文へ新規段落を足す編集は最小修正の原則から外れるため見送り。必要なら次のドラフト更新で出典ログの該当記録から追記可能 |

いずれも suggestion（任意）であり、blocker / warning の未解消は 0 件。

## 警告

- なし（秘密情報の検出なし。`author.name` のマスクは公開ハンドルのため git 履歴に関する失効対応は不要）。

## セルフチェック出力（check-article.sh）

```
== check-article: articles/agent-plugins-spec-claude-code-half-load.md (slug=agent-plugins-spec-claude-code-half-load) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 117文字 (60字目安)
[PASS] emoji あり: 🧩
[PASS] topics 4個
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/01-two-layouts.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/02-ccvalidate-asymmetry.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/03-name-precedence.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/04-validator-asymmetry.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/05-extensions-ignored.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/06-mcp-contrast.png
[PASS] 画像あり: /images/agent-plugins-spec-claude-code-half-load/07-nested-skills.png
[PASS] コードフェンスが閉じている: フェンス行=96
[PASS] ::: ブロックが閉じている: 6 行
[PASS] 要素材マーカーなし
[WARN] プレースホルダ (TODO/FIXME/<slug>/<...> 等) が残っている
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=2
```

- `[WARN] title が長い` … 誤検出（バイト長カウント。実文字数59文字）。レビューレポートで切り分け済み。
- `[WARN] プレースホルダが残っている` … 誤検出。ヒットは `claude plugin --help` の実出力 `validate [options] <path>`、`claude plugin init` が吐いた雛形の `"TODO: describe what this plugin provides"`（記事の論点そのもの）、意図的なマスク `<masked-email>` / `<masked-name>`、一般表記の `~/.claude/skills/<name>/` 等。今回の修正で `<masked-name>` が1件増えたが、いずれも書き忘れではない。

## 次のアクション

- [ ] `/review-article articles/agent-plugins-spec-claude-code-half-load.md` で再レビューする
- [ ] 判定が「公開可」になったら `/publish-pr` で公開準備する（PR を main にマージすると Zenn で公開）
