# 公開前レビュー: スクロール完了を await で待つChrome 150の新API（scroll-promise-await-vs-settimeout-scrollend）

## レビューの前提

- 対象記事: articles/scroll-promise-await-vs-settimeout-scrollend.md
- 出典ログ: logs/run-scroll-promises-20260721-0407/execution-log.md
- レビュー日時: 2026-07-21 04:23
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] `title` が 94 文字と長い（機械チェック WARN・60字目安の1.5倍超）。公開安全・事実性に問題はなく blocker はゼロなので、体裁面の warning 1 件により「要修正」。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（2行目） — 94文字と長い。一覧やSNSで末尾が切れるため、60字以内（例: 「スクロール完了を await で待つ新API（Chrome 150）を setTimeout / scrollend と書き比べた」＝約55字）へ短縮する。
2. [suggestion] 画像01の alt（165行目） — alt が長文（キャプション相当）。要点だけの簡潔な alt（例: 「3手法とも静定後は同じ Section 5 に落ち着く」）に整えると読みやすい。図の詳しい説明は本文側に既にあるため重複を避ける。
3. [suggestion] 冒頭の前提コメント `<!-- 前提: ... -->`（9行目） — draft-article 由来のメタ情報。公開時に残っていても実害はないが、意図的に残すか消すかを公開前に一度確認する（消し忘れでないこと）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title` / 2行目 | title が 94 文字で長い | 60字以内へ短縮（例: 「スクロール完了を await で待つ新API（Chrome 150）を setTimeout / scrollend と書き比べた」）。内容は変えず冗長部分を削る | 機械チェック `[WARN] title が長い: 94文字 (60字目安)` |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 画像01 alt / 165行目 | alt がキャプション級に長い | 一覧性・スクリーンリーダー体験が向上。要点1文に絞る |
| 2 | 冒頭前提コメント / 9行目 | draft 由来のメタコメントが残存 | 意図的か消し忘れかを確認しておくと事故防止になる（残しても実害はない） |
| 3 | まとめ節 / 254行目付近 | 締めは十分だが、対象読者（Chrome/Edge を握れる環境・SPA遷移後処理）を1行添えると誰向けか明確になる | 読者が自分事として読み進めやすくなる |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published=false / slug 妥当(44字, 汎用語なし, 重複なし) / 秘密情報・個人パスなし |
| Front Matter | 要修正 | title 長い(94字)。type=tech・topics5個・emoji📜 は妥当 |
| 事実性（ログ照合） | OK | 数値・コマンド・出力・比較表がすべて execution-log に一致（下記照合参照） |
| 画像 | OK | 参照2枚(01,04)とも実在・孤立画像なし。手法B/Cのスクショ非掲載は「同一画像」と本文で明示済みで妥当 |
| Markdown構造 | OK | コードフェンス24行(偶数)・:::2行閉じ・見出し階層破綻なし・壊れリンクなし |
| 文章品質・トーン | OK | 経験談トーン、詰まった点(バージョン壁/early-resolve)を具体的に記述、環境明記、断定を避け「私の環境での観測」と限定 |
| 完成度 | OK | 要素材/プレースホルダ残存なし。再現手順・参考リンクあり |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「3手法とも動かして比較表・スクショまで取れた／目標達成」 ↔ ログ結果サマリー「達成」 → **一致**
- 数値の裏付け（すべてログに一致）:
  - 手法A/B/C 経過ms 1269.7 / 1082.4 / 539.6、検知scrollY 3840 / 3840 / 3379、最終scrollY 3840 / 3840 / 3828 → ログ `[method A/B/C]`・`out/result.md` と一致
  - scrollHeight=4800 / target=3840 / viewport 800 → ログ `[page]` と一致
  - scrollIntoView: 2ms で resolve・resolveY=0・after300Y=958・diff=958・earlyResolve=true / 回避策 966ms・2880・diff=0 → ログ `[scrollIntoView]`/`[workaround]`・`out/intoview.md` と一致
  - Chrome 149(undefined)↔150(Promise)、UA、returnType → ログ `detect` 出力と一致
  - 環境（macOS Darwin 25.5.0 / Node v22.17.0 / npm 10.9.2 / Playwright 1.61.1 / 同梱Chromium 149.0.7827.55 / ローカルChrome 150.0.7871.125）→ ログと一致
- 断定の抑制: early-resolve を「2026年7月時点・私のこの実行環境での観測」と限定し、Chromium issue #41406914 と ICS MEDIA(EN) の報告を添えている → ログのフェーズ1方針どおり。**ログを超えた成功の断定は見当たらない**
- 創作の疑いがある記述: なし（コードブロックは「抜粋」表記で、内容はログの計測定義・回避策と整合）
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/scroll-promise-await-vs-settimeout-scrollend.md (slug=scroll-promise-await-vs-settimeout-scrollend) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=44 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 94文字 (60字目安)
[PASS] emoji あり: 📜
[PASS] topics 5個
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/01-method-a-await.png
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/04-intoview-workaround.png
[PASS] コードフェンスが閉じている: フェンス行=24
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

## 次のアクション

- [ ] warning（title を60字以内へ短縮）を直す。余力があれば suggestion も反映
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` で自動修正も可）
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`
      （「サイト内で既に使用されています」が出たら slug を具体化。
       knowledge/2026-07-01-zenn-slug-already-used.md）
