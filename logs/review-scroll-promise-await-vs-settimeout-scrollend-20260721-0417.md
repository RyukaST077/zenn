# 公開前レビュー: スクロール完了を await で待てるChrome 150の新API / scroll-promise-await-vs-settimeout-scrollend

## レビューの前提

- 対象記事: articles/scroll-promise-await-vs-settimeout-scrollend.md
- 出典ログ: logs/run-scroll-promises-20260721-0407/execution-log.md
- レビュー日時: 2026-07-21 04:17
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 要修正**

- blocker: 0 件 / warning: 1 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - [warning] `title` が 115 文字と長い（60字目安の約2倍）。機械チェックでも WARN。
  - blocker は無し。公開安全（published:false / slug / 秘密情報）はすべてクリア。事実整合も出典ログと一致。

## 最優先で直すべき指摘（上位3件）

1. [warning] Front Matter `title`（2行目） — 115文字と長い。Zennの一覧・OGPで途中省略されやすい。60字前後まで短縮する。例:「スクロール完了を await で待てるChrome 150の新APIを setTimeout / scrollend と書き比べた」（約48字）。
2. [suggestion] スクショ 01/02/03（163-169行） — 手法A/B/Cの3枚が**バイト単位で完全に同一画像**（md5一致）。3手法とも Section 5 に静定するため当然ではあるが、「各手法の最終位置のスクショ」として3枚並べると読者には別々の証拠に見える。1枚に集約し「3手法とも静定後は同じ Section 5。差は detectY の数値に出る」と補足するとより誠実。
3. [suggestion] 冒頭コメント（9行目）`<!-- 前提: 出典ログ ... -->` — draft-article 由来の前提メモ。公開前に消すか、意図的に残すか判断する（Zenn上は非表示なので害はないが消し忘れの可能性）。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

| # | 箇所（節/行） | 指摘 | 具体的な直し方 | 根拠 |
|---|---|---|---|---|
| 1 | Front Matter `title`（2行目） | title が 115文字で長い（60字目安超過） | 60字前後に短縮。例「スクロール完了を await で待てるChrome 150の新APIを setTimeout / scrollend と書き比べた」 | check-article.sh の WARN / チェックリスト2 |

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 画像 01/02/03（163-169行） | 手法A/B/Cのスクショが完全同一画像（md5 f576...一致） | 3枚→1枚に集約し「静定後は3手法とも同一位置。差は数値」と明記すると誤解が減り誠実 |
| 2 | 冒頭コメント（9行目） | draft-article の前提コメントが残存 | 消し忘れか意図的かを判断。整理すると本文がすっきり |
| 3 | 参考リンク節（281-285行） | 生URLの箇条書き。本文38-44行では同URLをタイトル付きリンクで掲載済み | 末尾も同様にタイトル付きにすると重複感が減り読みやすい（任意） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / slug 44字・一意・重複なし / 秘密情報なし / 個人パスなし（環境は Darwin 25.5.0 等の一般表記のみ） |
| Front Matter | 要修正 | title が115字と長い（warning）。他フィールドは妥当（type=tech, topics 5個, emoji📜） |
| 事実性（ログ照合） | OK | 数値・コマンド・結論すべて出典ログと一致（下記照合結果） |
| 画像 | OK | 4枚すべて実在・参照解決・alt付き。孤立画像なし。※01-03が同一画像な点は suggestion |
| Markdown構造 | OK | コードフェンス24行（偶数）/ ::: 2行で閉じ / 見出し階層 H2中心で破綻なし / プレースホルダなし |
| 文章品質・トーン | OK | 経験談トーン。詰まった点（バージョン壁 / early-resolve）が具体的。再現性（OS/Node/Playwright/Chrome版）明記。断定を避け「私の環境での観測」と限定 |
| 完成度 | OK | 要素材マーカー・TODO なし。再現手順あり。公開に耐える構成 |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「3手法とも動かして比較表・スクショまで取れた／目標は達成」 ↔ ログ「完了条件の判定: 達成」 → **一致**
- 主要数値の照合（すべて一致）:
  - 手法A 1269.7ms / detectY 3840 / finalY 3840 / interrupted=false ↔ ログ同値
  - 手法B 1082.4ms / 3840 / 3840 / detectedBy=scrollend ↔ ログ同値
  - 手法C 539.6ms / detectY 3379 / finalY 3828 ↔ ログ同値
  - scrollIntoView early-resolve: 2ms / resolveY 0 / after300 958 / diff 958 / earlyResolve=true ↔ ログ同値
  - 回避策 scrollTo(offsetTop): 966.1ms / 2880 / 2880 / diff 0 ↔ ログ同値
  - 環境: Node v22.17.0 / npm 10.9.2 / Playwright 1.61.1 / 同梱 Chromium 149.0.7827.55 / ローカル Chrome 150.0.7871.125 ↔ ログ同値
  - ページ scrollHeight 4800 / viewport 800 / #sec5 offsetTop 3840 ↔ ログ同値
- 実行コマンド: mkdir/npm init/npm i/playwright install、node detect.mjs / measure.mjs / intoview.mjs はすべてログに存在。創作コマンドなし。
- 断定の限定: early-resolve を「2026年7月時点・私のこの実行環境での観測」と明記し、Chromium issue #41406914 を添える扱いはログの方針（フェーズ1・4）どおり。ログを超えた成功断定なし。
- 創作の疑いがある記述: なし。
- 残存する `要素材` マーカー: 0 件。

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/scroll-promise-await-vs-settimeout-scrollend.md (slug=scroll-promise-await-vs-settimeout-scrollend) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=44 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 115文字 (60字目安)
[PASS] emoji あり: 📜
[PASS] topics 5個
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/01-method-a-await.png
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/02-method-b-scrollend.png
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/03-method-c-settimeout.png
[PASS] 画像あり: /images/scroll-promise-await-vs-settimeout-scrollend/04-intoview-workaround.png
[PASS] コードフェンスが閉じている: フェンス行=24
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

補足（機械チェックの手動確認）:
- 画像同一性: `md5` で 01/02/03 が同一ハッシュ（f576...）、04 のみ別（da17...）。上記 suggestion 1 参照。
- slug 重複: `articles/` 内に同名なし（一意）。

## 適用した修正（修正適用時のみ）

なし（レポートのみ・非破壊）。

## 次のアクション

- [ ] warning（title の短縮）を直す。suggestion も可能なら対応。
- [ ] 直したら `/review-article` で再レビューする（`/revise-article` で修正しても可）。
- [ ] 判定が「公開可」になったら Front Matter を `published: true` に変えて `git push`（PR運用なら `/publish-pr`）。
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
