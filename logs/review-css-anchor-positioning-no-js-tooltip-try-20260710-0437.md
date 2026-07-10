# 公開前レビュー: CSS Anchor Positioning でツールチップとポップオーバーをJSなしで作ってみた / css-anchor-positioning-no-js-tooltip-try

## レビューの前提

- 対象記事: articles/css-anchor-positioning-no-js-tooltip-try.md
- 出典ログ: logs/run-css-anchor-positioning-20260710-0407/execution-log.md（＋同 workspace/commands.log を補助照合）
- レビュー日時: 2026-07-10 04:37
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 3 件
- 根拠（判定を決めた主な指摘）:
  - 公開安全（published:false / 秘密情報なし / slug 妥当）はすべてクリア。
  - 事実整合: 本文の結論・コマンド・エラー・数値・コードはいずれも execution-log.md ／ commands.log に裏付けあり。ログを超えた断定なし。
  - 機械チェックの唯一の WARN（title 長）は日本語マルチバイトのバイト数由来で、実際の文字数は約43字（60字目安内）。目視で suggestion に降格。

## 最優先で直すべき指摘（上位3件）

1. [suggestion] Front Matter title（2行目） — 機械チェックで「97文字」警告。実体は約43字で問題なし。より短くしたい場合のみ「CSS Anchor Positioning でJSなしツールチップ/ポップオーバーを作ってみた」等に短縮可。必須ではない。
2. [suggestion] 「詰まった点」#3 のログ引用（214〜217行） — commands.log の実測（41〜43行）を要約・和訳した表現で、逐語ではない。より厳密にするなら実ログ行（`after(fixed) pop box: ... right edge= 800 (viewport=800)`）に寄せると誠実。
3. [suggestion] 冒頭の前提コメント（9行目 `<!-- 前提: 出典ログ ... -->`） — draft の作業メモ。公開時に残すか消すかは任意（HTMLコメントなので表示はされない）。publish-pr 前に消しておくと綺麗。

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

（機械チェックの WARN「title が長い: 97文字」は、日本語の多バイト文字によるバイト数寄りの計測。可視文字数は約43字で 60字目安の範囲内のため、目視で suggestion に降格した。）

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | 2行目 title | バイト数計測で長判定。実文字数は約43字で許容内 | さらに短くすると一覧での視認性が上がる（任意） |
| 2 | 214〜217行 コードブロック | commands.log(41-43) の要約・和訳表現で逐語でない。1行目「right edge 張り付き」は実ログに無い言い換え | 実ログ行に寄せると再現性・誠実さが増す |
| 3 | 9行目 前提コメント | draft の作業用コメントが残存 | 公開版から消すと成果物として整う（表示には出ないので必須ではない） |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | published:false / 秘密情報なし / slug=css-anchor-positioning-no-js-tooltip-try（40字, 汎用語なし, ローカル重複なし） |
| Front Matter | OK | title/emoji/type(tech)/topics(4個: css,frontend,html,chrome)/published 揃う。title WARN は suggestion 降格 |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー・数値・コードすべてログ裏付けあり。ログ超えの断定なし |
| 画像 | OK | 参照11枚すべて images/ に実在。alt 全付与。詰まった点にスクショ添付あり。孤立 05-position-area.png は未参照だが images/ 未配置（Zenn公開に影響なし） |
| Markdown構造 | OK | コードフェンス30行(偶数)閉じOK / ::: 2行閉じOK / 見出し階層OK / 参考リンク(MDN)あり |
| 文章品質・トーン | OK | 新人の経験談トーン。詰まった点4件を具体的に記述。環境（OS/Node/Playwright/Chromium）明記。冒頭に結論・対象読者あり |
| 完成度 | OK | 要素材/プレースホルダ残存なし。前提コメントのみ suggestion |

## 事実整合の照合結果（ログとの突合）

- 結論（達成/一部/未達）: 記事「3つとも JavaScript ゼロで動いた／完了条件3つすべて確認」 ↔ ログ「結果サマリー: **達成**（3条件すべてクリア）」 → **一致**
- コマンド/出力の裏付け:
  - CSS.supports 出力（77行） ↔ execution-log 69行 → 一致
  - 軸ミスマッチの box/computed 値（194-197行） ↔ execution-log 91-94行 → 一致
  - フォールバック before/after 数値 `782/1006 → 443/667`（256-258行） ↔ execution-log 108-109行 / commands.log 56-57行 → 一致
  - `CSS.supports('anchor-name: --x') = true` / Chromium 149（339-340行） ↔ execution-log 122-123行 → 一致
  - fixed 迷走ログ（214-217行） ↔ commands.log 41-43行 → **要旨一致**（逐語ではなく要約・和訳。suggestion #2 参照）
- 「詰まった点」4件（#1 anchor()はinset限定 / #2 軸ミスマッチは黙ってズレる / #3 containing block依存 / #4 同名anchor吸着） ↔ execution-log「詰まった点」表#1〜#4 と完全対応
- 貼っているCSSコード: workspace の各HTML（01〜09）由来の抜粋と整合。創作コードなし
- ログを超えた成功・断定: 検出なし（Safari/Firefox 未確認を本文で明示、Baselineばらつきの温度感もログ準拠）
- 創作の疑いがある記述: なし
- 残存する `要素材` マーカー: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/css-anchor-positioning-no-js-tooltip-try.md (slug=css-anchor-positioning-no-js-tooltip-try) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=40 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 97文字 (60字目安)   ← 日本語マルチバイトのバイト数寄り計測。実文字数≒43字で許容内。目視で suggestion 降格
[PASS] emoji あり: 📌
[PASS] topics 4個
[PASS] 画像あり: 00-skeleton.png / 01-tooltip-fail.png / 02-tooltip-ok.png / 03-anchor-sides.png /
       04-anchor-side-mismatch.png / 06-position-area-3ways.png / 07-fallback-before.png /
       08-fallback-after.png / 09-supports.png / 10-anchor-scope.png / 11-index-combined.png（全11枚 実在）
[PASS] コードフェンスが閉じている: フェンス行=30
[PASS] ::: ブロックが閉じている: 2 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[PASS] 秘密情報パターンの検出なし
SUMMARY fail=0 warn=1
```

## 適用した修正

なし（レポートのみ・非破壊）。

## 次のアクション

- [x] blocker / warning はなし（suggestion 3件は任意）
- [ ] （任意）suggestion を反映したい場合は `/revise-article` で調整
- [ ] 判定は「公開可」。Front Matter を `published: true` に変えて `git push`（`/publish-pr`）で公開できる
      （「サイト内で既に使用されています」が出たら slug を具体化。knowledge/2026-07-01-zenn-slug-already-used.md）
