# 公開前レビュー: Deno 2.9のDeno.test.each()とt.assertSnapshot()をnode:testと書き比べた / deno29-test-each-snapshot

## レビューの前提

- 対象記事: `articles/deno29-test-each-snapshot.md`（引数で明示指定）
- 出典ログ: `logs/run-deno29-test-each-snapshot-20260814-0410/execution-log.md`（引数で明示指定。記事冒頭 L9 の前提コメントとも一致）
- レビュー日時: 2026-08-14 04:35
- 修正の適用: なし（レポートのみ・非破壊）
- 公開基準: 標準
- 補足: 本記事は2回目のレビュー。前回 `logs/review-deno29-test-each-snapshot-20260814-0430.md`（要修正 / warning 3）→ `logs/revise-deno29-test-each-snapshot-20260814-0432.md` で warning 3 件が修正済み。**今回はその再レビュー**であり、前回 warning の解消確認を含む。

## 判定

**判定: 公開可**

- blocker: 0 件 / warning: 0 件 / suggestion: 5 件
- 根拠（判定を決めた主な確認）:
  - 公開安全 3点すべてクリア: `published: false` / 秘密情報なし（機械チェックの user-path WARN は L500 の Node 警告引用で `/Users/.../024_zenn/package.json` とマスク済み＝誤検知）/ slug は 25文字・文字種OK・汎用語でなく `articles/` 内に重複なし
  - 事実整合: 記事の結論（完了条件5件すべて達成・予想6件中4件が外れ）がログ「結果サマリー」「予測（詰まりポイント表）との差分」と一致。本文のコマンド・エラー全文・実行結果の数値（`4 passed` / `10 passed` / `20 passed | 1 failed` / `12行 vs 17行` 等）はすべてログに原文が存在。創作コード・創作数値・存在しない画像参照は見つからなかった
  - 前回 warning 3件はいずれも解消を確認（下記「前回指摘の解消確認」）
  - 機械チェック `SUMMARY fail=0 warn=2` の 2件はどちらも誤検知（切り分けは下記）
- suggestion は任意。直さずに `published: true` にしても公開安全・事実性の問題はない。

## 最優先で直すべき指摘（上位3件）

いずれも suggestion（任意）。blocker / warning はゼロ。

1. [suggestion] 冒頭 L9 `<!-- 前提: 出典ログ ... -->` — 公開記事のソースにリポジトリ内部パスが残る。公開前に1行削除するのが無難
2. [suggestion] 「はじめに」L15 /「Node のスナップショット」L630 の「そこで一番時間を使いました」 — ログの所要時間は詰まり #1 が約4分、#2+#3（スナップショット）が約3分。「一番つまずいた」「一番手が止まった」のような主観表現に寄せるとログと矛盾しない
3. [suggestion] L405〜407 のスクショ — 撮影はフェーズ4（`class="site-header"` 追加後）だが、挿入位置は追加前の文脈。「見た目は class 追加後に撮ったもの」の一言を添えると厳密になる

## 指摘一覧（重大度順）

### blocker

なし。

### warning

なし。

### suggestion

| # | 箇所 | 指摘 | 直すとどう良くなるか |
|---|---|---|---|
| 1 | L9 前提コメント | `<!-- 前提: 出典ログ logs/run-.../execution-log.md / 記事タイプ: ... -->` が残っている。Zenn 上では非表示だが、記事ソースに検証パイプラインの内部パスが載る | 削除すれば公開物に社内向けメタ情報が残らない。安全・機械的な削除で本文の意味は変わらない |
| 2 | L15「そこで一番時間を使いました」/ L630「自分が Deno 側で時間を使ったのはまさにここだった」 | ログの詰まり別所要時間は #1 `deno upgrade` 約4分 > #2 引数順 約2分 + #3 初回 `-u` 約1分。時間の大小としては裏付けが弱い（#1 の4分は大半が `brew update` の待ちとログに明記されているため、実質は矛盾しないと判断し warning には上げていない） | 「一番つまずいた」「一番手が止まった」に言い換えると、ログの時間記録と読み比べても齟齬がない |
| 3 | L405〜407 スクショの導入文 | スクショはフェーズ4で撮影（＝`class="site-header"` 追加後）だが、記事では追加前の `.snap` を見せた直後に置かれている。表示上の見た目は同じで実害はない | 「（見た目は class を足した後に撮ったものです）」等の一言で、時系列の厳密さが担保される |
| 4 | Front Matter `title` | 実測60文字で目安ちょうど。`Deno 2.9の.each()とt.assertSnapshot()をnode:testと書き比べた` 等で50文字前後まで詰められる | 一覧での見切れが減る。前回レビューでも任意扱いで見送り済みのため、無理に直す必要はない |
| 5 | 「詰まった点」節（L485〜511） | スクショが添えられていない | 出典ログのスクショは `screenshots/01-render-header.png` の1枚のみ。追加は捏造になるため**見送りが妥当**。記録として残すのみ（checklist 4 の warning 項目だが、素材制約により減格） |

## 前回指摘の解消確認（review-20260814-0430 → revise-0432）

| 前回 # | 前回の warning | 現状 | 確認箇所 |
|---|---|---|---|
| 1 | 「半分くらいが外れました」がまとめの「6件中2件的中」と食い違う | **解消** | L15「事前に立てた予想6件のうち4件が外れました」／ L753「予想は6件でしたが、当たったのは2件だけ」。ログ「予測との差分」の6項目（的中 #1・#3／外れ #2・#4・#5・#6）と一致 |
| 2 | 「わざと1ケースだけ落とす」で ```ts フェンスが文を分断 | **解消** | L257 が1文に統合済み（`add_test.ts` をコピーして `add(-1, 1)` の期待値だけ `0` → `99`）。フェンス行数 92 → 90（偶数＝閉じている） |
| 3 | Node 失敗出力の引用に `test at ...:13:3` が無いのに本文が「出ます」と書いていた | **解消** | L564〜566 に `✖ failing tests:` / `test at tests_node/add_fail.test.js:13:3` を追加済み（ログ L490〜493 と一致）。本文 L583 の主張が引用で裏付けられた |

## 次元別サマリー

| 次元 | 結果 | メモ |
|---|---|---|
| 公開安全 | OK | `published: false` / 秘密情報なし（個人パスは `/Users/.../` にマスク済み、`(node:88836)` は PID で無害）/ slug `deno29-test-each-snapshot`（25文字・重複なし・具体的） |
| Front Matter | OK | title 60文字 / emoji 🧪 / type tech / topics 4件すべて英小文字（deno, nodejs, typescript, test） |
| 事実性（ログ照合） | OK | 結論・コマンド・エラー全文・数値・コードすべてログに原文あり。`要素材` 残存0件 |
| 画像 | OK | 参照1件 `/images/deno29-test-each-snapshot/01-render-header.png` が実在。alt あり。孤立画像なし。画像内容もログの記述（黒背景に白文字の "Deno 2.9" ヘッダー＋下に日本語説明行）と一致 |
| Markdown構造 | OK | ```フェンス 90行（偶数）/ `:::` 4行（偶数、message 1組・details 1組）/ 実 H1 なし（`grep '^# '` のヒットは TAP 出力の引用内）/ 参考リンクは実在ドメイン2件のみ、プレースホルダなし |
| 文章品質・トーン | OK | 新人の経験談として一貫。詰まった点はログの6件すべてが本文に反映（#1 環境構築 / #2・#3 スナップショット節 / #4・#6 詰まった点 / #5 詰まった点）。環境・版数明記あり。冒頭に結論と前提 |
| 完成度 | OK | プレースホルダ・TODO なし。再現手順とハマりどころ一覧まで完結。前提コメントのみ suggestion 1 で指摘 |

## 事実整合の照合結果（ログとの突合）

- **結論（達成/一部/未達）**: 記事「欲しかったものは全部動いたんですが、事前に立てた予想6件のうち4件が外れました」（L15）／「予想は6件でしたが、当たったのは2件だけ」（L753） ↔ ログ「完了条件の判定: **達成**（5条件すべてを一次ログで確認）」＋「予測（詰まりポイント表）との差分」（的中 #1・#3、外れ #2・#4・#5・#6） → **一致**
  - 補足: ログ「記事への写像」L768 には「予測5件のうち当たったのは2件」という記述もあるが、同ログ「予測（詰まりポイント表）との差分」節は #1〜#6 の6件を列挙しており、記事の「6件」が正しい。ログ内の表記ゆれで、記事側の誤りではない。
- **主要な主張の裏付け（抜粋）**:
  - `deno upgrade` の `built without the "upgrade" feature` 全文 → ログ L97
  - `brew upgrade deno` で 2.8.3 → 2.9.5、依存＋`yt-dlp` も巻き込み → ログ L111〜126
  - 配列ケース4件 `ok | 4 passed`、`--filter` で `1 passed | 3 filtered out` → ログ L178〜191
  - 取り違え時の `undefined` / `[object Object]` / `NaN` と printf の位置引数消費 → ログ L210〜222
  - TS2339 ×2（`TestContext` が最後）→ ログ L279〜298（knowledge にも記録あり）
  - 初回 `Missing snapshot file.` → `__snapshots__` 未作成 → `-u` で `> 3 snapshots updated.` → ログ L302〜341
  - 不一致時の `[Diff]` と `--update-snapshots` 案内、`.snap` の `'` 切り替え → ログ L366〜411
  - prune は `-u` 付きフル実行のみ・`1 failed` でも実行 → ログ L417〜427
  - 行数 12 vs 17（`21-loc-compare.txt`）→ ログ L512〜516
  - Node 26.7.0 の `ERR_INVALID_STATE` と `--test-update-snapshots` 案内、`.snapshot` の中身・並び順 → ログ L547〜602
  - v22.17.0 はフラグ不要、わざと壊すと赤くなる → ログ L605〜645
  - Node 26.7.0 は `.ts` 共有可 / 22.17.0 は `ERR_UNKNOWN_FILE_EXTENSION` → ログ L655〜686
  - 未検証範囲（`--test-name-pattern`、Node 側 prune、`fileSnapshot` 等）の明記 → ログ L774〜780
- **創作の疑いがある記述**: なし。本文のコードブロック（`src/add.ts` / `src/render.ts` / `add_test.ts` / `each_object_test.ts` / `render_test.ts` / `add.test.js` / `render.test.js` / `.snap` / `.snapshot`）はすべてログに同一内容が記録されている。
- **時間・数値の裏付け**: 実行結果の数値はすべて一致。唯一裏付けが弱いのは「スナップショットで一番時間を使った」という時間の大小（suggestion 2）。
- **残存する `要素材` マーカー**: 0 件

## 機械チェック結果（scripts/check-article.sh）

```
== check-article: articles/deno29-test-each-snapshot.md (slug=deno29-test-each-snapshot) ==
[PASS] Front Matter を検出した
[PASS] published=false (ドラフト)
[PASS] slug 文字種OK, 長さ=25 (12-50)
[PASS] slug は汎用語で始まっていない
[PASS] type=tech
[WARN] title が長い: 78文字 (60字目安)
[PASS] emoji あり: 🧪
[PASS] topics 4個
[PASS] 画像あり: /images/deno29-test-each-snapshot/01-render-header.png
[PASS] コードフェンスが閉じている: フェンス行=90
[PASS] ::: ブロックが閉じている: 4 行
[PASS] 要素材マーカーなし
[PASS] プレースホルダ残りなし
[WARN] 秘密情報の疑い [user-path] (散文か目視確認) at line 500
SUMMARY fail=0 warn=2
```

### 機械チェックの WARN の切り分け

| WARN | 判定 | 理由 |
|---|---|---|
| `title が長い: 78文字` | **誤検知** | `wc -m` のロケール依存カウント。Python で数え直すと `Deno 2.9のDeno.test.each()とt.assertSnapshot()をnode:testと書き比べた` は **60文字**＝目安ちょうど。短縮は suggestion 4 に降格 |
| `秘密情報の疑い [user-path] at line 500` | **誤検知** | L500 は `MODULE_TYPELESS_PACKAGE_JSON` 警告の引用で、パスは `To eliminate this warning, add "type": "module" to /Users/.../024_zenn/package.json.` と既にマスク済み。記事全体に `grep '/Users/katayamaryuunosuke'` を掛けてヒット0件 |

## 適用した修正

なし（レポートのみ・非破壊レビュー。`published: false` は変更していない）。

## 次のアクション

- [ ] （任意）suggestion 1〜3 を反映する。特に suggestion 1（前提コメント削除）は安全・機械的
- [ ] suggestion を反映した場合は `/review-article` で再レビュー（今回時点で既に「公開可」）
- [ ] `/publish-pr articles/deno29-test-each-snapshot.md` で公開準備する（`published: true` に変更 → feature ブランチで push → PR 作成 → main へのマージで公開）
      （「サイト内で既に使用されています」が出たら slug を具体化。`knowledge/2026-07-01-zenn-slug-already-used.md`）
